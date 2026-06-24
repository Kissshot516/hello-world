<script setup>
import { nextTick, ref } from 'vue';

const promptList = [
  '推荐几首适合写代码的歌',
  '介绍几个华语歌手',
  '给我一些通勤歌单',
  '最近有什么演唱会？',
  '什么是音乐推荐 Agent？',
];

const conversationId = getConversationId();
const inputText = ref('');
const loading = ref(false);
const messagesRef = ref(null);
const messages = ref([
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    result: {
      mode: 'system:welcome',
      answer: '欢迎来到音乐 Agent 学习 Demo。音乐数据问题会调用工具，普通问题会尝试调用大模型。',
      cards: [
        { label: '前端', value: 'Vue 3' },
        { label: '后端', value: 'Node.js HTTP' },
        { label: '场景', value: 'Music Agent' },
      ],
      table: [],
      trace: [],
    },
  },
]);

async function scrollToBottom() {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
}

function getTableHeaders(table) {
  return table?.length ? Object.keys(table[0]) : [];
}

function formatTraceItem(item) {
  const parts = [item.step, item.status];
  if (item.tool) parts.push(`tool=${item.tool}`);
  if (item.tools?.length) parts.push(`tools=${item.tools.join(', ')}`);
  if (item.args && Object.keys(item.args).length) parts.push(`args=${JSON.stringify(item.args)}`);
  if (typeof item.requestedLimit === 'number') parts.push(`requested=${item.requestedLimit}`);
  if (typeof item.exactCount === 'number') parts.push(`exact=${item.exactCount}`);
  if (typeof item.relaxedCount === 'number') parts.push(`relaxed=${item.relaxedCount}`);
  if (typeof item.fallbackCount === 'number') parts.push(`fallback=${item.fallbackCount}`);
  if (typeof item.fallbackUsed === 'boolean') parts.push(`fallbackUsed=${item.fallbackUsed}`);
  if (typeof item.rows === 'number') parts.push(`rows=${item.rows}`);
  if (typeof item.durationMs === 'number') parts.push(`${item.durationMs}ms`);
  if (item.detail) parts.push(item.detail);
  return parts.join(' | ');
}

function getConversationId() {
  const storageKey = 'agent-learning-demo-conversation-id';

  try {
    const savedId = localStorage.getItem(storageKey);
    if (savedId) return savedId;

    const nextId = crypto.randomUUID();
    localStorage.setItem(storageKey, nextId);
    return nextId;
  } catch {
    return crypto.randomUUID();
  }
}

async function sendMessage(message = inputText.value) {
  const text = message.trim();
  if (!text || loading.value) return;

  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    text,
  });

  inputText.value = '';
  loading.value = true;
  await scrollToBottom();

  try {
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, conversationId }),
    });

    const json = await response.json();

    if (!response.ok || json.code !== 0) {
      throw new Error(json.message || '请求失败');
    }

    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      result: json.data,
    });
  } catch (error) {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      text: `请求失败：${error.message}`,
    });
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
}
</script>

<template>
  <main class="shell">
    <section class="panel sidebar">
      <div>
        <p class="eyebrow">Music Agent</p>
        <h1>音乐智能问答助手</h1>
        <p class="summary">
          一个用于学习 Agent 工程的音乐场景：Vue 前端输入问题，Node.js 后端选择音乐工具或调用大模型，再返回结构化结果。
        </p>
      </div>

      <div class="tips">
        <button
          v-for="prompt in promptList"
          :key="prompt"
          class="prompt"
          type="button"
          :disabled="loading"
          @click="sendMessage(prompt)"
        >
          {{ prompt }}
        </button>
      </div>
    </section>

    <section class="panel workspace">
      <div ref="messagesRef" class="messages">
        <article v-for="message in messages" :key="message.id" class="message" :class="message.role">
          <div v-if="message.result" class="bubble result">
            <div class="mode">{{ message.result.mode }}</div>
            <p>{{ message.result.answer }}</p>

            <div class="metrics">
              <div v-for="card in message.result.cards" :key="card.label" class="metric">
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
              </div>
            </div>

            <div v-if="message.result.table?.length" class="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th v-for="header in getTableHeaders(message.result.table)" :key="header">
                      {{ header }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in message.result.table" :key="row.id || row.name || row.title || rowIndex">
                    <td v-for="header in getTableHeaders(message.result.table)" :key="header">
                      {{ row[header] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="message.result.trace?.length" class="tracePanel">
              <div class="traceTitle">调用链路</div>
              <ol>
                <li v-for="(item, index) in message.result.trace" :key="`${item.step}-${index}`">
                  {{ formatTraceItem(item) }}
                </li>
              </ol>
            </div>
          </div>

          <div v-else class="bubble">{{ message.text }}</div>
        </article>

        <article v-if="loading" class="message assistant">
          <div class="bubble">正在分析音乐问题并选择可用能力...</div>
        </article>
      </div>

      <form class="composer" @submit.prevent="sendMessage()">
        <input v-model="inputText" autocomplete="off" placeholder="输入一个音乐问题，比如：推荐几首适合写代码的歌" />
        <button type="submit" :disabled="loading">
          {{ loading ? '分析中' : '发送' }}
        </button>
      </form>
    </section>
  </main>
</template>
