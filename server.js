import { createServer } from 'node:http';
import { handleAgentMessage } from './src-server/agent.js';

const PORT = Number(process.env.PORT || 3333);

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

async function handleAgentChat(req, res) {
  try {
    const body = await readBody(req);
    const result = await handleAgentMessage(body.message);
    sendJson(res, 200, { code: 0, data: result });
  } catch (error) {
    sendJson(res, 500, { code: 500, message: error.message || 'Agent service error' });
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/agent/chat') {
    await handleAgentChat(req, res);
    return;
  }

  sendJson(res, 404, { code: 404, message: 'API route not found' });
});

server.listen(PORT, () => {
  console.log(`Agent learning demo running at http://localhost:${PORT}`);
});
