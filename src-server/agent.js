import { createChatCompletion, generateGeneralAnswer, hasLlmApiKey } from './llm/llmClient.js';
import { tools } from './tools/index.js';

const DEFAULT_CONVERSATION_ID = 'default';
const MAX_MEMORY_AGE_MS = 30 * 60 * 1000;
const conversationMemories = new Map();

const defaultToolSchema = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: '用户的原始问题。',
    },
  },
  required: ['message'],
};

const toolSchemas = tools.map((tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.schema || defaultToolSchema,
  },
}));

export async function handleAgentMessage(message, options = {}) {
  const trace = [];
  const text = String(message || '').trim();
  const memory = getConversationMemory(options.conversationId);

  traceMemoryLoad(memory, trace);

  if (!text) {
    return createGeneralAnswer('请先输入一个问题。', trace);
  }

  if (!hasLlmApiKey()) {
    trace.push({
      step: 'api_key_check',
      status: 'skipped',
      detail: '未配置 LLM_API_KEY，使用关键词 fallback。',
    });
    return runKeywordFallback(text, trace, memory);
  }

  try {
    return await runModelToolCalling(text, trace, memory);
  } catch (error) {
    trace.push({
      step: 'agent_fallback',
      status: 'error',
      detail: error.message,
    });

    const fallback = await runKeywordFallback(text, trace, memory);
    return {
      ...fallback,
      answer: `模型工具调用失败，已回退到本地工具选择。错误信息：${error.message}\n\n${fallback.answer}`,
      trace,
    };
  }
}

async function runModelToolCalling(message, trace, memory) {
  const selectionStart = Date.now();
  const firstResponse = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: buildToolSelectionPrompt(memory),
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
    const rememberedTool = getRememberedToolForFollowUp(message, memory);

    if (rememberedTool) {
      trace.push({
        step: 'memory_tool_selection',
        status: 'success',
        tool: rememberedTool.name,
        detail: '模型未选择工具，但本轮输入像是追问，复用上一轮工具。',
      });

      const rememberedToolCall = createMemoryToolCall(rememberedTool.name, message);
      return buildToolResponse({
        message,
        assistantMessage: createMemoryAssistantMessage(rememberedToolCall),
        toolCalls: [rememberedToolCall],
        trace,
        memory,
      });
    }

    return {
      mode: 'chat:general',
      answer: assistantMessage?.content || (await generateGeneralAnswer(message)),
      cards: [
        { label: '回答来源', value: '真实模型' },
        { label: '工具调用', value: '未触发' },
        { label: '下一步', value: '多轮工具记忆' },
      ],
      table: [],
      trace,
    };
  }

  return buildToolResponse({
    message,
    assistantMessage,
    toolCalls,
    trace,
    memory,
  });
}

