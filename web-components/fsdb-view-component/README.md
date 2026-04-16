# @web-editor/fsdb-view-component

**脚手架包**：与 [`web-editor-component`](../web-editor-component/) 同构的 **Vite + TypeScript** Web Component 库，占位自定义元素 `<fsdb-view>`。**不包含**与 `fsdb-ws-server` 的实际 WebSocket 连接、状态同步或业务 UI。

---

## 与 `fsdb-ws-server` 的关系（规划）

| 概念 | 说明 |
|------|------|
| `url` | 浏览器侧指向 **`fsdb-ws-server`** 的 **WebSocket 根地址**（例如 `ws://127.0.0.1:8080/rpc`；以后端实际路径为准）。 |
| `target` | **监听目录** `targetDir`。建议约定为 **`file://...`** 字符串，与同仓库 `file-view-ws-server` 中的 `targetDirFileUrl` 语义对齐；若使用本机路径字符串，后续实现再统一规范化亦可。 |

本仓库 `web-components` 下当前可能尚无 `fsdb-ws-server` 子目录；待服务路径稳定后，可在本文档与示例中写死推荐 URL。

---

## 自定义元素：`<fsdb-view>`

### 属性（语义约定，**尚未在代码中实现**）

| 属性 | 含义 |
|------|------|
| `url` | `fsdb-ws-server` 的 WebSocket 根地址。 |
| `target` | 监听目录（建议 `file://...`）。 |

### HTML 示例（仅文档）

```html
<fsdb-view url="ws://127.0.0.1:8080/rpc" target="file:///D:/data"></fsdb-view>
```

当前实现仅注册元素并在 Shadow DOM 中显示占位文案 **「FSDB view — not implemented」**，便于确认 bundle 已加载且 `customElements.define` 生效。

---

## 构建与产物

```bash
cd web-components/fsdb-view-component
npm install
npm run build
```

产物在 **`dist/`**：

| 文件 | 用途 |
|------|------|
| `fsdb-view-component.js` | ESM 主入口 |
| `index.d.ts` | 类型声明（`tsc --emitDeclarationOnly`） |

```bash
npm run typecheck   # 仅类型检查
npm run dev         # vite build --watch
```

---

## 在页面中使用

### 1. 直接引入 bundle

```html
<script type="module" src="/path/to/dist/fsdb-view-component.js"></script>

<fsdb-view url="ws://127.0.0.1:8080/rpc" target="file:///D:/data"></fsdb-view>
```

加载模块后会**自动**执行 `customElements.define('fsdb-view', ...)`。

### 2. 作为 npm 包（ESM）

```ts
import { defineFsdbViewElement, FsdbViewElement } from '@web-editor/fsdb-view-component';
```

也可调用 **`defineFsdbViewElement('my-fsdb-view')`** 使用自定义标签名（需避免与已注册标签冲突）。

---

## 导出的 API

| 符号 | 用途 |
|------|------|
| `defineFsdbViewElement` | 注册自定义标签 |
| `FsdbViewElement` | 类引用 |

---

## 许可证

以仓库根目录 **LICENSE** 为准。
