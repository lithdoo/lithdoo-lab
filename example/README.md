# lithdoo-lab examples

用于集中存放 `lithdoo-lab` workspace 内各个包的参考示例。

## 目录约定

- 建议按包名分目录：`example/<package-name>/...`
- 每个示例目录至少包含一个简短 `README.md`，说明运行方式
- 示例代码尽量使用相对本仓库的本地依赖路径，便于直接验证

## 初始化后建议

1. 为每个包创建子目录，例如：
   - `example/<workspace-specific-package>/`
   - `example/promptpile/`
   - `example/tomlith/`
2. 在各子目录放最小可运行示例与说明文档
3. 执行 `npm run list` 查看约定提示

## 已有示例

Hostra 自有示例已迁移至子模块 [`hostra/examples/`](../hostra/examples/)；Promptpile 自有示例已迁移至子模块 [`promptpile/examples/`](../promptpile/examples/)；dayloom 自有示例已迁移至子模块 [`dayloom/examples/`](../dayloom/examples/)；本目录仅保留依赖本 workspace 的示例。
