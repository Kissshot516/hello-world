import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 3333);
const publicDir = join(process.cwd(), 'public');

const mockAlerts = [
  { id: 'A-1001', workface: '101工作面', level: '高', type: '钻屑量异常', count: 4, date: '2026-06-05' },
  { id: 'A-1002', workface: '101工作面', level: '中', type: '应力波动', count: 3, date: '2026-06-06' },
  { id: 'A-1003', workface: '203工作面', level: '高', type: '微震事件密集', count: 2, date: '2026-06-07' },
  { id: 'A-1004', workface: '305工作面', level: '低', type: '数据延迟', count: 3, date: '2026-06-08' },
];

const mockDrilling = [
  { workface: '101工作面', holes: 18, abnormal: 5, avgDepth: 22.4, risk: '偏高' },
  { workface: '203工作面', holes: 12, abnormal: 2, avgDepth: 19.8, risk: '中等' },
  { workface: '305工作面', holes: 9, abnormal: 1, avgDepth: 16.1, risk: '较低' },
];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function analyzeMessage(message) {
  const text = String(message || '').trim();
  const wantsAlerts = /告警|报警|预警|异常|风险/.test(text);
  const wantsDrilling = /钻孔|钻屑|孔|进尺/.test(text);

  if (wantsAlerts) {
    const total = mockAlerts.reduce((sum, item) => sum + item.count, 0);
    const high = mockAlerts.filter((item) => item.level === '高').reduce((sum, item) => sum + item.count, 0);
    const main = mockAlerts[0];

    return {
      mode: 'tool:queryAlerts',
      answer: `近 7 天共发现 ${total} 条告警，其中高风险 ${high} 条。主要集中在 ${main.workface}，核心问题是${main.type}。建议先复核该工作面的钻屑量、应力趋势和现场处置记录。`,
      cards: [
        { label: '告警总数', value: `${total} 条` },
        { label: '高风险', value: `${high} 条` },
        { label: '重点区域', value: main.workface },
      ],
      table: mockAlerts,
    };
  }

  if (wantsDrilling) {
    const target = mockDrilling[0];
    const totalHoles = mockDrilling.reduce((sum, item) => sum + item.holes, 0);
    const abnormal = mockDrilling.reduce((sum, item) => sum + item.abnormal, 0);

    return {
      mode: 'tool:queryDrilling',
      answer: `当前 mock 数据中共有 ${totalHoles} 个钻孔记录，异常孔 ${abnormal} 个。${target.workface} 异常占比最高，风险状态为${target.risk}，建议优先查看单孔趋势和每米钻屑量曲线。`,
      cards: [
        { label: '钻孔总数', value: `${totalHoles} 个` },
        { label: '异常孔', value: `${abnormal} 个` },
        { label: '重点工作面', value: target.workface },
      ],
      table: mockDrilling,
    };
  }

  return {
    mode: 'chat:general',
    answer: '我现在是一个最小版 Agent Demo。你可以问我：“最近 7 天有哪些告警？”或者“分析一下钻孔异常情况”。我会根据问题选择 mock 工具并返回结构化结果。',
    cards: [
      { label: '能力 1', value: '告警分析' },
      { label: '能力 2', value: '钻孔分析' },
      { label: '下一步', value: '接入真实模型' },
    ],
    table: [],
  };
}

async function handleAgentChat(req, res) {
  try {
    const body = await readBody(req);
    const result = analyzeMessage(body.message);
    sendJson(res, 200, { code: 0, data: result });
  } catch (error) {
    sendJson(res, 500, { code: 500, message: error.message || 'Agent service error' });
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(publicDir, requested));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const content = await readFile(filePath);
    const mime = mimeTypes[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/agent/chat') {
    await handleAgentChat(req, res);
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Agent learning demo running at http://localhost:${PORT}`);
});
