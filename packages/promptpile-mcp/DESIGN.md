# promptpile-mcp 技术设计

本文档描述 **promptpile-mcp** 的目标架构、CLI、HTTP API、`mcp.toml` 约定及与 **promptpile** 的衔接方式。实现以本文为准；[`README.md`](./README.md) 中的简略说明指向此处。

**集成策略（选定）**：不改 [`packages/promptpile`](../promptpile/) 核心逻辑，通过 **常驻 HTTP 网关 + 预生成 `.tools.toml` + 离线执行 tool calls** 完成 MCP 集成（对应 README「方案 2」的演进形态：由「每次 spawn MCP」改为「网关进程持有 MCP 会话」，客户端命令仅通过 HTTP 与网关交互）。

---

## 1. 背景与目标

| 组件 | 职责 |
|------|------|
| **promptpile** | 组装消息目录、`loadTools()`、可选 `mergeSearchToolsPack`，调用单次 `chat/completions`；**不执行**工具；工具轨迹见 **`[idx]assistant.calls.jsonl`**（continue）与 **`[idx]assistant.result.jsonl`**，以及 **`-o`** 主输出旁的 **`{basename}.calls.jsonl`**（见 [`after-hook.ts`](../promptpile/src/after-hook.ts)）。二者后缀同为 `.calls.jsonl`，通过文件名模式区分。 |
| **promptpile-mcp** | 将 MCP `tools/list` 映射为 OpenAI function 形态；可选通过 MCP `tools/call` 执行模型产生的调用；**不修改 promptpile 源码**。 |

**OpenAI 工具条目形状**（与 [`tools-loader.ts`](../promptpile/src/tools-loader.ts) 一致）：

```json
{
  "type": "function",
  "function": {
    "name": "<string>",
    "description": "<string>",
    "parameters": { }
  }
}
```

其中 `parameters` 来自 MCP 工具的 **`inputSchema`**（JSON Schema 对象）。

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  launch（常驻进程）                                           │
│  · 读取 mcp.toml，按 server 建立 stdio MCP 客户端与会话        │
│  · 监听 HTTP（仅本机），对外暴露「导出工具列表」「执行调用」等   │
└─────────────────────────────────────────────────────────────┘
          ▲ HTTP                           ▲ HTTP
          │                                │
   export-tools                      exec-calls
   （一次性 CLI）                    （一次性 CLI）
          │                                │
          ▼                                ▼
   写入 .tools.toml                  扫描目录下 *.calls.jsonl
                                     → tools/call → 写 result 等
