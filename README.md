# Agent Learning Demo

这是一个用于学习 Agent 开发的最小项目，和你的工作前端项目完全隔离。

## 怎么运行

```bash
cd D:\15832\agent-learning-demo
npm run dev
```

浏览器打开：

```text
http://localhost:3333
```

## 当前链路

```text
浏览器页面 -> POST /api/agent/chat -> Node.js 服务 -> mock 业务工具 -> 返回分析结果 -> 页面展示
```

## 你可以问

- 最近 7 天有哪些告警？
- 帮我分析一下钻孔异常情况
- 你现在能做什么？

## 下一步可以加什么

1. 接入真实大模型 API。
2. 把 mock 数据换成真实接口。
3. 增加流式输出。
4. 增加会话历史。
5. 增加工具调用日志。
