import { loadEnv } from '../config/env.js';

loadEnv();

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';

export function hasLlmApiKey() {
  return Boolean(process.env.LLM_API_KEY);
}

export async function createChatCompletion(payload) {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error('LLM_API_KEY is not configured');
  }

  const baseUrl = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function generateGeneralAnswer(message) {
  if (!hasLlmApiKey()) {
    return createMockAnswer(message);
  }

  const data = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content:
          '你是一个用于学习 Agent 工程的音乐助手。回答要简洁，优先解释音乐推荐和工具调用相关概念，并提醒用户当前音乐工具包括歌曲、歌手、歌单、演唱会。',
      },
      {
        role: 'user',
        content: message,
      },
    ],
  });

  const answer = data.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error('LLM response did not include an answer');
  }

  return answer;
}

function createMockAnswer(message) {
  return `这是本地 mock 模型回答：我收到了你的问题“${message}”。当前还没有配置 LLM_API_KEY，所以没有真正请求大模型。你可以继续问音乐问题，例如“推荐几首适合写代码的歌”或“最近有什么演唱会？”。`;
}