```

**会话含义**：每个 MCP server 在网关进程内对应 **一条长期 JSON-RPC 会话**（`initialize` 已完成，可重复 `tools/list` / `tools/call`）。网关进程退出即会话结束；**export-tools** / **exec-calls** 为短生命周期客户端，仅发起 HTTP 请求。

**设计动机**：

- 避免每次导出或执行都重新 `spawn`、握手，降低延迟。
- CLI 与网关解耦：`export-tools` / `exec-calls` 可在 CI、after-hook、脚本中调用，仅需 `--base-url`。

---

## 3. CLI 规格

### 3.1 `launch`

**作用**：加载 `mcp.toml`，拉起各 MCP server 子进程并完成握手，启动 **HTTP 网关**。

**参数（拟定）**：

| 参数 | 必填 | 说明 |
|------|------|------|
| `--config <path>` | 是* | `mcp.toml`（或 `.mcp.json`）路径。*可通过环境变量提供，见 README。 |
| `--port <n>` | 否 | 监听端口；与配置文件合并时用优先级规则。 |
| `--token <secret>` | 否 | 启用 HTTP 鉴权时的密钥；与配置文件合并时用优先级规则。 |

**配置来源优先级（全局约定）**：

- **`port`**、**`token`** 均可出现在 **`mcp.toml`** 与 **命令行**。
- **命令行优先于 `mcp.toml`**：同名项冲突时采用命令行，**不视为配置错误**。
- **`port`**：**合并后必须存在合法端口**，否则启动失败并退出。
- **`token`**：**可选**。若合并后未设置 `token`，HTTP API **不校验** `Authorization`。若已设置，则对需保护的路由要求 `Authorization: Bearer <token>`。

**错误条件**：

- 合并后仍无法得到 **`port`** → 报错退出。
- 监听失败（如 **端口已被占用 / EADDRINUSE**）→ 报错退出。

**HTTP 绑定**：默认仅 **`127.0.0.1`**（或等价「本机回环」），不向局域网暴露。

**配置路径**：可与 README 一致支持 `MCP_CONFIG`、默认探测路径；**优先级**：`launch` 的 `--config` > `MCP_CONFIG` > 默认文件名（实现阶段固定枚举）。

---

### 3.2 `export-tools`

**作用**：请求 **launch** 网关，获取当前 MCP 工具列表的 OpenAI 映射，写入 **promptpile** 可用的 `.tools.toml`（或兼容格式）。

| 参数 | 必填 | 默认值 |
|------|------|--------|
| `--base-url <http://…>` | **是** | — |
| `--output <path>` / `-o` | 否 | **当前工作目录**下的 `.tools.toml`（即相对于 `process.cwd()` 的 `.tools.toml`） |
| `--token <secret>` | 否 | 未设置则不发送 `Authorization`；若网关启用了 token，须与 **`launch`** 侧 `[gateway].token`（或 CLI）一致，请求 **`GET /v1/tools/export`** 时带 **`Authorization: Bearer <token>`** |

**说明**：默认输出路径依赖 **调用时的 cwd**，不是「消息目录」或「扫描根」；跨目录使用时请显式传入 `-o`。

**实现**：对 **`GET /v1/tools/export`** 发起请求（可选 **`Authorization: Bearer`**），将响应中的嵌套 `tools[]` 转为 promptpile 所需的 **扁平** `tools` 数组并 **`stringify` 为 `.tools.toml`**（逻辑见 [`src/export/`](./src/export/)）。

---

### 3.3 `exec-calls`

**作用**：请求 **launch** 网关，解析 **`tool_calls`**（JSONL），通过 MCP `tools/call` 执行，并按 §6 约定写回 **`stem.result.jsonl`**。

**两种模式（互斥）**：

- **目录模式**（未提供 **`--input`**）：递归扫描 **`--dir`** 下所有 **`*.calls.jsonl`**；未指定 **`--dir`** 时与历史行为一致，根目录为 **`process.cwd()`**。
- **单文件模式**（提供 **`--input <path>`**）：只处理该文件；须为有效 **`.calls.jsonl`**（去掉后缀后 stem 非空）。**`--output`** 可选：省略时输出为 **`resultAbsPathForCallFile(input, stem)`**（与目录模式配对规则相同）；指定则为该路径写入。**不能与 `--dir` 同时出现**；单独使用 **`--output`** 而无 **`--input`** → 报错退出。

| 参数 | 必填 | 默认值 |
|------|------|--------|
| `--base-url <http://…>` | **是** | — |
| `--dir <path>` | 否 | **目录模式**：未指定时为 **`process.cwd()`**；**单文件模式下禁止使用** |
| `--input <path>` | 否 | **单文件模式**：一个 `.calls.jsonl`；与 **`--dir` 互斥** |
| `--output <path>` | 否 | **仅单文件模式**：result 输出路径；省略则默认同目录 **`stem.result.jsonl`** |
| `--token <secret>` | 否 | 未设置则不发送 `Authorization`；若网关启用了 token，请求 **`POST /v1/calls/exec`** 时带 **`Authorization: Bearer <token>`** |
| `--overwrite-results` | 否 | 未设置则**仅处理尚无**目标 result；设置后**覆盖**已有 result |

可选后续扩展：`--pattern`、`--concurrency`、`--fail-fast` 等；首版可固定「递归或非递归」策略并在实现与文档中写死。

---

## 4. `mcp.toml` 配置

