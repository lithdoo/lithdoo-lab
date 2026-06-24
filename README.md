# lithdoo-lab

`lithdoo-lab` 是用于集中管理 Lithdoo 相关实验项目、工具包、Web Components 与示例的 workspace 仓库。

当前主要内容：

- [`hostra`](hostra/)：独立 hostra 仓库子模块。
- [`promptpile`](promptpile/)：独立 promptpile 仓库子模块。
- [`dayloom`](dayloom/)：独立 dayloom 仓库子模块。
- [`web-components`](web-components/)：可复用 Web Components 与配套服务。
- [`example`](example/)：仍依赖本 workspace 的参考示例。

子模块初始化：

```bash
git submodule update --init --recursive
```
