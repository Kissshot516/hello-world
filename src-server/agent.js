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
  const trace = [];
  const text = String(message || '').trim();

  if (!text) {
    return createGeneralAnswer('请先输入一个问题。', trace);
  }

  if (!hasLlmApiKey()) {
    trace.push({
      step: 'api_key_check',
      status: 'skipped',
      detail: '未配置 LLM_API_KEY，使用关键词 fallback。',
    });
    return runKeywordFallback(text, trace);
  }

  try {
    return await runModelToolCalling(text, trace);
  } catch (error) {
    trace.push({
      step: 'agent_fallback',
      status: 'error',
      detail: error.message,
    });

    const fallback = await runKeywordFallback(text, trace);
    return {
      ...fallback,
      answer: `模型工具调用失败，已回退到本地工具选择。错误信息：${error.message}\n\n${fallback.answer}`,
      trace,
    };
  }
}

async function runModelToolCalling(message, trace) {
  const selectionStart = Date.now();
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
  const toolCalls = assistantMessage?.tool_calls || [];

  trace.push({
    step: 'model_tool_selection',
    status: 'success',
    durationMs: Date.now() - selectionStart,
    tools: toolCalls.map((toolCall) => toolCall.function?.name).filter(Boolean),
  });

  if (!toolCalls.length) {
    return {
      mode: 'chat:general',
      answer: assistantMessage?.content || (await generateGeneralAnswer(message)),
      cards: [
        { label: '回答来源', value: '真实模型' },
        { label: '工具调用', value: '未触发' },
        { label: '下一步', value: '音乐工具调用' },
      ],
      table: [],
      trace,
    };
  }

  const toolExecutions = toolCalls.map((toolCall) => executeToolCall({ message, toolCall, trace }));
  const summary = await summarizeToolResults({
    message,
    assistantMessage,
    toolExecutions,
    trace,
  });
  const primaryExecution = toolExecutions[0];
  const mergedCards = toolExecutions.flatMap((execution) => execution.result.cards || []);
  const mergedTable = toolExecutions.flatMap((execution) => execution.result.table || []);

  return {
    ...primaryExecution.result,
    mode: `llm:${primaryExecution.result.mode}`,
    answer: summary,
    cards: [
      { label: '工具选择', value: toolExecutions.map((execution) => execution.tool.name).join(', ') },
      { label: '选择方式', value: '模型 tool calling' },
      ...mergedCards,
    ],
    table: mergedTable,
    trace,
  };
}

function executeToolCall({ message, toolCall, trace }) {
  const start = Date.now();
  const toolName = toolCall.function?.name;
  const selectedTool = tools.find((tool) => tool.name === toolName);

  if (!selectedTool) {
    throw new Error(`Unknown tool selected by model: ${toolName}`);
  }

  const toolArgs = parseToolArguments(toolCall.function?.arguments);
  const result = selectedTool.run({
    message,
    ...toolArgs,
  });

  trace.push({
    step: 'tool_execution',
    status: 'success',
    tool: selectedTool.name,
    durationMs: Date.now() - start,
    rows: result.table?.length || 0,
  });

  return {
    tool: selectedTool,
    toolCall,
    result,
  };
}

async function summarizeToolResults({ message, assistantMessage, toolExecutions, trace }) {
  const toolMessages = toolExecutions.map((execution) => ({
    role: 'tool',
    tool_call_id: execution.toolCall.id,
    content: JSON.stringify(execution.result),
  }));

  const summaryStart = Date.now();
  const data = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: '你是一个音乐数据分析助手。根据所有工具返回的数据，用简洁中文总结结论，并给出试听、收藏或后续探索建议。',
      },
      {
        role: 'user',
        content: message,
      },
      assistantMessage,
      ...toolMessages,
    ],
  });

  trace.push({
    step: 'model_summary',
    status: 'success',
    durationMs: Date.now() - summaryStart,
  });

  const answer = data.choices?.[0]?.message?.content;

  if (!answer) {
    return toolExecutions[0]?.result.answer || '工具已返回结果，但模型没有生成总结。';
  }

  return answer;
}

async function runKeywordFallback(text, trace) {
  const matchedTool = tools
    .map((tool) => {
      const score = tool.keywords.filter((keyword) => text.includes(keyword)).length;
      return { ...tool, score };
    })
    .filter((tool) => tool.score > 0)
    .sort((a, b) => b.score - a.score || (b.priority || 0) - (a.priority || 0))[0];

  trace.push({
    step: 'keyword_fallback',
    status: matchedTool ? 'success' : 'skipped',
    tool: matchedTool?.name,
    detail: matchedTool ? '使用关键词匹配选择工具。' : '没有匹配到本地工具。',
  });

  if (!matchedTool) {
    return createGeneralAnswer(text, trace);
  }

  const start = Date.now();
  const result = matchedTool.run({ message: text });
  trace.push({
    step: 'tool_execution',
    status: 'success',
    tool: matchedTool.name,
    durationMs: Date.now() - start,
    rows: result.table?.length || 0,
  });

  return {
    ...result,
    trace,
  };
}

async function createGeneralAnswer(message, trace) {
  let answer;
  const start = Date.now();

  try {
    answer = await generateGeneralAnswer(message);
    trace.push({
      step: 'general_answer',
      status: 'success',
      durationMs: Date.now() - start,
      source: hasLlmApiKey() ? 'llm' : 'mock',
    });
  } catch (error) {
    answer = `大模型调用失败，已回退到本地回答。错误信息：${error.message}`;
    trace.push({
      step: 'general_answer',
      status: 'error',
      durationMs: Date.now() - start,
      detail: error.message,
    });
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
    trace,
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
