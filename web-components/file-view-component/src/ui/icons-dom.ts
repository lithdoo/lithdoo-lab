import type { FVDirectory, IFVState } from '../types/fv-models.js';
import { barSubtitle, barTitle, iconGlyph, labelForItem } from './icons-model.js';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

export function createBar(
  state: IFVState | undefined,
  options: { showParent: boolean; onParent?: () => void },
): HTMLElement {
  const bar = el('div', 'fv-icons__bar');

  if (options.showParent && state?.targetDir && options.onParent) {
    const up = el('button', 'fv-icons__parent');
    up.type = 'button';
    up.textContent = 'Up';
    up.setAttribute('aria-label', 'Open parent directory');
    up.addEventListener('click', () => {
      options.onParent?.();
    });
    bar.append(up);
  }

  const text = el('div', 'fv-icons__bar-text');
  const title = el('div', 'fv-icons__bar-title');
  title.textContent = barTitle(state);
  const sub = el('div', 'fv-icons__bar-sub');
  sub.textContent = barSubtitle(state);
  text.append(title, sub);
  bar.append(text);
  return bar;
}

export function createGrid(
  state: IFVState | undefined,
  onOpenDirectory: (dir: FVDirectory) => void,
): HTMLElement {
  const grid = el('div', 'fv-icons__grid');
  const list = state?.fileList ?? [];
  for (const item of list) {
    const cell = el('div', `fv-icons__cell${item.kind === 'directory' ? ' fv-icons__cell--dir' : ''}`);
    const glyph = el('div', 'fv-icons__glyph');
    glyph.textContent = iconGlyph(item.kind);
    const name = el('div', 'fv-icons__name');
    name.textContent = labelForItem(item);
    cell.append(glyph, name);

    if (item.kind === 'directory') {
      const dir = item;
      cell.tabIndex = 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `Open folder ${dir.name}`);
      const open = () => {
        onOpenDirectory(dir);
      };
      cell.addEventListener('click', open);
      cell.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    } else {
      cell.setAttribute('aria-label', `File ${item.name}`);
    }
    grid.append(cell);
  }
  return grid;
}
