# promptpile

将目录中的 Markdown / JSON 片段按顺序组装成 **OpenAI Chat Completions** 所需的消息列表（可选 `tools`、历史 `tool_calls` / `tool`），调用大模型 API 并输出回复。适合用「一个文件一条消息」的方式维护多轮对话上下文，再由命令行一键发起单次补全请求。

---

## 目录

- [功能概览](#功能概览)
- [工作原理](#工作原理)
- [环境要求](#环境要求)
- [安装](#安装)
- [消息文件约定（重要）](#消息文件约定重要)
- [工具定义与历史工具调用（`.tools.toml` / `assistant.calls` / `assistant.result`）](#工具定义与历史工具调用toolstoml--assistantcalls--assistantresult)
- [配置说明](#配置说明)
- [命令行用法](#命令行用法)
- [输出格式](#输出格式)
- [完成后钩子（after-hook）](#完成后钩子after-hook)
- [与 OpenAI 兼容的网关](#与-openai-兼容的网关)
- [开发](#开发)
- [项目结构](#项目结构)
- [安全与隐私](#安全与隐私)
- [常见问题与排查](#常见问题与排查)
- [许可证](#许可证)

---

## 功能概览

- **递归扫描**指定目录下所有符合命名规则的 `.md`、`.json`，以及可选的 `[idx]assistant.calls.jsonl` / `[idx]assistant.extra.json` / `[idx]assistant.result.jsonl`。
- **工具**：仅支持 **显式** 的 **`.toml`** 工具文件路径（`--tools-file` / `TOOLS_FILE` / 配置中的 `tools_file`），支持根表 **`extends`** 继承其它 toml；或使用 **`--disable-tool`** 不传 `tools`。不再支持 `.jsonl` 工具文件，也不在消息目录自动探测默认工具文件。
- 按文件名中的 **序号** 与 **固定规则** 排序，拼成 Chat Completions 所需的 `messages`（含可选的 `tool_calls` 与 `tool` 消息）。
- 通过 **`node-fetch`** 向兼容端点发起 `POST .../chat/completions` 请求（可选 `stream`）。
- 模型若返回 **工具调用**，可在启用 `-o` 时一并写入 **`{basename}.calls.jsonl`**；`text` 模式下在正文流结束后向 stdout 逐行打印每条调用（JSON）；`json` 模式下工具调用出现在 stdout 的 **`tool_calls` 字段**中（`--quiet` 时均不打印终端输出，但若配置了 `-o` 仍写入文件）。
- 可选在 **本轮成功结束**（含写 `-o`、`.calls.jsonl` 与可选 `--continue` 落盘）之后执行 **after-hook** 脚本（见 [完成后钩子](#完成后钩子after-hook)）。
- 支持通过 **环境变量** 与 **命令行参数** 配置目录、模型、API Key、Base URL、输出格式。
- 支持 **JSON** 或 **纯文本** 两种控制台输出，便于脚本集成或人工阅读。

**本工具不执行工具函数**；不生成 `[idx]assistant.result.jsonl`，仅规定格式并在拼消息时读取。单次运行仍为 **一次** Chat Completions 请求（不自动根据工具结果发起第二轮请求）。

---

## 工作原理

1. 解析 CLI、`--config` TOML、cwd/扫描目录 `.env` 与 `process.env` 合并为最终配置（见 [配置说明](#配置说明)）。
2. 校验 **API Key** 是否存在；不存在则退出并提示错误。
3. 若配置了 `-o` / `OUTPUT_FILE`，在发起请求前 **创建输出目录并校验可写**；失败则退出且不调用 API。
4. 按 [工具文件解析规则](#工具定义与历史工具调用toolstoml--assistantcalls--assistantresult) 解析 `tools`（**仅**显式 `.toml`，可含 `extends`）；**在调用 API 之前**完成校验，非法则退出；`--disable-tool` 时请求体中 **省略** `tools` 字段。
5. 从配置的 `directory` 开始 **深度优先**遍历子目录，收集：
   - `^\[(\d+)\](.+?)\.(md|json)$`（扩展名不区分大小写）；
   - `^\[(\d+)\]assistant\.call\.jsonl$`、`^\[(\d+)\]assistant\.result\.jsonl$`。
6. 按序号 **升序** 组装 `messages`：先将扫描到的所有文件按 **序号分组**（同一序号、不同子目录下的文件会进入 **同一组**），再在组内按固定顺序拼消息（见下节「序号与同一序号内的顺序」与 [工具章节](#工具定义与历史工具调用toolstoml--assistantcalls--assistantresult)）。
7. 若指定 **`insert_files` / `append_files`**（CLI：`--insert-files`、`--append-files`；TOML / 环境变量见下表）：从各路径读取 **UTF-8** sidecar 文件（**相对路径相对当前工作目录**，与 `--tools-file` 一致）。多个路径用 **`|`** 分隔。每个文件的 **basename** 必须为 **`{name}.{role}.md`**（`name` 可含点，如 `react.core.system.md` → `role=system`）；`role` 仅允许 `system`、`user`、`assistant`。去除 BOM；`.md` 去 YAML front matter；trim 后 **仅空白** 则跳过该条。`insert_files` 按列表顺序 **插在** 扫描目录组装的 `messages` **之前**；`append_files` **追加在之后**。每条 sidecar 对应 **独立** 一条 API 消息（不与 `[idx]system.md` 合并）。文件不存在、不可读或命名非法则 **退出并报错**。sidecar 文件 **不会** 被 `scanDirectory` 当作 `[idx]role.md` 扫描。
8. 合并 **`temperature`**（与 `llm_api_model` 同链：`llm_api_temperature` / `PROMPTPILE_LLM_API_TEMPERATURE` / `--temperature` / `[[llm_api]].temperature`）；各层均未设置时 **默认 `0.8`**，并写入请求体。
9. 合并可选 **`extra_body`**（同链：`llm_api_extra_body` / `PROMPTPILE_LLM_API_EXTRA_BODY` / `--extra-body` / `[[llm_api]].extra_body`）；TOML 为内联表，env/CLI 为 JSON 对象字符串；各层均未设置时不写入；合并后浅展开进请求体（可覆盖 `temperature` 等字段）。
10. 使用 `fetch`（来自 `node-fetch` v2）请求 `{baseURL}/chat/completions`。`text` 模式使用 **`stream: true`**，正文来自流式 `delta.content`，流结束后合并 **`delta.tool_calls`**；`json` 模式使用 **`stream: false`**，读取 **`choices[0].message.content`** 与 **`message.tool_calls`**。

普通消息的 **角色名** 会原样作为 `role` 传给 API。除 `tool` 外请使用网关接受的 role（常见为 `system`、`user`、`assistant`）。`tool` 消息来自 `[idx]assistant.result.jsonl` 的各行；若存在 **`[idx]assistant.calls.jsonl`** 但某 `tool_call_id` 在 result 中无对应行（或缺少 result 文件），程序会 **合成** 一条 `tool` 消息，其 `content` 为固定中文错误句（见下节 **「`[idx]assistant.result.jsonl`」** 中「与 continue 侧 call 文件对齐」说明）。

---

## 环境要求

- **Node.js**：建议 **18+**（与当前 `@types/node` 及本地开发方式一致即可）。
- 依赖 **`node-fetch` v2**（CommonJS）；请求实现见 `src/ai-client.ts`。
- 可访问大模型 API 的网络环境（或自建兼容网关）。

---

## 安装

在包目录内：

```bash
cd packages/promptpile
npm install
```

全局安装本包（若仓库以 workspace 发布，请按你实际的 monorepo 方式安装）：

```bash
npm install -g .
```

本地开发推荐使用 `npm link`：

```bash
cd packages/promptpile
npm link
promptpile --help
```

安装后若 `promptpile` 命令不可用，可直接使用：

```bash
node dist/index.js --help
# 或
npm start -- --help
```

> **说明**：`package.json` 的 `bin` 指向 `dist/index.js`，并通过 `prepare` 自动构建可执行产物。若终端里仍找不到命令，请检查全局 npm bin 目录是否在 PATH 中。

---

## 消息文件约定（重要）

### 文件名格式

普通消息文件必须严格匹配（正则）：

```text
^\[(\d+)\](.+?)\.(md|json)$
```

即：

- 以 **`[` + 数字 + `]`** 开头，表示排序序号；
- 紧跟 **角色名**（将作为 API 的 `role`）；
- 扩展名为 **`.md`** 或 **`.json`**。

此外（递归扫描任意子目录，与上类文件相同）还可匹配 **助手工具专用** 文件名：

```text
^\[(\d+)\]assistant\.call\.jsonl$
^\[(\d+)\]assistant\.result\.jsonl$
```

消息目录 **不再**自动加载工具文件；必须通过 **`--tools-file`**、**`TOOLS_FILE`**（或应用配置中的 `tools_file`）显式指定 **`.toml`** 路径，或使用 **`--disable-tool`**。工具文件 **不会** 被算进「消息文件」条数，也不参与序号排序。

### 示例（普通消息）

| 文件名 | 序号 | role | 说明 |
|--------|------|------|------|
| `[0]system.md` | 0 | `system` | 系统提示 |
| `[1]user.md` | 1 | `user` | 用户消息 |
| `[2]assistant.md` | 2 | `assistant` | 助手历史回复（可选） |
| `[3]user.md` | 3 | `user` | 下一轮用户输入 |
| `[4]user.json` | 4 | `user` | 整条消息为 JSON 文件原文（字符串），不解析字段 |

### 文件内容

- **Markdown（`.md`）**：若文件以 YAML front matter 开头（首行为 `---`，之后某一行单独为 `---` 闭合），则 **仅去掉该元数据块**，剩余正文作为 `content`；否则全文作为 `content`。正文**不会**再解析为 Markdown AST；模型看到的是纯文本。
- **JSON（`.json`）**：**完整文件内容**（UTF-8）作为 `content`，不按 JSON 结构抽取字段。
- 子目录中的匹配文件 **同样会被扫描**。全局先按文件名中的 **序号升序**；**同一序号**无论是否在同一子目录，都会 **合并为一组** 再按「同一序号内的顺序」规则处理（组内再按 `tier` + `role` + 路径排序，见 `src/file-handler.ts`）。

### 序号与同一序号内的顺序

- 排序键为文件名中的整数 **升序**。
- **同一序号**内顺序固定为：
  1. **`[idx]{role}.md` / `.json`**，但 **不含** `[idx]assistant.md` — 多条时先按 `role` 名字典序，再按路径；
  2. **`[idx]assistant.md`**（助手纯文本，若有）；
  3. **`[idx]assistant.calls.jsonl`**（该轮 `tool_calls`，若有）；
  4. **`[idx]assistant.extra.json`**（该轮 `reasoning_content`，若有；与 calls 合并进同一条 assistant 消息）；
  5. **`[idx]assistant.result.jsonl`**（`tool` 消息行，若有）。

这样可与 OpenAI 要求一致：**`tool` 消息紧跟在带对应 `tool_calls` 的 `assistant` 消息之后**。

若目录下没有任何匹配文件，程序会报错退出。

---

## 工具定义与历史工具调用（`.tools.toml` / `assistant.calls` / `assistant.result`）

### 破坏性变更（工具）

- **仅支持 `.toml`** 作为工具定义文件（不再支持 `.tools.jsonl` / `*.jsonl` 作为工具源）。
- **不再**在扫描目录根自动探测 `.tools.toml` / `.tools.jsonl`；必须通过 **`--tools-file`**、**`TOOLS_FILE`** 或应用 TOML / `.env` 中的 **`tools_file`** 等 **显式**给出路径，或使用 **`--disable-tool`**。
- 工具 TOML 根表支持 **`extends`**（字符串或字符串数组），路径相对 **当前该 toml 文件所在目录**；**环检测**；**最大递归深度 32**（根文件深度为 0）。

### 工具文件来源与优先级

| 来源 | 含义 | 相对路径解析基准 |
|------|------|------------------|
| CLI `--tools-file <path>` | 入口 `.toml`（可含 `extends`） | **`process.cwd()`** |
| `TOOLS_FILE` / 配置中的 `tools_file` | 同上 | **扫描目录根**（`-d` 解析后的绝对路径） |

**优先级**：**`--tools-file`** > **`TOOLS_FILE`** / 配置合并结果。

未使用 **`--disable-tool`** 且 **未**提供上述任一显式路径时，程序在调用 API **之前**报错退出。

**`--disable-tool`**：不加载工具文件；请求体中 **不传** `tools`。与 **`--tools-file`** 同时出现时以 **`--disable-tool` 为准**（不解析工具路径）。历史消息中的 `tool_calls` / `tool` 仍按文件照常拼入 `messages`。

显式路径指向的文件 **必须存在** 且扩展名为 **`.toml`**。

### `extends` 与合并顺序

- **`extends`**：根表字段；值为单个字符串，或字符串数组；每个路径相对 **本文件所在目录** `path.dirname(当前 toml)` 解析为绝对路径后再加载。
- **深度优先**：每个 `extends` 目标会先完整解析其自身的 `extends` 链，再合并该文件中的 **`tools`**；同一文件内 **`extends` 列表从左到右** 合并子图，同一 `function.name` **后者覆盖前者**。
- **当前文件**：所有 `extends` 子图合并完成后，再合并根表的 **`tools`**；与下层同名时 **以当前文件为准**。
- **环**：若某绝对路径在递归栈中再次出现 → 报错退出。
- **深度**：进入下一层 `extends` 时深度 +1；**深度大于 32** 时报错退出。
- **`tools` 键**：可省略或为空数组；可仅通过 `extends` 聚合工具。

解析成功后，发给 API 的 `tools` **仅**来自上述 toml 合并结果（与 `function.name` 去重规则见 `extends` 一节）；未产生任何工具条目时，请求体中可不传 `tools`。

### 工具条目的扁平形状（`[[tools]]`）

每个工具条目按 **扁平形状** 书写，**不需要** `type = "function"`，**不需要** `tools.function` 嵌套表：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | 非空字符串 | 是 | 函数名（OpenAI `tools[].function.name`） |
| `description` | 字符串 | 否 | 函数说明（OpenAI `tools[].function.description`） |
| `parameters` | 对象 **或** JSON 字符串 | 否 | JSON Schema（OpenAI `tools[].function.parameters`）；若为字符串，promptpile 会自动 `JSON.parse` |

promptpile 内部会把每个条目自动包成 OpenAI 请求体所需的 `{ "type": "function", "function": { ... } }` 形状再传给 API。

**显式 `type` / `function` 顶层字段会被拒绝**（旧版的嵌套写法不再兼容）；如要扩展非 `function` 工具，需要后续版本另行支持。

### 工具 `.toml` 示例（含 `extends`）

```toml
extends = ["./common-tools.toml"]

[[tools]]
name = "get_weather"
description = "Get weather"
parameters = '{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}'
```

`./common-tools.toml` 相对于 **本文件所在目录** 解析。

### `[idx]assistant.extra.json`（历史：thinking 模型的 `reasoning_content`）

与 **`{basename}.extra.json`**（**`-o`** 主输出旁）规则不同：此处为 **`--continue`** 落盘的 **`^\[(\d+)\]assistant\.extra\.json$`** 文件。

用于回放 DeepSeek 等 **thinking 模式**下 assistant 必须回传的 **`reasoning_content`**。整文件为 **单个 JSON 对象**：

```json
{
  "reasoning_content": "模型内部推理全文……"
}
```

- 仅当 API 返回非空 `reasoning_content` 且启用 **`--continue`** 时自动写入；与 **`[N]assistant.md`**、**`[N]assistant.calls.jsonl`** 可 **共存于同一 `N`**。
- 下一轮 `buildMessages` 会将其合并进同序号的 **一条** `{ role: 'assistant', content?, tool_calls?, reasoning_content }` 再发给 API。
- 若历史 assistant 在 thinking 模型下缺少该文件，网关可能返回 **400**（例如 DeepSeek：`reasoning_content` must be passed back）。可 **手写** 此文件修复，或清空相关轮次后重跑。
- 扫描时 **优先于** 通用 `[idx]{role}.json` 规则匹配，避免被误当作 `role=assistant.extra` 的普通消息。

### `[idx]assistant.calls.jsonl`（历史：该轮助手的 `tool_calls`）

与 **`{basename}.calls.jsonl`**（**`-o`** 主输出旁）后缀相同但规则不同：此处为 **`--continue`** 落盘的 **`^\[(\d+)\]assistant\.calls\.jsonl$`** 文件。

用于回放或人工构造「模型曾发起的工具调用」。整文件解析为 **`tool_calls` 数组**（OpenAI 形态：`id`、`type`、`function.name`、`function.arguments`）。支持：

- 单个 JSON 对象，且含 **`tool_calls`** 数组；
- 根级 JSON **数组**（即为 `tool_calls`）；
- **JSONL**：每行一个完整 tool call 对象。

解析得到 **非空** `tool_calls` 时，才会追加一条 **`role: "assistant"`** 且 **`content` 为 `null`**、带 `tool_calls` 的消息。若文件为空、无法解析或解析后 **没有任何有效 tool call**（例如 `normalizeToolCalls` 过滤后为空），则 **不会** 追加该条 assistant 消息（可与同序号的 `[idx]assistant.md` 搭配：先文本助手消息，再带 `tool_calls` 的助手消息）。

### `[idx]assistant.result.jsonl`（历史：工具返回给模型的内容）

**本程序不创建或更新此文件**；由你或其它工具生成。每行一个 JSON 对象，字段至少包括：

- **`tool_call_id`**（字符串，与 `call` 中一致）
- **`content`**（字符串，传给模型的工具结果正文）

可选：**`name`**（若网关要求 `tool` 消息带名称可填写）。

示例一行：

```json
{"tool_call_id":"call_abc123","content":"{\"temperature\":22}","name":"get_weather"}
```

当同一序号存在 **`[idx]assistant.calls.jsonl`** 且解析出非空 `tool_calls` 时，按 call 中的 `tool_call_id` **顺序** 生成 `tool` 消息；若某 id 在 result 中 **缺失**，则该条 `content` 为 **固定中文句式**（与 `src/types.ts` 中 `formatMissingToolResultContent` 一致），模板为：

```text
错误：未在 [idx]assistant.result.jsonl 中找到 tool_call_id=<toolCallId>
```

示例（序号为 `2`、缺失的 id 为 `call_abc123`）：

```text
错误：未在 [2]assistant.result.jsonl 中找到 tool_call_id=call_abc123
```

若 **仅有 `[idx]assistant.calls.jsonl` 而无 `assistant.result` 文件**，则对 **每个** `tool_call_id` 均使用上述合成 `content`。

若 **仅有 result 而无 call**（或 call 解析结果为空），则按 result 文件中的行顺序逐条追加 `tool` 消息（**不与** call 做 id 对齐）。

### 本次 API 响应中的工具调用与 `{basename}.calls.jsonl`

- 当模型在 **当前轮** 返回 `tool_calls` 时：
  - **`text` 模式**：正文仍流式输出；流 **结束后**，将每条工具调用以 **一行一个 JSON** 打印到 stdout（与写入 `.calls.jsonl` 的序列化一致）。
  - **`json` 模式**：在 stdout 打印 **单个** JSON 对象：`{"response":"...","tool_calls":[...]}`（无 `tool_calls` 时为 `null`）。
  - **`--quiet`**：不向 stdout 打印正文与上述工具行，但若配置了 **`-o`**，仍会写入 **主输出文件** 与 **`{basename}.calls.jsonl`**（若存在工具调用）。
- **`{basename}.calls.jsonl`**：仅当使用 **`-o` / `OUTPUT_FILE`** 指定主输出文件时写入。路径与主输出 **同目录**，文件名为 `path.parse(主输出路径).name + ".calls.jsonl"`。例如主输出为 `out/answer.txt`，则工具调用记录为 `out/answer.calls.jsonl`。若主输出为 `out/x.calls.jsonl`，则工具记录为 `out/x.calls.calls.jsonl`（由 `path.parse` 的 `name` 决定）。
- **`{basename}.extra.json`**：同上规则，当本轮返回非空 **`reasoning_content`** 时写入，内容为 `{"reasoning_content":"..."}` 单对象 JSON；仅作 **`-o` 旁车审计**，下轮历史仍以 **`messages/`** 内 **`[idx]assistant.extra.json`** 为准。

---

## 配置说明

配置按 **优先级从高到低** 合并（同一键：**命令行** 覆盖 **TOML**，再覆盖 **扫描目录 `.env`**，再覆盖 **cwd `.env`**，再覆盖 **`process.env`**，最后为 **内置默认值**）。实现见 `src/resolve-config.ts`。

1. **命令行参数**
2. **`--config <path>` 指定的 TOML**（路径相对 **当前工作目录 cwd**；文件不存在则报错退出。读取 `[promptpile]` 与 `[[llm_api]]`）
3. **扫描目录下的 `.env`**（见下「`dir0` 与扫描目录 `.env`」）
4. **当前工作目录 cwd 下的 `.env`**
5. **`process.env`**
6. **内置默认值**（如 `./messages`、`gpt-3.5-turbo`）

程序 **不会** 在模块加载时用 `dotenv` 改写全局环境；上述 `.env` 文件用 `dotenv.parse` 读入后仅参与合并表。`PROMPTPILE_DEBUG` 仍由代码直接读取 `process.env`。

### `dir0` 与扫描目录下的 `.env`

用于**首次打开**「扫描目录下 `.env`」的路径记为 `dir0`（**不**使用「仅来自该扫描目录 `.env` 文件」内的 `DEFAULT_DIRECTORY` / `PROMPTPILE_DIR` / `dir`，避免自引用）：

`dir0 = path.resolve(cwd, CLI(-d) ?? TOML(dir) ?? cwd .env(DEFAULT_DIRECTORY 或 PROMPTPILE_DIR) ?? process.env(DEFAULT_DIRECTORY 或 PROMPTPILE_DIR) ?? './messages')`

若仅在「扫描目录 `.env`」里修改目录相关键，**不会**改变本次已读取的那份 `dir/.env` 路径；目录决策请放在 cwd、TOML 或 CLI。

### 环境变量

| 变量 | 含义 | 默认值（各层均未设置时） |
|------|------|-------------------------|
| `DEFAULT_DIRECTORY` / `PROMPTPILE_DIR` | 扫描根目录 | `./messages` |
| `AI_MODEL` | 模型名 | `gpt-3.5-turbo` |
| `PROMPTPILE_LLM_API_TEMPERATURE` / `AI_TEMPERATURE` | 采样温度（`0`–`2`），等价 TOML `llm_api_temperature` | `0.8` |
| `PROMPTPILE_LLM_API_EXTRA_BODY` | 额外请求体字段（JSON 对象字符串），等价 TOML `llm_api_extra_body` | 无 |
| `AI_API_KEY` | API 密钥 | 空（必填，否则退出） |
| `AI_API_BASE_URL` | API 根地址 | `https://api.openai.com/v1` |
| `OUTPUT_FILE` | 将模型回复写入文件路径 | 空（默认不写文件） |
| `QUIET` | 静默（`1/true/yes/on` 为真，`0/false` 等为假） | 关闭 |
| `PROMPTPILE_FORMAT` | `text` 或 `json` | `text` |
| `PROMPTPILE_CONTINUE` | 等价 `--continue` | 关闭 |
| `PROMPTPILE_INPUT` | 等价 `--input` | 关闭 |
| `PROMPTPILE_INSERT_FILES` | 等价 `--insert-files`（`\|` 分隔多路径） | 无 |
| `PROMPTPILE_APPEND_FILES` | 等价 `--append-files`（`\|` 分隔多路径） | 无 |
| `PROMPTPILE_DISABLE_TOOL` | 等价 `--disable-tool` | 关闭 |
| `PROMPTPILE_LLM_API_KEY_ENV` | 从**另一环境变量名**解析 API Key（值为变量名） | 无 |
| `PROMPTPILE_DEBUG` | 诊断输出（stderr） | 关闭 |
| `PROMPTPILE_DUMP_LLM` | 每次 Chat Completions 请求在 **cwd** 写入 `{ts}-{rand}.req.json` / `.res.json`（请求体与归一化响应；`Authorization` 脱敏） | 关闭 |
| `PROMPTPILE_DUMP_LLM_TAG` | 写入 dump JSON 的 `tag` 字段（如 `thought` / `observe` / `final`） | 无 |
| `AFTER_HOOK_PATH` | 完成后执行的脚本路径；**相对路径相对扫描目录根** | 空（走 CLI 或默认文件名） |
| `TOOLS_FILE` | **仅**从此路径加载工具 `.toml`（可含 `extends`）；**相对路径相对扫描目录根** | 空（须 `--tools-file` 或本变量或 `PROMPTPILE_TOOLS_FILE` 或 `--disable-tool`） |
| `PROMPTPILE_TOOLS_FILE` | 与 `TOOLS_FILE` 相同语义（扫描目录根相对路径）；二者任填其一即可 | 空 |
| `TOOL_CHOICE` | `tool_choice`（`none` \| `auto` \| `required` \| `function:<name>`） | 未设置时按 `auto` |

### TOML（`--config`）

- **`[promptpile]`**：与 `example.toml` 一致，如 `dir`、`format`、`output`（路径字符串）、`quiet`、`after_hook`、`tool_choice`、`tools_file`、`disable_tool`、`continue`、`input`、`insert_files`、`append_files`、`llm_api`、`llm_api_key`、`llm_api_key_env`、`llm_api_model`、`llm_api_base_url`、`llm_api_temperature`、`llm_api_extra_body`。
- **`[[llm_api]]`**：`name`、`model`、`base_url`、`api_key`、`api_key_env`、`temperature`、`extra_body`；由 `llm_api` 选择 profile 后再应用 `llm_api_*` 覆盖。
- **密钥**：若配置了 `api_key_env` / `llm_api_key_env`，在直写 `api_key` / `llm_api_key` 仍为空时从 `process.env[该变量名]` 读取。

### CLI 参数

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--config <path>` | TOML 配置文件（相对 cwd） | 无 |
| `-d, --directory <path>` | 扫描目录 | 见上合并链 |
| `-m, --model <model>` | 模型 ID | 见上合并链 |
| `-k, --api-key <key>` | API Key | 无 |
| `-b, --api-base-url <url>` | Base URL | 见上合并链 |
| `--temperature <n>` | 采样温度（`0`–`2`）；覆盖 `llm_api_temperature` / profile | `0.8` |
| `--extra-body <json>` | 额外请求体字段（JSON 对象）；覆盖 `llm_api_extra_body` / profile | 无 |
| `-o, --output <path>` | 输出文件路径（保存模型回复） | 无 |
| `-q, --quiet` | 静默模式：不打印过程日志、流式正文、工具调用行；**仍会**写入 `-o` 主文件与 `.calls.jsonl` / `.extra.json`（若存在） | 关闭 |
| `-f, --format <format>` | `text` 或 `json` | 未传则走下层合并，最终默认 `text` |
| `-i, --input` | 在终端读取输入并保存为下一条 `user` 消息后再执行 | 关闭 |
| `-c, --continue` | 将本次 assistant 输出追加为下一条消息文件：有正文则写 `[N]assistant.md`；含 `tool_calls` 则写 `[N]assistant.calls.jsonl`；含 `reasoning_content` 则写 `[N]assistant.extra.json`；三者**可共存**于同一 `N`，下一轮拼请求时会合并为一条 assistant 消息；三者皆无时不写文件 | 关闭 |
| `--tools-file <path>` | 工具定义 **`.toml`**（可含 `extends`）；**相对路径相对当前工作目录**；未设置且未 `TOOLS_FILE` / `PROMPTPILE_TOOLS_FILE` 且未 `--disable-tool` 时报错 | 无 |
| `--insert-files <paths>` | 在扫描消息 **之前** 插入 sidecar 消息；多路径用 `\|` 分隔；每文件须 `{name}.{role}.md`；**相对路径相对 cwd** | 无 |
| `--append-files <paths>` | 在扫描消息 **之后** 追加 sidecar 消息；规则同 `--insert-files` | 无 |
| `--after-hook-path <path>` | 完成后执行的脚本文件；**相对路径相对当前工作目录** | 无 |
| `--tool-choice <value>` | OpenAI `tool_choice`：当且仅当本次请求包含非空 `tools` 时写入请求体。`none`（禁止工具调用）\|`auto`\|`required`\|`function:<name>`（强制指定工具）。**优先级**：CLI 高于下层 `TOOL_CHOICE`；均未设置时按 `auto` | 无（由下层或未设置时的 `auto` 决定） |
| `--disable-tool` | 不加载、不发送 `tools`：忽略 `--tools-file` 与 `TOOLS_FILE`；与 `--tools-file` 同时出现时 **本开关优先** | 关闭 |

与「不传 `tools`」的区别：`tool_choice` 仅在请求体带 `tools` 时发送；`none` 表示仍下发工具定义但禁止模型发起 `tool_calls`。自建网关若不支持 `required` 或强制 `function` 对象，可能返回 400，需以网关文档为准。

查看帮助：

```bash
node dist/index.js --help
```

包内提供示例环境变量模板（见 [./.env.example](./.env.example)），可复制为 `.env` 后按需修改，勿提交真实密钥。另见 [example.toml](./example.toml)、[example.env](./example.env)、[example.sh](./example.sh)。

---

## 命令行用法

### 最小示例

1. 准备目录（例如 `./messages`）与文件：

```text
messages/
  [0]system.md
  [1]user.md
```

2. 设置密钥并运行：

```bash
# Windows PowerShell
$env:AI_API_KEY="sk-..."
node dist/index.js -d ./messages

# 或使用 .env 文件（放在运行时的当前工作目录）
```

### 指定模型与 JSON 输出

```bash
node dist/index.js -d ./messages -m gpt-4o -f json
```

### 继续会话（保存 assistant 回复）

```bash
node dist/index.js -d ./messages --continue
```

启用后会在 `directory` 根目录下追加 **`[N]assistant.md`**（本轮正文；若仅有工具调用而无正文，仍会写入该文件，可为空）。若本轮 API 返回 **`tool_calls`**，会追加 **同一 `N` 的 `[N]assistant.calls.jsonl`**（每行一个 JSON，与 `outputs` 下的 `.calls.jsonl` 每行格式一致），便于下一轮 **[助理发起工具调用](#工具定义与历史工具调用toolstoml--assistantcalls--assistantresult)**。若返回非空 **`reasoning_content`**（thinking 模型），会追加 **同一 `N` 的 `[N]assistant.extra.json`**（见上文 **[`[idx]assistant.extra.json`](#idxassistantextrajson历史thinking-模型的-reasoning_content)**）。主输出同目录下的 **`{basename}.calls.jsonl`** / **`{basename}.extra.json`** 仍仅在指定 **`-o` / `OUTPUT_FILE`** 时写入。

### 终端输入并执行

```bash
node dist/index.js -d ./messages --input
```

启用后会先在终端等待输入，将输入保存为 `directory` 根目录下的 `[nextIdx]user.md`，然后再调用模型执行。

### nextIdx 计算规则

- `nextIdx` 按当前目录已匹配到的消息文件中 **最大 idx + 1** 计算。
- 若目标文件名已存在（例如已有同序号同角色文件），会继续递增直到找到可用文件名。
- 不要求 idx 连续；例如现有 `[0]... [1]... [3]...`，下一条会从 `[4]...` 开始尝试。

### 使用自建兼容网关

```bash
node dist/index.js -b https://your-gateway.example/v1 -k your-key -m your-model-id
```

### 将回复保存到文件

```bash
node dist/index.js -d ./messages -o ./outputs/last-response.txt
```

若模型返回工具调用且指定了 `-o`，会额外生成 **`./outputs/last-response.calls.jsonl`**（与主文件同目录、`path.parse(主路径).name + ".calls.jsonl"`）。

或使用环境变量：

```bash
# Windows PowerShell
$env:OUTPUT_FILE="./outputs/last-response.txt"
node dist/index.js -d ./messages
```

### 静默模式（建议与输出文件配合）

```bash
node dist/index.js -d ./messages -o ./outputs/last-response.txt --quiet
```

或使用环境变量：

```bash
# Windows PowerShell
$env:QUIET="true"
node dist/index.js -d ./messages -o ./outputs/last-response.txt
```

### 带工具定义（显式 `.toml`）的最小目录示例

通过 **`--tools-file`**（相对 cwd）或 **`TOOLS_FILE`**（相对扫描目录）指向 **`.toml`**，消息目录内只需消息文件，例如：

```text
messages/
  [0]system.md
  [1]user.md
  my-tools.toml
```

`my-tools.toml` 示例：

```toml
[[tools]]
name = "get_weather"
description = "Get weather"
parameters = '{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}'
```

运行示例（模型是否发起 `tool_calls` 取决于网关与模型）：

```bash
node dist/index.js -d ./messages --tools-file ./my-tools.toml -m gpt-4o -o ./outputs/out.txt
```

---

## 输出格式

### `text`（默认）

将模型 **正文** 流式写入标准输出（`--quiet` 时关闭）。若存在 **工具调用**，在流结束后将每条调用以 **一行一个 JSON 对象** 写入 stdout（`--quiet` 时关闭）；若同时指定 **`-o`**，主回复写入该文件，工具调用写入 **`{basename}.calls.jsonl`**。

### `json`

输出 **单个** JSON 对象，便于 `jq` 或其它脚本解析：

```json
{
  "response": "模型返回的正文（字符串）",
  "tool_calls": null
}
```

若模型返回工具调用，`tool_calls` 为数组；否则为 `null`。`--quiet` 时不向 stdout 打印该对象，但若指定 **`-o`**，主文件仍为 **纯文本正文**（不是该 JSON），工具调用仍写入 **`{basename}.calls.jsonl`**。

---

## 完成后钩子（after-hook）

在 **API 成功返回** 且已完成 **主输出及 `{basename}.calls.jsonl` / `{basename}.extra.json`（若配置了 `-o` 且存在）**、以及可选的 **`--continue` 追加 `[N]assistant.md` / `[N]assistant.calls.jsonl` / `[N]assistant.extra.json`** 之后，若解析到要运行的脚本文件，则 **`spawn` 子进程** 执行该文件（非交互、不经过 shell 拼接命令串）。**API 失败或中途 `exit(1)` 时不会执行钩子。**

### 配置来源与优先级

| 来源 | 含义 | 相对路径解析基准 |
|------|------|-------------------|
| CLI `--after-hook-path <path>` | 脚本文件路径（非正则、非整条 shell 命令） | **`process.cwd()`**（当前工作目录） |
| 环境变量 `AFTER_HOOK_PATH` | 脚本文件路径 | **扫描目录根**（`-d` / `DEFAULT_DIRECTORY` 解析后的绝对路径） |
| 均未配置有效路径 | 在扫描目录根查找 **默认文件名**（见下） | — |

优先级：**CLI** > **`AFTER_HOOK_PATH`** > **默认文件**。绝对路径在 CLI / env 中均 **不再** 拼相对基准。

若 CLI 或 env 给出了非空路径但 **文件不存在**：向 **stderr** 打印一行 `Warning: after-hook script not found: <绝对路径>`，**不执行钩子**，主流程仍以成功结束（与「未配置钩子」区分在日志）。

### 默认文件名（未配置 CLI 与 env 时）

仅在 **扫描目录根** 查找第一个 **存在且为普通文件** 的项：

- **Windows**（`win32`）：`.after-hook.ps1` → `.after-hook.bat` → `.after-hook.cmd`  
- **macOS / Linux**（非 `win32`）：仅 **`.after-hook.sh`**

Windows **默认链**不包含 `.sh`；若要在 Windows 上跑 shell 脚本，请用 CLI/env **显式**指定路径（实现上会用 `sh` 启动 `.sh`，需本机存在 `sh`）。

### 子进程环境

子进程 **`cwd`** 为扫描目录绝对路径；继承当前环境变量，并追加（供脚本读取）：

| 变量 | 含义 |
|------|------|
| `PROMPTPILE_SCAN_DIRECTORY` | 扫描目录绝对路径 |
| `PROMPTPILE_OUTPUT_FILE` | 主输出文件绝对路径；未使用 `-o` 则为空字符串 |
| `PROMPTPILE_CALLS_FILE` | 若本轮写入了 `{basename}.calls.jsonl`（由 `-o` / `OUTPUT_FILE` 决定）则为该文件绝对路径，否则空字符串 |
| `PROMPTPILE_ASSISTANT_MD_FILE` | 若启用了 `--continue` 且本轮有正文（`response.length > 0`）写入了 `[N]assistant.md` 则为该文件绝对路径，否则空字符串 |
| `PROMPTPILE_ASSISTANT_CALL_FILE` | 若启用了 `--continue` 且本轮含 `tool_calls`、写入了 `[N]assistant.calls.jsonl` 则为该文件绝对路径，否则空字符串。与 `PROMPTPILE_ASSISTANT_MD_FILE` / `PROMPTPILE_ASSISTANT_EXTRA_FILE` **可同时非空**：下一轮拼请求时合并为单条 assistant 消息 |
| `PROMPTPILE_ASSISTANT_EXTRA_FILE` | 若启用了 `--continue` 且本轮含 `reasoning_content`、写入了 `[N]assistant.extra.json` 则为该文件绝对路径，否则空字符串 |
| `PROMPTPILE_FORMAT` | `text` 或 `json` |
| `PROMPTPILE_MODEL` | 当前模型 ID |
| `PROMPTPILE_QUIET` | `0` 或 `1` |
| `PROMPTPILE_HAS_TOOL_CALLS` | `0` 或 `1` |
| `PROMPTPILE_HAS_REASONING` | 本轮 API 是否返回非空 `reasoning_content`：`0` 或 `1` |
| `PROMPTPILE_RESPONSE_LENGTH` | 本轮正文字符串长度（数字字符串） |

子进程 **stdout / stderr** 被管道收集：**非 0 退出码** 时向主进程 **stderr** 打印退出码与子进程 stderr；**成功（退出码 0）时不回显**子进程 stdout/stderr，以免干扰终端与 `-f json` 等机器可读输出。

### 启动方式（按扩展名）

| 扩展名 | 行为（概要） |
|--------|----------------|
| `.ps1`（Windows） | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <脚本>` |
| `.bat` / `.cmd`（Windows） | `cmd.exe /d /s /c <脚本>` |
| `.sh` | `sh <脚本>` |
| 其他（仅非 Windows 常见） | 直接 `spawn(脚本路径, [])`（需文件具备可执行权限等） |

### 安全说明

默认文件名或 `AFTER_HOOK_PATH` 放在 **消息目录** 内时，等同于「在该目录运行 promptpile 即可能执行本地脚本」。**不要**在不可信仓库或未审查目录中盲目运行；**不要**将 `AI_API_KEY` 等敏感信息写入钩子日志（本实现不会主动注入 API Key 到上述 `PROMPTPILE_*` 变量）。

---

## 与 OpenAI 兼容的网关

本工具使用 `node-fetch` 直接调用 HTTP 接口，通过 `AI_API_BASE_URL`（或 `-b`）与 `AI_API_KEY`（或 `-k`）指向任意 **OpenAI Chat Completions 兼容** 的服务端（如部分云厂商、本地 `vLLM`/`llama.cpp` 的 OpenAI 兼容层等）。请注意：

- **路径**：默认 Base URL 为 `https://api.openai.com/v1`；若网关要求不含 `/v1` 或要求额外路径，需按对方文档填写 `-b` / `AI_API_BASE_URL`。
- **模型名**：`-m` 必须与网关识别的模型 ID 一致。

---

## 开发

| 命令 | 说明 |
|------|------|
| `npm run build` | `tsc` 编译到 `dist/` |
| `npm run dev` | 使用 `ts-node` 直接运行 `src/index.ts` |
| `npm start` | 运行 `node dist/index.js`（需先 `build`） |

TypeScript 配置见本包目录 [tsconfig.json](./tsconfig.json)（`strict: true`，输出 CommonJS）。

---

## 项目结构

```text
packages/promptpile/
├── src/
│   ├── index.ts         # 入口：编排扫描、读文件、调 API、打印结果
│   ├── cli.ts             # Commander：CLI 定义与解析（`parseCli`）
│   ├── config.ts          # `parseBoolEnv` / `trimEnv`；遗留 `loadConfig`（不推荐）
│   ├── resolve-config.ts  # 多层合并：CLI、TOML、cwd/扫描目录 .env、`process.env`
│   ├── env-file.ts        # 读取 `.env` 为键值表（不污染 `process.env`）
│   ├── toml-config.ts     # 解析 `--config` TOML 的 `[promptpile]` / `[[llm_api]]`
│   ├── file-handler.ts  # 目录扫描、拼 ChatMessage[]
│   ├── tools-loader.ts  # 显式 `.toml` 工具、`extends` 解析与 `loadTools`
│   ├── after-hook.ts    # 解析并执行完成后钩子脚本
│   ├── ai-client.ts     # node-fetch 调用 chat/completions（含流式 tool_calls 合并）
│   └── types.ts         # Config、ChatMessage、FileInfo 等
├── dist/                # 编译产物（运行入口）
├── package.json
├── tsconfig.json
└── README.md
```

---

## 安全与隐私

- **API Key**：勿将真实密钥提交到仓库；优先使用环境变量或本地 `.env`（并将 `.env` 加入 `.gitignore`）。
- **日志**：默认不会在日志中打印完整 `messages` 负载；若自行修改代码或在外层包装脚本中记录请求体，请注意敏感数据与 CI 输出。
- **网络**：请求发往 `apiBaseUrl` 所指向的服务器，请确认合规与数据出境要求。
- **工具调用**：本工具 **不执行** 用户定义的工具函数；工具结果文件需自行保证来源可信。

---

## 常见问题与排查

| 现象 | 可能原因 | 处理建议 |
|------|----------|----------|
| `AI API key is required` | 未设置 `-k` 且环境变量无 `AI_API_KEY` | 设置密钥或传入 `-k` |
| `No files found matching` … | 目录下无匹配的消息文件 | 检查是否至少存在 `[数字]角色.md`、`.json` 或 `[idx]assistant.calls.jsonl` / `[idx]assistant.extra.json` / `[idx]assistant.result.jsonl` 等匹配项 |
| `Error loading tools` / `Circular tools extends` / `Tools extends depth exceeds` | 工具 `.toml` 非法、`extends` 成环、递归过深、显式路径不存在或扩展名非 `.toml` 等 | 按 stderr 提示修正；条目须为扁平 `[[tools]]`；`extends` 路径相对当前 toml 所在目录 |
| `Error: tools require an explicit .toml path` | 未传 `--disable-tool` 且未提供 `--tools-file` / `TOOLS_FILE` / `PROMPTPILE_TOOLS_FILE` / 配置中的 `tools_file` | 指定 `.toml` 路径或添加 `--disable-tool` |
| `Warning: after-hook script not found` | CLI 或 `AFTER_HOOK_PATH` 指向的路径不存在 | 修正路径或删除配置 |
| `after-hook exited with code` / `spawn error` | 脚本语法错误、无解释器、或 `.ps1` 被策略拦截 | 在本机直接运行同一脚本排查 |
| `Cannot create or write to output directory` | `-o` 父目录无法创建或不可写 | 检查路径权限与磁盘 |
| `assistant.result.jsonl line …` / `Invalid JSON`（来自拼消息阶段） | `[idx]assistant.result.jsonl` 某行非合法 JSON 或缺少 `tool_call_id` / `content` | 按报错行号修正该文件 |
| HTTP 400 / invalid role | `role` 不是 API 支持的值 | 使用 `system` / `user` / `assistant` 等 |
| 连接失败 | 网络、代理、Base URL 错误 | 检查 `-b`、防火墙与网关文档 |
| 模型不存在 | `-m` 与服务商不匹配 | 换成该 Base URL 下列出的模型 ID |

---

## 许可证

以 `package.json` 中的 `license` 字段为准（当前为 `ISC`）。
