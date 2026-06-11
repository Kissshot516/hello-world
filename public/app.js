const form = document.querySelector('#chatForm');
const input = document.querySelector('#messageInput');
const messages = document.querySelector('#messages');
const sendButton = document.querySelector('#sendButton');
const promptButtons = document.querySelectorAll('.prompt');

function createMessage(role, text) {
  const item = document.createElement('article');
  item.className = `message ${role}`;
  item.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

function renderAgentResult(result) {
  const item = document.createElement('article');
  item.className = 'message assistant';

  const cards = result.cards
    .map((card) => `<div class="metric"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong></div>`)
    .join('');

  const table = renderTable(result.table);

  item.innerHTML = `
    <div class="bubble result">
      <div class="mode">${escapeHtml(result.mode)}</div>
      <p>${escapeHtml(result.answer)}</p>
      <div class="metrics">${cards}</div>
      ${table}
    </div>
  `;

  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function renderTable(rows) {
  if (!rows || rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const head = headers.map((key) => `<th>${escapeHtml(key)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${headers.map((key) => `<td>${escapeHtml(row[key])}</td>`).join('')}</tr>`)
    .join('');

  return `
    <div class="tableWrap">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

async function sendMessage(message) {
  const text = message.trim();
  if (!text) return;

  createMessage('user', text);
  input.value = '';
  sendButton.disabled = true;
  sendButton.textContent = '分析中';

  const loading = createMessage('assistant', '正在分析问题并选择可用工具...');

  try {
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    const json = await response.json();
    loading.remove();

    if (!response.ok || json.code !== 0) {
      throw new Error(json.message || '请求失败');
    }

    renderAgentResult(json.data);
  } catch (error) {
    loading.remove();
    createMessage('assistant', `请求失败：${error.message}`);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = '发送';
    input.focus();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

promptButtons.forEach((button) => {
  button.addEventListener('click', () => sendMessage(button.dataset.message));
});

renderAgentResult({
  mode: 'system:welcome',
  answer: '欢迎来到第一个 Agent 学习 Demo。建议先点左侧示例问题，看一次完整请求链路。',
  cards: [
    { label: '前端', value: 'HTML/CSS/JS' },
    { label: '后端', value: 'Node.js HTTP' },
    { label: '数据', value: 'Mock Tools' },
  ],
  table: [],
});
