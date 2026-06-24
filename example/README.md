# lithdoo-lab examples

用于集中存放 `lithdoo-lab` workspace 内各个包的参考示例。

## 目录约定

- 建议按包名分目录：`example/<package-name>/...`
- 每个示例目录至少包含一个简短 `README.md`，说明运行方式
- 示例代码尽量使用相对本仓库的本地依赖路径，便于直接验证

## 初始化后建议

1. 为每个包创建子目录，例如：
   - `example/hostra/`
   - `example/promptpile/`
   - `example/tomlith/`
2. 在各子目录放最小可运行示例与说明文档
3. 执行 `npm run list` 查看约定提示

## 已有示例

Promptpile 自有示例已迁移至子模块 [`promptpile/examples/`](../promptpile/examples/)；dayloom 自有示例已迁移至子模块 [`dayloom/examples/`](../dayloom/examples/)；本目录仅保留依赖本 workspace 的示例。

- `promptpile-tool-test/`：显式 TOML + `--after-hook-path` 的工具调用闭环示例；消息与 calls/result 都位于消息目录根层。
- `hostra-open-web/`：通过 `hostra` 的 JSON-RPC `openWindow` 打开本地网页
- `hostra-web-editor/`：通过 `hostra` 打开 `web-editor-component` 编辑器窗口，并联动 `lsp-ws-server`
- `hostra-file-view/`：通过 `hostra` 打开 `file-view-component` + icons UI，并联动 `file-view-ws-server`（静态页 `4174`，file-view 服务 `8081`）
