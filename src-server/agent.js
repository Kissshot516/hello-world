import { generateGeneralAnswer } from './llm/llmClient.js';
import { tools } from './tools/index.js';

export async function handleAgentMessage(message) {
  const text = String(message || '').trim();

  if (!text) {
    return createGeneralAnswer('请先输入一个问题。');
  }

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
      { label: '回答来源', value: process.env.LLM_API_KEY ? '真实模型' : '本地 mock' },
      { label: '工具调用', value: '未触发' },
      { label: '下一步', value: '模型选择工具' },
    ],
    table: [],
  };
}
