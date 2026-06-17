import { setTimeout as sleep } from 'node:timers/promises';
import { loadEnv } from '../config/env.js';

loadEnv();

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;

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
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const maxRetries = Number(process.env.LLM_MAX_RETRIES || DEFAULT_MAX_RETRIES);
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const requestBody = JSON.stringify({
    model,
    temperature: 0.3,
    ...payload,
  });

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await requestChatCompletion({
        apiKey,
        endpoint,
        requestBody,
        timeoutMs,
      });
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxRetries) {
        break;
      }

      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError;
}

async function requestChatCompletion({ apiKey, endpoint, requestBody, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`LLM request failed: ${response.status} ${errorText}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`LLM request timeout after ${timeoutMs}ms`);
      timeoutError.code = 'LLM_TIMEOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetry(error) {
  if (error.code === 'LLM_TIMEOUT') return true;
  if (error.status === 429) return true;
  if (typeof error.status === 'number' && error.status >= 500) return true;
  if (error.message === 'fetch failed') return true;

  return false;
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
