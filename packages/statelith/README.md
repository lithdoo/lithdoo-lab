# statelith

在磁盘上用**固定格式的 JSON 文件**描述**任务状态**（State Document），并提供解析、校验与监听后向多种通道输出的工具库/CLI。命名风格与 [`tomlith`](../tomlith/) 对齐（格式/领域 + `lith`）。

## 目标（待实现）

| 模块 | 意图 |
|------|------|
| **规范** | State Document 的字段、版本、状态机与示例（建议默认文件名如 `task.state.json` 或 `.statelith.json`）。 |
| **parse / validate** | 读取 JSON、校验 schema、暴露 TypeScript 类型与错误信息。 |
| **watch** | 监听文件变更（create / change / unlink），去抖与快照一致性。 |
| **emit** | 将状态变更或全量快照转换为标准输出：**stdout**、**WebSocket** 消息、**SSE** 事件等。 |

```text
task.state.json  -->  parse / validate
                 -->  watch  -->  emit (stdout | ws | sse)
```

与同仓库其它包的关系：

- [`promptpile`](../promptpile/)：对话消息与 LLM 调用；statelith 侧重**任务级状态侧车**，不替代 promptpile 消息目录。
- [`tomlith`](../tomlith/)：TOML 解析；statelith 专注 **JSON 任务状态**。

## 当前状态

- 仅含 **`statelith`** CLI 入口与 **`npm run build`**。
- **尚未**实现规范文档、解析器、文件监听与任何 emit 适配器。

## 开发与构建

```bash
cd packages/statelith
npm install
npm run build
npx statelith --help
npx statelith
```

## 许可证

ISC
