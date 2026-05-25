# promptpile 扩展包

本目录存放 **promptpile** 生态的扩展 CLI，核心实现在 [`../packages/promptpile`](../packages/promptpile)。

| 包 | 说明 |
|----|------|
| [`promptpile-mcp`](./promptpile-mcp/) | MCP 网关：`launch` / `export-tools` / `exec-calls` |
| [`promptpile-react`](./promptpile-react/) | ReAct 编排（子进程调用 `promptpile` CLI） |
| [`promptpile-plan`](./promptpile-plan/) | plan-and-exec 脚手架（尚未接线运行时） |

## 示例

- [`../example/promptpile-mcp-launcher`](../example/promptpile-mcp-launcher) — 启动 MCP 网关
- [`../example/promptpile-mcp-react`](../example/promptpile-mcp-react) — MCP + ReAct 串联
- [`../example/promptpile-chat-loop`](../example/promptpile-chat-loop) — 仅核心 `promptpile` 多轮对话

## 安装顺序

```bash
cd ../packages/promptpile && npm install && npm run build
cd ../promptpile/promptpile-react && npm install && npm run build
cd ../promptpile/promptpile-mcp && npm install && npm run build
```
