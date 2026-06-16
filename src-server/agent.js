import { createChatCompletion, generateGeneralAnswer, hasLlmApiKey } from './llm/llmClient.js';
import { tools } from './tools/index.js';

const toolSchemas = tools.map((tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: '用户的原始问题。',
        },
      },
      required: ['message'],
    },
  },
}));

export async function handleAgentMessage(message) {
  const text = String(message || '').trim();

  if (!text) {
    return createGeneralAnswer('请先输入一个问题。');
  }

  if (!hasLlmApiKey()) {
    return runKeywordFallback(text);
  }

  try {
    return await runModelToolCalling(text);
  } catch (error) {
    const fallback = await runKeywordFallback(text);
    return {
      ...fallback,
      answer: `模型工具调用失败，已回退到本地工具选择。错误信息：${error.message}\n\n${fallback.answer}`,
    };
  }
}

async function runModelToolCalling(message) {
  const firstResponse = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content:
          '你是一个音乐推荐 Agent。你可以根据用户问题选择合适工具。涉及歌曲、歌手、歌单、演唱会时优先调用工具；普通音乐概念问题直接回答。',
      },
      {
        role: 'user',
        content: message,
      },
    ],
    tools: toolSchemas,
    tool_choice: 'auto',
  });

  const assistantMessage = firstResponse.choices?.[0]?.message;
  const toolCall = assistantMessage?.tool_calls?.[0];

  if (!toolCall) {
    return {
      mode: 'chat:general',
      answer: assistantMessage?.content || (await generateGeneralAnswer(message)),
      cards: [
        { label: '回答来源', value: '真实模型' },
        { label: '工具调用', value: '未触发' },
        { label: '下一步', value: '音乐工具调用' },
      ],
      table: [],
    };
  }

  const toolName = toolCall.function?.name;
  const selectedTool = tools.find((tool) => tool.name === toolName);

  if (!selectedTool) {
    throw new Error(`Unknown tool selected by model: ${toolName}`);
  }

  const toolArgs = parseToolArguments(toolCall.function?.arguments);
  const toolResult = selectedTool.run({
    message,
    ...toolArgs,
  });

  const summary = await summarizeToolResult({
    message,
    assistantMessage,
    toolCall,
    toolResult,
  });

  return {
    ...toolResult,
    mode: `llm:${toolResult.mode}`,
    answer: summary,
    cards: [
      { label: '工具选择', value: selectedTool.name },
      { label: '选择方式', value: '模型 tool calling' },
      ...(toolResult.cards || []),
    ],
  };
}

async function summarizeToolResult({ message, assistantMessage, toolCall, toolResult }) {
  const data = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: '你是一个音乐数据分析助手。根据工具返回的数据，用简洁中文总结结论，并给出试听、收藏或后续探索建议。',
      },
      {
        role: 'user',
        content: message,
      },
      assistantMessage,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      },
    ],
  });

  const answer = data.choices?.[0]?.message?.content;

  if (!answer) {
    return toolResult.answer;
  }

  return answer;
}

async function runKeywordFallback(text) {
  const matchedTool = tools
    .map((tool) => {
      const score = tool.keywords.filter((keyword) => text.includes(keyword)).length;
      return { ...tool, score };
    })
    .filter((tool) => tool.score > 0)
    .sort((a, b) => b.score - a.score || (b.priority || 0) - (a.priority || 0))[0];

  if (!matchedTool) {
    return createGeneralAnswer(text);
  }

  return matchedTool.run({ message: text });
}

async function createGeneralAnswer(message) {
  let answer;

  try {
    answer = await generateGeneralAnswer(message);
  } catch (error) {
    answer = `大模型调用失败，已回退到本地回答。错误信息：${error.message}`;
  }

  return {
    mode: 'chat:general',
    answer,
    cards: [
      { label: '回答来源', value: hasLlmApiKey() ? '真实模型' : '本地 mock' },
      { label: '工具调用', value: '未触发' },
      { label: '下一步', value: '音乐工具调用' },
    ],
    table: [],
  };
}

function parseToolArguments(rawArguments) {
  if (!rawArguments) return {};

  try {
    return JSON.parse(rawArguments);
  } catch {
    return {};
  }
}