与生态对齐，至少包含 **`servers`** 映射；可选用 **`[gateway]`**（或顶层键）描述网关自身 **`port`** / **`token`**。

**解析约定（实现见 `readMcpConfig`）**：

- **`version`**：可选，缺省为 **1**。非 **1** 时 **`console.warn`**（未来 schema）。须为正整数。
- **`[gateway].port`**：可为 **整数**、**有限数字**（向下取整）或 **纯数字字符串**（如 JSON 中的 `"8765"`）；范围 **1–65535**，非法则 **`launch` 读配置失败**。
- **`[behavior].failure_policy`**：仅允许 **`strict`** 或 **`best-effort`**；其它值报错。
- **`[servers.*].transport`**：可选；仅支持 **`stdio`**（缺省即 stdio）；**`http`** 等键入即报错（尚未实现）。
- **`[servers.*].env`**：值为 **`string` / `number` / `boolean`** 时分别写入子进程环境（数字与布尔会转为字符串）；其它类型跳过并 **`console.warn`**。

### 4.1 建议形状（TOML）

```toml
version = 1

[gateway]
# 可被 launch 的 --port / --token 覆盖
port = 8765
# token = "optional-shared-secret"

[defaults]
init_timeout_ms = 30000
list_timeout_ms = 30000

[behavior]
failure_policy = "best-effort"  # strict | best-effort
flat_names = false              # true 时不加 mcp__<id>__ 前缀（不推荐默认开启）

[servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
# env = { KEY = "value" }
# cwd = "/project"
```

### 4.2 每个 server 条目

| 字段 | 说明 |
|------|------|
| `command` | stdio 可执行文件 |
| `args` | 字符串数组 |
| `env` | 可选，键值表 |
| `cwd` | 可选，子进程工作目录 |
| `init_timeout_ms` / `list_timeout_ms` | 可选；可继承 `[defaults]` |
| `transport` | 可选；仅 **`stdio`**（缺省）；其它取值当前报错 |

首版传输类型仅 **stdio**；解析层预留拒绝未知 **`transport`**，避免静默走错后端。

### 4.3 MCP server 失败策略

| 模式 | 行为 |
|------|------|
| **strict** | 任一 server `initialize` / `tools/list` 失败 → **launch 启动失败**（或网关标记不可用，实现二选一，建议启动阶段即失败）。 |
| **best-effort** | 失败 server 跳过并记录日志；至少一个 server 成功则网关可用；导出/执行时仅针对健康 server。 |

---

## 5. HTTP API（网关）

以下路径与动词为 **拟定契约**；实现时可微调，但 **`export-tools` / `exec-calls` 客户端必须与网关同步**。

### 5.1 通用约定

- **Content-Type**：`application/json`（除纯文本导出外）。
- **鉴权**：若 launch 配置了 `token`，除明确豁免的路由外，请求需带：  
  `Authorization: Bearer <token>`
- **豁免**：例如 `GET /health` 可不校验，便于进程探活（可选：健康检查也可要求 token，由实现统一策略并在本文更新）。

### 5.2 建议路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 存活检测；可返回各 MCP server 是否已连接。 |
| **`GET`** | **`/v1/tools/export`** | **固定使用 GET**（幂等、无副作用）。聚合所有已连接 server 的 `tools/list`，映射为 OpenAI `tools[]`；响应 JSON **`{ "tools": [ … ], "warnings"?: string[] }`**，由 `export-tools` CLI 再转为 `.tools.toml`。网关实现：**Koa**（[`src/http`](./src/http/)）。若 **`mcp.toml`** 含 **`[servers.*]`**，后端为 **`createMcpGatewayBackend`**（[`mcp-backend.ts`](./src/http/mcp-backend.ts)）；**无 `servers`** 时为 **stub**（空 `tools`）。 |
| `POST` | `/v1/calls/exec` | **请求体**包含单条或多条 tool call（由 exec-calls 本地读取 `.calls.jsonl` 后批量 POST）；**响应**为每条 call 的执行结果。 |

