# day-loom-init example

验证 [`packages/day-loom`](../../packages/day-loom/) 的 `init` 命令：空骨架（`--quick`）与 promptpile 访谈式初始化（默认）。

存档布局见 [`packages/day-loom/prompts/spec.md`](../../packages/day-loom/prompts/spec.md) §4。

## Prerequisites

- Node.js
- `run-*.bat` 会在 [`packages/day-loom`](../../packages/day-loom/) 自动执行 `npm install`（含 promptpile 依赖），**无需**在 `example/` 安装 day-loom
- **Quick**：无需 API key
- **Interactive**：`DEEPSEEK_API_KEY`（用户/系统环境变量，或本目录 `.env`；勿提交密钥）

从 `.env.example` 复制为 `.env` 仅用于 interactive：

```text
DEEPSEEK_API_KEY=sk-...
```

## Quick（自动化 smoke）

在本目录执行：

```bat
run-quick.bat
```

流程：清理 `output/world-quick` → `day-loom init --quick` → `scripts/verify-world.js --mode quick`。

预期 stdout 含：

```text
Initialized World save: ...\output\world-quick
verify-world: OK (quick) ...
```

Quick 模式下 `canon/` 为空、`characters/` 无 NPC，符合空骨架约定。

也可从 `example/` 根目录：

```bat
npm run day-loom:quick
npm run day-loom:verify-quick
```

## Interactive（手跑 E2E）

在本目录执行：

```bat
run-interactive.bat
```

每轮访谈在终端输入回答，**Ctrl+Z 然后 Enter**（Windows）结束本轮输入。macOS/Linux 为 **Ctrl+D**。

若 Ctrl+Z 后内容为空，会询问 `Empty input. Exit? (Y/N)`：选 **Y** 取消 init（exit 0），选 **N** 重新输入。

建议在回答中覆盖 checklist 关键词（中英文均可），否则模型可能标 `ready` 但脚本仍会继续追问：

| 项 | 提示词示例 |
|----|------------|
| premise | 世界背景、时代、地点 |
| rules | 规则、边界、constraint |
| style | 风格、文风、tone |
| user_role | 主角、我扮演、protagonist |
| npc | NPC、人物、角色、同伴 |

成功后产物在 `output/world-interactive/`，并含 `.loom/init-transcript/`（访谈 session 归档）。

验收：

```bat
node scripts\verify-world.js output\world-interactive --mode interactive
```

## 预期产物对比

| 项 | `output/world-quick` | `output/world-interactive` |
|----|----------------------|----------------------------|
| `manifest.yaml` | ✓ | ✓ |
| `canon/*.md` | 空文件 | 有内容 |
| `characters/` | 无 NPC 子目录 | ≥1 个 `char_*` + `profile.yaml` |
| `days/` | 空 | 空 |
| `.loom/init-transcript/` | 无 | 有 |

## 故障排查

| 现象 | 处理 |
|------|------|
| `World save already initialized` | 删除 `output/world-*` 后重跑 |
| `DEEPSEEK_API_KEY is not set` | 设置环境变量或创建 `.env`；`setx` 后需新开 cmd |
| `spawn promptpile ENOENT` | 在 `packages/day-loom` 执行 `npm install`，确认存在 `node_modules/promptpile/dist/index.js`；或重跑 `run-*.bat`（会调用 `scripts/ensure-day-loom.bat`） |
| init 失败但需调试 session | 使用 `--keep-session`（`run-interactive.bat` 已启用），stderr 会打印 temp 路径 |

`output/` 与 `.env` 已 gitignore，勿提交。
