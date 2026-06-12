<script setup>
import { nextTick, ref } from 'vue';

const promptList = ['最近 7 天有哪些告警？', '帮我分析一下钻孔异常情况', '你现在能做什么？'];

const inputText = ref('');
const loading = ref(false);
const messagesRef = ref(null);
const messages = ref([
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    result: {
      mode: 'system:welcome',
      answer: '欢迎来到第一个 Vue 版 Agent 学习 Demo。建议先点左侧示例问题，看一次完整请求链路。',
      cards: [
        { label: '前端', value: 'Vue 3' },
        { label: '后端', value: 'Node.js HTTP' },
        { label: '数据', value: 'Mock Tools' },
      ],
      table: [],
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
      body: JSON.stringify({ message: text }),
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
        <p class="eyebrow">Agent Learning</p>
        <h1>业务数据智能问答助手</h1>
        <p class="summary">
          一个用于学习的最小闭环：Vue 前端输入问题，Node.js 接口服务判断意图，调用 mock 业务数据，再返回分析结果。
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
                  <tr v-for="(row, rowIndex) in message.result.table" :key="row.id || rowIndex">
                    <td v-for="header in getTableHeaders(message.result.table)" :key="header">
                      {{ row[header] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="bubble">{{ message.text }}</div>
        </article>

        <article v-if="loading" class="message assistant">
          <div class="bubble">正在分析问题并选择可用工具...</div>
        </article>
      </div>

      <form class="composer" @submit.prevent="sendMessage()">
        <input v-model="inputText" autocomplete="off" placeholder="输入一个业务问题，比如：最近 7 天有哪些告警？" />
        <button type="submit" :disabled="loading">
          {{ loading ? '分析中' : '发送' }}
        </button>
      </form>
    </section>
  </main>
</template>
