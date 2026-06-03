# day-loom daily example

这个示例用于真实测试 [`day-loom daily`](../../packages/day-loom/)：从已有 World 复制一份测试存档，然后通过 AI + MCP 制定当天初步计划。

它不会初始化 World。请先在相邻示例中创建源 World：

```bash
cd ../day-loom-init-revise
./run-interactive.sh
```

源 World：

```text
../day-loom-init-revise/output/world-interactive
```

目标 World：

```text
output/world-daily-interactive
```

脚本只会复制源 World 到目标 World，不会直接修改源 World。

## Prerequisites

- Node.js
- `DEEPSEEK_API_KEY`
- 可用的 `promptpile-mcp`，或脚本自动构建仓库内 `promptpile/promptpile-mcp`
- filesystem MCP。首次运行会安装到本示例的 `.runtime/`

复制 `.env.example` 为 `.env`：

```text
DEEPSEEK_API_KEY=sk-...
```

可选：

```text
PROMPTPILE_MCP_BIN=/absolute/path/to/promptpile-mcp
PROMPTPILE_MCP_BASE_URL=http://127.0.0.1:8765
PROMPTPILE_MCP_TOKEN=...
```

## Run

macOS/Linux：

```bash
./run-interactive.sh
```

Windows：

```bat
run-interactive.bat
```

进入 daily 后，每轮输入可写多行：

- macOS/Linux：空行处按 `Ctrl+D` 提交
- Windows：`Ctrl+Z` 后 Enter 提交

示例：

```text
今天我想去旧市场找零件，如果可以的话打听 Flea 的近况。
```

提交后，可以继续问答；确认要生成计划时输入：

```text
/start
```

再提交该命令。确认 `Y` 后，脚本会运行 `scripts/verify-daily.js`。

## Rerun

如果目标 World 已经进入 `planned` 阶段，脚本会拒绝重复运行。重新测试时删除目标：

```bash
rm -rf output/world-daily-interactive
```

Windows：

```bat
rmdir /s /q output\world-daily-interactive
```

然后重新运行脚本，它会重新复制源 World。

## Verification

`verify-daily.js` 会检查：

- `current.yaml phase == planned`
- `days/day_0001/meta.yaml` 存在
- `days/day_0001/plan.user.md` 存在且非空
- `days/day_0001/plan.initial.json` 存在
- `planned_beats` 数量为 1 到 5
- beat 不包含 `outcome` / `result` / `reward` / `success` / `failure`
- `logs/state_changes.jsonl` 包含 `daily_plan_created`
- planning 阶段没有生成 `diary.md` 或 `events/`
