# Companion 协议

协议版本为 `1`。Android 发出的每个命令都先通过 Zod 白名单解析；Codex 原始 JSON-RPC 不会透传到手机。

服务端事件外层统一为：

```json
{
  "protocolVersion": 1,
  "serverEpoch": "uuid",
  "seq": 42,
  "sentAt": 1784246400000,
  "event": { "type": "connection.health", "codex": "ready" }
}
```

客户端连接 `/micro` 后必须在 10 秒内发送 `auth`。`lastSeq` 仍位于当前 Epoch 的回放窗口时，Companion 增量重放；Companion 重启、游标过旧或事件缺失时返回完整 `snapshot`。

命令和事件的权威 TypeScript 定义位于 `packages/protocol/src/index.ts`。Codex 版本适配集中在 `apps/companion/src/normalizer.ts`，移动端不依赖 Codex Schema。

`turn.start` 必须带 `idempotencyKey`，并可携带从 `model.list` 返回的 `model` 与该模型支持的 `effort`。Companion 会保存结果，网络重试不会重复创建 Turn。

`model.list` 由 Companion 转发到 Codex App Server，再通过 `models.updated` 返回经过裁剪的模型名称、默认模型、默认推理强度及支持的推理强度。Android 不写死模型目录。
