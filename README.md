# Agent Learning Demo

这是一个用于学习 Agent 开发的最小项目，当前场景是音乐智能问答助手。

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
  -> 音乐工具选择 / 大模型兜底
  -> 返回 answer/cards/table
  -> Vue 页面展示
```

## 你可以问

- 推荐几首适合写代码的歌
- 介绍几个华语歌手
- 给我一些通勤歌单
- 最近有什么演唱会？
- 什么是音乐推荐 Agent？

## 当前工具

- `querySongs`：歌曲推荐、歌曲风格、热度数据
- `queryArtists`：歌手、代表作、音乐风格
- `queryPlaylists`：歌单、场景音乐、曲目数量
- `queryConcerts`：演唱会、巡演、门票状态

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
音乐数据问题 -> 模型选择工具 -> 后端执行工具 -> 模型总结结果
普通问题 -> 大模型直接回答
```

## 下一步可以加什么

1. 把 mock 音乐数据换成真实音乐 API。
2. 增加用户偏好和会话记忆。
3. 增加流式输出。
4. 增加工具调用日志。
5. 增加收藏歌单功能。
