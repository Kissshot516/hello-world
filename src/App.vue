<script setup>
import { nextTick, ref } from 'vue';

const promptList = [
  '推荐5首适合通勤听的日语歌，轻松一点',
  '换成中文',
  '多来几首',
  '不要轻松的，燃一点',
  '介绍几个华语歌手',
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
      answer:
        '欢迎来到音乐 Agent 学习台。你可以用自然语言查询歌曲、歌手、歌单或演唱会，也可以连续追问，让 Agent 继承上一轮条件。',
      cards: [
        { label: '前端', value: 'Vue 3' },
        { label: '后端', value: 'Node.js' },
        { label: '模型', value: 'DeepSeek' },
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
  <main class="appShell">
    <aside class="sidebar">
      <div class="brandBlock">
        <div class="brandMark">MA</div>
        <div>
          <p class="eyebrow">Music Agent</p>
          <h1>音乐推荐学习台</h1>
        </div>
      </div>

      <p class="summary">
        用一个小型音乐场景练习 Agent 工程：工具调用、参数校验、多轮记忆、结果质量和 trace 调试。
      </p>

      <div class="statusGrid">
        <div class="statusItem">
          <span>工具</span>
          <strong>4</strong>
        </div>
        <div class="statusItem">
          <span>记忆</span>
          <strong>开启</strong>
        </div>
      </div>

      <section class="quickPanel">
        <div class="sectionTitle">快捷提问</div>
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
      </section>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">Agent Console</p>
          <h2>对话与执行链路</h2>
        </div>
        <div class="sessionBadge">会话已连接</div>
      </header>

      <div ref="messagesRef" class="messages">
        <article v-for="message in messages" :key="message.id" class="message" :class="message.role">
          <div v-if="message.result" class="bubble result">
            <div class="bubbleHeader">
              <span class="avatar">A</span>
              <span class="mode">{{ message.result.mode }}</span>
            </div>

            <p class="answerText">{{ message.result.answer }}</p>

            <div v-if="message.result.cards?.length" class="metrics">
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

            <details v-if="message.result.trace?.length" class="tracePanel" open>
              <summary>调用链路</summary>
              <ol>
                <li v-for="(item, index) in message.result.trace" :key="`${item.step}-${index}`">
                  {{ formatTraceItem(item) }}
                </li>
              </ol>
            </details>
          </div>

          <div v-else class="bubble userBubble">
            <span class="avatar">U</span>
            <span>{{ message.text }}</span>
          </div>
        </article>

        <article v-if="loading" class="message assistant">
          <div class="bubble loadingBubble">
            <span class="loader"></span>
            <span>正在分析问题并选择工具...</span>
          </div>
        </article>
      </div>

      <form class="composer" @submit.prevent="sendMessage()">
        <input v-model="inputText" autocomplete="off" placeholder="输入音乐问题，例如：推荐5首适合通勤听的日语歌" />
        <button type="submit" :disabled="loading">
          {{ loading ? '分析中' : '发送' }}
        </button>
      </form>
    </section>
  </main>
</template>
