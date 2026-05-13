# promptpile-mcp + promptpile-react

本示例提供 **`run-example.bat`**：自动探活或启动 MCP 网关、在 **`messages/`** 下准备会话与 **`messages\.tools.toml`**，再以 **`-i -c`** 模式运行 **`promptpile-react`**（终端多轮输入）。**默认按 DeepSeek**（**`api.deepseek.com`**），环境变量约定与 [`promptpile-chat-loop`](../promptpile-chat-loop/) 一致；改用 OpenAI 或其它兼容端时请修改 **`AI_API_BASE_URL`** / **`-m`**（模型）。

根目录下的 **`.react.*.md`** 为模板；首次运行会复制到 **`messages/`**（仅当目标文件尚不存在时），也可手动编辑 **`messages/`** 内的副本。

## 前置条件

- **Node.js 18+**；使用 Playwright MCP 时建议 Node 20+（见 [`promptpile-mcp-launcher`](../promptpile-mcp-launcher/README.md)）。
- **`packages/promptpile-mcp`**、**`packages/promptpile-react`**、**`packages/promptpile`** 已 **`npm install`**（生成 **`dist/`**）；**`promptpile-react` 默认通过依赖内置 `promptpile/dist/index.js`** 调用 CLI，无需全局 **`promptpile`**（可选 **`PROMPTPILE_BIN`** 覆盖），详见 **`packages/promptpile-react/README.md`**。
- **`example`** 目录已 **`npm install`**（与本仓库其它示例一致）。
- **`curl`** 可用于探测网关 **`/health`**（Windows 10+ 自带）。

## 端口

脚本内 **`MCP_PORT=8765`** 须与 [`promptpile-mcp-launcher/mcp.toml`](../promptpile-mcp-launcher/mcp.toml) 中 **`[gateway].port`** 一致；若修改一端，请同步修改 **`run-example.bat`** 顶部变量。

## 环境变量与 `.env`

可将密钥写入本目录 **`.env`**（可参考 **`.env.example`**）；**`run-example.bat`** 会解析 **`DEEPSEEK_API_KEY`** / **`AI_API_KEY`**、**`AI_MODEL`**、**`AI_API_BASE_URL`**，以及可选 **`PROMPTPILE_MCP_TOKEN`**、**`PROMPTPILE_MCP_BASE_URL`**。脚本在未定义 **`AI_API_BASE_URL`** 时会设为 **`https://api.deepseek.com/v1`**，以便父进程向 **`promptpile-react`** 传入 **`-b`**（避免子进程仅依赖 dotenv 顺序而误连 **`api.openai.com`**）。仅靠「系统环境变量」也行；若使用 **`setx`**，须**新开终端**后变量才会出现在会话里。

| 变量 | 说明 |
|------|------|
| **`DEEPSEEK_API_KEY`** 或 **`AI_API_KEY`** | 必填其一：`.env` 或用户环境变量。 |
| **`AI_MODEL`** | 可选；默认 **`deepseek-chat`**（与 **`promptpile-chat-loop`** 一致）。 |
| **`AI_API_BASE_URL`** | 可选；传给 **`promptpile-react -b`**。未设置时 **`run-example.bat`** 默认为 **`https://api.deepseek.com/v1`**。 |
| **`DEFAULT_DIRECTORY`** | 可选；与 **`promptpile-chat-loop`** 的 **`.env.example`** 一致（如 **`./messages`**），供 **`promptpile`** dotenv 约定；本脚本仍固定使用目录 **`messages/`** 调用 CLI。 |
| **`QUIET`** | 可选；与 **`promptpile-chat-loop`** 对齐；**`promptpile`** / **`promptpile-react`** 若在 cwd 加载 dotenv 时会读取。 |
| **`PROMPTPILE_REACT_MAX_STEP`** | 可选；每轮对话内 ReAct **`--max-step`**，默认 **8**。 |
| **`PROMPTPILE_MCP_TOKEN`** | 可选；与网关 **`[gateway].token`** 一致时，用于 **`export-tools`**、**after-hook `exec-calls`** 与文末手动命令。 |
| **`PROMPTPILE_MCP_BASE_URL`** | 可选；默认由脚本设为与 **`MCP_BASE_URL`** 相同（供 **`after-hook-mcp-exec-calls.bat`** 调用网关）。 |

## After-hook：自动 `exec-calls`

**`run-example.bat`** 向 **`promptpile-react`** 传入 **`--after-hook-path`**，指向本目录 **`after-hook-mcp-exec-calls.bat`**。

- **触发时机**：仅在 **Thought** 阶段的 **`promptpile`** 成功结束后（**Observe** 与 **Final** 阶段会剥离 **`--after-hook-path`**，见 **`packages/promptpile-react`**）。
- **行为**：若 **`PROMPTPILE_HAS_TOOL_CALLS=1`**（由 **`promptpile`** 注入），则调用 **`promptpile-mcp exec-calls`**，将 **`messages/`** 下 **`*.calls.jsonl`** 转为 **`*.result.jsonl`**。**`PROMPTPILE_MCP_BASE_URL`** 须在环境中存在（脚本默认设置；可与 `.env` 覆盖）。
- **网关**：**`launch`** 须保持运行；否则 **`exec-calls`** 会失败。

## 运行

1. 在本目录执行 **`run-example.bat`**。
2. 若 **`http://127.0.0.1:8765/health`** 不可用，脚本会 **另开窗口** 启动 [`promptpile-mcp-launcher`](../promptpile-mcp-launcher/)，并轮询直至就绪（约最长 62 秒）。
3. 脚本生成 **`messages\.tools.toml`**（依赖已运行的网关），然后启动 **`promptpile-react -i -c`**（含 **`--after-hook-path`**）。
4. 按提示输入用户消息；每轮结束后 **Ctrl+Z** 再 **Enter**（Windows）提交输入（与 **stdin** 约定一致）。

模型若产生 MCP **`tool_calls`**，**Thought** 结束后 **after-hook** 会尝试 **`exec-calls`**。仍可在网关运行时 **手动重试**：

```bat
npx --prefix "..\..\packages\promptpile-mcp" promptpile-mcp exec-calls --base-url http://127.0.0.1:8765 --dir "%CD%\messages"
```

（若配置了 token，追加 **`--token`**，与 **`PROMPTPILE_MCP_TOKEN`** 相同。）

## 目录说明

| 路径 | 说明 |
|------|------|
| **`.react.core.md` 等** | 仓库内模板；首次运行时复制到 **`messages/`**。 |
| **`messages/`** | 会话与 **`[idx]*.md`**、**`.tools.toml`**；默认被 **`.gitignore`** 忽略，勿提交密钥或私密对话。 |
| **`messages\.tools.toml`** | 由 **`promptpile-mcp export-tools`** 生成，勿手工伪造。 |
| **`after-hook-mcp-exec-calls.bat`** | **`promptpile`** after-hook：有 **`tool_calls`** 时 **`exec-calls`**。 |

详见 **`packages/promptpile-react/README.md`** 与 **`packages/promptpile-mcp/README.md`**。