async function buildToolResponse({ message, assistantMessage, toolCalls, trace, memory }) {
  const toolExecutions = toolCalls.map((toolCall) => executeToolCall({ message, toolCall, trace, memory }));
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

function executeToolCall({ message, toolCall, trace, memory }) {
  const start = Date.now();
  const toolName = toolCall.function?.name;
  const selectedTool = tools.find((tool) => tool.name === toolName);

  if (!selectedTool) {
    const result = createToolErrorResult(toolName || 'unknown', `模型选择了未注册工具：${toolName}`);
    trace.push({
      step: 'tool_execution',
      status: 'error',
      tool: toolName || 'unknown',
      durationMs: Date.now() - start,
      rows: 0,
      detail: result.answer,
    });

    return {
      tool: { name: toolName || 'unknown' },
      toolCall,
      result,
    };
  }

  const toolArgs = parseToolArguments(toolCall.function?.arguments);
  let toolInput = prepareToolInput(selectedTool, { message, ...toolArgs }, memory, trace);

  try {
    toolInput = validateToolInput(selectedTool, toolInput, trace);
    const result = selectedTool.run(toolInput);

    trace.push({
      step: 'tool_execution',
      status: 'success',
      tool: selectedTool.name,
      durationMs: Date.now() - start,
      rows: result.table?.length || 0,
      args: sanitizeTraceArgs(toolInput),
    });
    recordResultQuality(selectedTool, result, trace);
    updateConversationMemory(memory, selectedTool.name, toolInput, result, trace);

    return {
      tool: selectedTool,
      toolCall,
      result,
    };
  } catch (error) {
    const result = createToolErrorResult(selectedTool.name, error.message);
    trace.push({
      step: 'tool_execution',
      status: 'error',
      tool: selectedTool.name,
      durationMs: Date.now() - start,
      rows: 0,
      args: sanitizeTraceArgs(toolInput),
      detail: error.message,
    });

    return {
      tool: selectedTool,
      toolCall,
      result,
    };
  }
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
        content:
          '你是一个音乐数据分析助手。根据所有工具返回的数据，用简洁中文总结结论；如果工具结果里有完全匹配、相近推荐、热门补充，请明确说明结果质量和推荐理由。',
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

async function runKeywordFallback(text, trace, memory) {
  const matchedTool = findKeywordTool(text) || getRememberedToolForFollowUp(text, memory);

  trace.push({
    step: 'keyword_fallback',
    status: matchedTool ? 'success' : 'skipped',
    tool: matchedTool?.name,
    detail: matchedTool ? '使用关键词或会话记忆选择工具。' : '没有匹配到本地工具。',
  });

  if (!matchedTool) {
    return createGeneralAnswer(text, trace);
  }

  const start = Date.now();
  let toolInput = prepareToolInput(matchedTool, { message: text }, memory, trace);

  try {
    toolInput = validateToolInput(matchedTool, toolInput, trace);
    const result = matchedTool.run(toolInput);
    trace.push({
      step: 'tool_execution',
      status: 'success',
      tool: matchedTool.name,
      durationMs: Date.now() - start,
      rows: result.table?.length || 0,
      args: sanitizeTraceArgs(toolInput),
    });
    recordResultQuality(matchedTool, result, trace);
    updateConversationMemory(memory, matchedTool.name, toolInput, result, trace);

    return {
      ...result,
      trace,
    };
  } catch (error) {
    trace.push({
      step: 'tool_execution',
      status: 'error',
      tool: matchedTool.name,
      durationMs: Date.now() - start,
      rows: 0,
      args: sanitizeTraceArgs(toolInput),
      detail: error.message,
    });

    return {
      ...createToolErrorResult(matchedTool.name, error.message),
      trace,
    };
  }
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
      { label: '下一步', value: '多轮工具记忆' },
    ],
    table: [],
    trace,
  };
}

function buildToolSelectionPrompt(memory) {
  const memoryHint = memory.lastToolName
    ? `上一轮工具是 ${memory.lastToolName}，上一轮结构化参数是 ${JSON.stringify(
        memory.lastArgs
      )}。如果用户说“换成中文”“多来几首”“不要轻松的，燃一点”这类追问，要优先复用上一轮工具和参数，只覆盖本轮明确提到的条件。`
    : '当前没有上一轮工具记忆。';

  return `你是一个音乐推荐 Agent。你可以根据用户问题选择合适工具。涉及歌曲、歌手、歌单、演唱会时优先调用工具；普通音乐概念问题直接回答。调用工具时，请尽量从用户问题中提取结构化参数，例如场景、心情、风格、关键词和数量。${memoryHint}`;
}

function getConversationMemory(conversationId) {
  const normalizedId = normalizeConversationId(conversationId);
  const existing = conversationMemories.get(normalizedId);

  if (existing && Date.now() - existing.updatedAtMs <= MAX_MEMORY_AGE_MS) {
    return existing;
  }

  const memory = {
    id: normalizedId,
    lastToolName: '',
    lastArgs: {},
    lastResultMeta: null,
    updatedAtMs: Date.now(),
  };
  conversationMemories.set(normalizedId, memory);
  return memory;
}

function normalizeConversationId(conversationId) {
  return String(conversationId || DEFAULT_CONVERSATION_ID).trim().slice(0, 80) || DEFAULT_CONVERSATION_ID;
}

function traceMemoryLoad(memory, trace) {
  trace.push({
    step: 'memory_load',
    status: memory.lastToolName ? 'success' : 'empty',
    tool: memory.lastToolName || undefined,
    args: sanitizeTraceArgs(memory.lastArgs),
    detail: memory.lastToolName ? '读取到上一轮工具参数。' : '当前会话还没有可复用的工具记忆。',
  });
}

