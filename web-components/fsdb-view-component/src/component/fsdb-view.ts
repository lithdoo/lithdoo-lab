/**
 * `<fsdb-view>` — placeholder for an FSDB view driven by `fsdb-ws-server` over WebSocket.
 *
 * Attributes (implementation pending):
 * - `url` — WebSocket root URL of the FSDB server (e.g. `ws://127.0.0.1:8080/rpc`; exact path TBD).
 * - `target` — Watched directory as `targetDir`; recommended `file://...` (aligned with `targetDirFileUrl` in file-view-ws-server).
 */
export class FsdbViewElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['url', 'target'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const label = document.createElement('span');
    label.textContent = 'FSDB view — not implemented';
    root.append(label);
  }

  attributeChangedCallback(): void {
    // FSDB WebSocket + targetDir handling will be added later.
  }

  connectedCallback(): void {
    // FSDB WebSocket + targetDir handling will be added later.
  }
}
