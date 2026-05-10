# promptpile-mcp + promptpile-react

本目录存放 **`promptpile-react -d`** 使用的 ReAct 提示词文件（与 `promptpile-mcp` 网关、`export-tools` 生成的 `.tools.toml` 组合使用时，将 `--tools-file` 指向该 `.tools.toml`，并把 `-d` 指向本目录或复制这些文件到你的消息目录根下）。

## 文件

| 文件 | 说明 |
|------|------|
| `.react.core.md` | Thought 阶段系统注入：MCP 工具在此阶段可用 |
| `.react.observe.md` | Observe 阶段：仅能调用 `react_observe_decision` |
| `.react.final.md` | 可选收尾阶段注入 |

详见 `packages/promptpile-react/README.md` 与 `packages/promptpile-mcp/README.md`。