**exec-calls 与 HTTP 的分工**：

- **推荐**：`exec-calls` 在本地 **目录模式**扫描 **`--dir`**、或 **单文件模式**读取 **`--input`**，将记录批量 **POST** 到 `/v1/calls/exec`；网关在进程内路由到对应 MCP server 的 `tools/call`，返回结构化结果；**`exec-calls` 负责将结果写回** **`stem.result.jsonl`**（配对规则见 §6；单文件时可由 **`--output`** 覆盖路径）。
- 备选：网关接受「文件路径」由服务端读盘——**不推荐**（网关与客户端文件系统耦合、远程时不成立）。

### 5.3 工具命名路由

网关必须实现与 **§7** 一致的 **`function.name` → (serverId, mcpToolName)** 解析，以便 `tools/call` 发往正确 server。

---

## 6. `.calls.jsonl` 与结果文件

### 6.1 扫描范围与配对

- **单文件模式**：**`--input`** 指向单个 **`.calls.jsonl`**；输出为 **`--output`** 或默认同目录 **`stem.result.jsonl`**（与下述配对公式一致）。**`--input` 与 `--dir` 互斥**。
- **目录模式**：**根路径** `exec-calls --dir`（未指定时为 **`cwd`**），**递归**枚举文件。
- **匹配**：basename 以 **`.calls.jsonl`** 结尾（整段后缀；勿用 `path.parse` 以免 `foo.calls.jsonl` 被误切成 `foo.calls`）。
- **配对**：**`stem`** = basename 去掉 **`.calls.jsonl`**；同目录输出 **`stem + '.result.jsonl'`**。例：**`[0]assistant.calls.jsonl`** → **`[0]assistant.result.jsonl`**；**`out.calls.jsonl`** → **`out.result.jsonl`**。
- **非法名**：**`.calls.jsonl`**（空 stem）跳过并向 **stderr** 警告。
- **默认处理范围**：若已存在配对的 **`stem.result.jsonl`**，**默认跳过**该 calls 文件（**exit 0** 当全部被跳过）；**`--overwrite-results`** 时对所有匹配的 **`*.calls.jsonl`** 执行并**覆盖**已有 result。
- **扫描范围变宽**：`-o` 主输出旁的 **`{basename}.calls.jsonl`** 若落在 **`--dir`** 下也会被处理并生成 **`{basename}.result.jsonl`**；该文件**不会自动进入** promptpile 消息目录，除非用户自行拷入；消息回放仍以目录内 **`[idx]assistant.*`** 约定为准。

### 6.2 每行内容

需与 promptpile 写出的 **`tool_calls`** 条目兼容（与仓库示例 `execute-tool-call.ts` 一致）：包含 `id`、`type`、`function.name`、`function.arguments`（字符串 JSON）。

### 6.3 写回

执行成功后写入配对 **`stem.result.jsonl`**（每行与 promptpile 的 `ToolResultLine` 对齐）；失败策略：**逐条记录错误**、可选 **`--fail-fast`** 使整个 `exec-calls` 非零退出。

---

## 7. 工具命名与去重

- **默认**：`mcp__<serverId>__<toolName>`，其中 `serverId` 为 `mcp.toml` 中 `[servers.<id>]` 的表键，`toolName` 为 MCP 返回的工具名。
- **分隔规则**：前缀固定为 **`mcp__`**；接着取 **`serverId`**，再 **`__`**，余下全部为 **`toolName`**（`toolName` 可含 `_` 或子串 `__`）。因此 **`[servers.<id>]` 表键不得包含子串 `__`**，且实现上仅允许 **`[A-Za-z0-9_-]+`**，否则无法与网关反解析一致（见 `validateServerId`）。
- **`flat_names: true`**（仅受控环境）：OpenAI `function.name` 等于 MCP 工具名；多 server 下同名工具会 **歧义**（`ambiguous_tool`）。若某次调用仍使用前缀形式（例如切换配置前的 `.calls.jsonl`），网关在 **flat 命中失败** 且名称以 **`mcp__`** 开头时，可 **再尝试** 按前缀规则解析（实现默认值）。
- **`flat_names: false`**：`function.name` **必须** 为上述前缀形式，否则 **`invalid_tool_name`**。

