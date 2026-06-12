# Agent Learning Demo

这是一个用于学习 Agent 开发的最小项目，和你的工作前端项目完全隔离。

## 怎么运行

先启动后端 API：

```bash
cd D:\15832\agent-learning-demo
npm install
npm run dev:api
```

再开一个终端启动 Vue 前端：

```bash
cd D:\15832\agent-learning-demo
npm run dev:web
```

浏览器打开：

```text
http://localhost:5173
```

## 当前链路

```text
Vue 页面
  -> Vite 代理
  -> POST /api/agent/chat
  -> Node.js 服务
  -> 工具选择器 / 大模型兜底
  -> 返回 answer/cards/table
  -> Vue 页面展示
```

## 你可以问

- 最近 7 天有哪些告警？
- 帮我分析一下钻孔异常情况
- 通知人员配置是什么？
- 工作面概况怎么样？
- 用一句话介绍什么是 Agent

## 接入大模型

当前项目支持 OpenAI-compatible 的聊天接口。没有配置 API Key 时，会自动走本地 mock 模型回答。

复制环境变量示例：

```bash
copy .env.example .env
```

然后填写：

```text
LLM_API_KEY=你的 API Key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```

重启后端：

```bash
npm run dev:api
```

现在的逻辑是：

```text
命中业务关键词 -> 调用本地工具
没有命中工具 -> 调用大模型普通问答
```

## 下一步可以加什么

1. 让大模型决定调用哪个工具。
2. 把 mock 数据换成真实接口。
3. 增加流式输出。
4. 增加会话历史。
5. 增加工具调用日志。
