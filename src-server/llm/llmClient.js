import { loadEnv } from '../config/env.js';

loadEnv();

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';

export async function generateGeneralAnswer(message) {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    return createMockAnswer(message);
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
      messages: [
        {
          role: 'system',
          content:
            '你是一个用于学习 Agent 工程的助手。回答要简洁，优先解释工程概念，并提醒用户当前业务工具包括告警、钻孔、通知人员、工作面概况。',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error('LLM response did not include an answer');
  }

  return answer;
}

function createMockAnswer(message) {
  return `这是本地 mock 模型回答：我收到了你的问题“${message}”。当前还没有配置 LLM_API_KEY，所以没有真正请求大模型。你可以继续问业务问题，例如“最近 7 天有哪些告警？”或“工作面概况怎么样？”。`;
}