function updateConversationMemory(memory, toolName, toolInput, result, trace) {
  if (result.mode === 'tool:error') return;

  memory.lastToolName = toolName;
  memory.lastArgs = sanitizeTraceArgs(toolInput);
  memory.lastResultMeta = result.meta || null;
  memory.updatedAtMs = Date.now();

  trace.push({
    step: 'memory_update',
    status: 'success',
    tool: toolName,
    args: sanitizeTraceArgs(memory.lastArgs),
    detail: '已保存本轮工具参数，后续追问可以继承。',
  });
}

function prepareToolInput(tool, input, memory, trace) {
  if (!shouldMergeMemory(tool, input, memory)) {
    return input;
  }

  const mergedInput = tool.mergeMemoryArgs(memory.lastArgs, input);

  trace.push({
    step: 'memory_merge',
    status: 'success',
    tool: tool.name,
    args: sanitizeTraceArgs(mergedInput),
    detail: '继承上一轮参数，并用本轮输入覆盖明确变化的条件。',
  });

  return mergedInput;
}

function shouldMergeMemory(tool, input, memory) {
  if (!memory.lastToolName || memory.lastToolName !== tool.name) return false;
  if (typeof tool.mergeMemoryArgs !== 'function') return false;

  const text = String(input.message || '');
  return isFollowUpMessage(text) || isSparseToolInput(input);
}

function isSparseToolInput(input) {
  const explicitArgCount = Object.entries(input).filter(
    ([key, value]) => key !== 'message' && value !== undefined && value !== null && value !== ''
  ).length;

  return explicitArgCount <= 2;
}

function isFollowUpMessage(text) {
  return [
    '换成',
    '改成',
    '换',
    '不要',
    '多来',
    '再来',
    '多几',
    '更多',
    '少点',
    '中文',
    '日语',
    '英文',
    '轻松',
    '温柔',
    '燃',
    '通勤',
    '运动',
    '写代码',
    '专注',
  ].some((keyword) => text.includes(keyword));
}

function getRememberedToolForFollowUp(text, memory) {
  if (!memory.lastToolName || !isFollowUpMessage(text)) return null;
  return tools.find((tool) => tool.name === memory.lastToolName) || null;
}

function findKeywordTool(text) {
  return tools
    .map((tool) => {
      const score = tool.keywords.filter((keyword) => text.includes(keyword)).length;
      return { ...tool, score };
    })
    .filter((tool) => tool.score > 0)
    .sort((a, b) => b.score - a.score || (b.priority || 0) - (a.priority || 0))[0];
}

function createMemoryToolCall(toolName, message) {
  return {
    id: `call_memory_${Date.now()}`,
    type: 'function',
    function: {
      name: toolName,
      arguments: JSON.stringify({ message }),
    },
  };
}

function createMemoryAssistantMessage(toolCall) {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [toolCall],
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

function validateToolInput(tool, input, trace) {
  if (typeof tool.validateArgs !== 'function') {
    return input;
  }

  const validation = tool.validateArgs(input);
  const args = validation.args || input;
  const warnings = validation.warnings || [];

  if (trace) {
    trace.push({
      step: 'argument_validation',
      status: warnings.length ? 'warning' : 'success',
      tool: tool.name,
      args: sanitizeTraceArgs(args),
      detail: warnings.join('；'),
    });
  }

  return args;
}

function createToolErrorResult(toolName, message) {
  return {
    mode: 'tool:error',
    answer: `工具 ${toolName} 执行失败：${message}`,
    cards: [
      { label: '失败工具', value: toolName },
      { label: '错误类型', value: 'tool_execution_error' },
    ],
    table: [],
  };
}

function recordResultQuality(tool, result, trace) {
  const meta = result.meta;
  if (!meta) return;

  trace.push({
    step: 'result_quality',
    status: meta.quality || 'unknown',
    tool: tool.name,
    requestedLimit: meta.requestedLimit,
    exactCount: meta.exactCount,
    relaxedCount: meta.relaxedCount,
    fallbackCount: meta.fallbackCount,
    fallbackUsed: meta.fallbackUsed,
    detail: meta.message,
  });
}

function sanitizeTraceArgs(args) {
  return Object.fromEntries(
    Object.entries(args || {}).filter(
      ([key, value]) => key !== 'message' && value !== undefined && value !== null && value !== ''
    )
  );
}