导出至 `.tools.toml` 时，名称规则须与 **exec-calls** 解析规则 **完全一致**。

---

## 8. 与 promptpile 工作流衔接

1. **启动网关**：`promptpile-mcp launch --config mcp.toml …`
2. **生成工具文件**：`promptpile-mcp export-tools --base-url http://127.0.0.1:<port> [-o .tools.toml]`
3. **运行补全**：`promptpile --tools-file .tools.toml …`（或 `TOOLS_FILE`）
4. **执行工具**（模型返回 `tool_calls` 后）：`promptpile-mcp exec-calls --base-url http://127.0.0.1:<port> [--dir <消息或项目根>]` 或 `exec-calls --base-url … --input <路径.calls.jsonl> [--output <路径.result.jsonl>]`

**After-hook**：可在 `.after-hook.sh` 等脚本中调用 `exec-calls`，环境变量可使用 `PROMPTPILE_CALLS_FILE`、`PROMPTPILE_SCAN_DIRECTORY`（见 `buildPromptpileHookEnv`），将 `base-url` 写死或通过环境变量传入。

---

## 9. 安全

| 风险 | 缓解 |
|------|------|
| `mcp.toml` 中的 `command` / `args` | 等同本机用户执行任意程序；仅使用可信配置，勿提交含密钥的 `env`。 |
| HTTP 网关 | 绑定 **127.0.0.1**；生产或共享机器上建议配置 **`token`**。 |
| 含密钥的 `token` / `env` | 不提交版本库；可选 `.gitignore`。 |

---

## 10. 非目标与后续

| 项目 | 说明 |
|------|------|
| **方案 1** | 在 promptpile 进程内 `mergeMcpToolsPack` **当前不采用**；若未来需要「单命令直连 MCP」，另起 EPIC。 |
| **TLS / 远程网关** | **launch** 监听 **`127.0.0.1`**；跨机暴露需后续 TLS、绑定策略与鉴权硬化。 |
| **传输类型** | **已实现**：按 **`mcp.toml` `[servers.*]`** 启动 **stdio** MCP 子进程（`@modelcontextprotocol/sdk`）。**未实现**：以 HTTP/SSE 连接「远端 MCP server」作为客户端传输（与网关 HTTP 监听是两回事）；若需要可在配置中扩展 `transport` 后再开发。 |

---

## 11. 文档修订记录

- 初版：三命令定名为 **`launch`**、**`export-tools`**、**`exec-calls`**；launch 的 `port` / `token` 合并规则；export / exec 的默认路径；HTTP 网关架构。
- **`exec-calls` 首版**：仅处理 **`[N]assistant.calls.jsonl`**（与 promptpile continue 侧文件名一致；与 **`-o`** 旁 **`{basename}.calls.jsonl`** 通过 **`^\[(\d+)\]assistant\.calls\.jsonl$`** 模式区分）；写 **`[N]assistant.result.jsonl`**；其它 **`*.calls.jsonl`** 跳过并 stderr 提示。
- **continue 文件名**：**`[N]assistant.call.jsonl`** 统一重命名为 **`[N]assistant.calls.jsonl`**（破坏性变更；旧名不再识别）。
- **`exec-calls` 配对 generalized**：任意 **`*.calls.jsonl`** → 同目录 **`stem.result.jsonl`**；默认跳过已有 result；**`--overwrite-results`** 覆盖。
- **`exec-calls` 单文件模式**：新增 **`--input`** / **`--output`**；与 **`--dir`** 互斥。
- **结项**：**`package.json`** 升至 **0.1.0**；**DESIGN §10** 区分「stdio 已实现」与「远端 HTTP MCP 客户端未实现」；**after-hook** 示例见 **`docs/after-hook.example.sh`**。
