import { FsdbViewElement } from './component/fsdb-view.js';

const DEFAULT_TAG = 'fsdb-view';

/**
 * Registers the custom element. Safe to call multiple times.
 */
export function defineFsdbViewElement(tagName: string = DEFAULT_TAG): void {
  const ctor = FsdbViewElement;
  if (customElements.get(tagName) === undefined) {
    customElements.define(tagName, ctor);
  }
}

export { FsdbViewElement };

// Side-effect: auto-register default tag when bundle is loaded directly.
defineFsdbViewElement(DEFAULT_TAG);
