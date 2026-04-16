import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileViewElement } from '../src/component/file-view.js';
import type { IFVState } from '../src/types/fv-models.js';
import { mountFileViewIcons } from '../src/ui/mount-file-view-icons.js';
import { flushMicrotasks } from './flush-microtasks.js';

function createStubFileView(initial?: IFVState): {
  fileView: FileViewElement;
  setTargetDir: ReturnType<typeof vi.fn>;
} {
  let current: IFVState | undefined = initial;
  const bus = new EventTarget();
  const setTargetDir = vi.fn(async (url: string) => {
    current = {
      fileList: [],
      targetDir: {
        kind: 'directory',
        name: url.split('/').pop() ?? 'dir',
        fileUrl: url,
        hidden: false,
      },
    };
    return current;
  });
  const stub = Object.assign(bus, {
    get currentState(): IFVState | undefined {
      return current;
    },
    setTargetDir,
  });
  return { fileView: stub as unknown as FileViewElement, setTargetDir };
}

describe('mountFileViewIcons', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders grid from fv-state-changed and clears on dispose', async () => {
    const { fileView: fv } = createStubFileView();
    const root = document.createElement('div');
    document.body.append(root);
    const handle = mountFileViewIcons({ root, fileView: fv });
    const state: IFVState = {
      fileList: [
        {
          kind: 'file',
          name: 'a.txt',
          fileUrl: 'file:///D:/data/a.txt',
          hidden: false,
        },
      ],
      targetDir: {
        kind: 'directory',
        name: 'data',
        fileUrl: 'file:///D:/data',
        hidden: false,
      },
    };
    fv.dispatchEvent(
      new CustomEvent('fv-state-changed', { bubbles: true, composed: true, detail: { state } }),
    );
    await flushMicrotasks();
    expect(root.querySelector('.fv-icons__bar-title')?.textContent).toBe('data');
    expect(root.querySelectorAll('.fv-icons__cell').length).toBe(1);
    handle.dispose();
    expect(root.childNodes.length).toBe(0);
  });

  it('calls setTargetDir when a directory tile is activated', async () => {
    const { fileView: fv, setTargetDir } = createStubFileView();
    const root = document.createElement('div');
    document.body.append(root);
    mountFileViewIcons({ root, fileView: fv });
    const state: IFVState = {
      fileList: [
        {
          kind: 'directory',
          name: 'sub',
          fileUrl: 'file:///D:/data/sub',
          hidden: false,
        },
      ],
      targetDir: {
        kind: 'directory',
        name: 'data',
        fileUrl: 'file:///D:/data',
        hidden: false,
      },
    };
    fv.dispatchEvent(
      new CustomEvent('fv-state-changed', { bubbles: true, composed: true, detail: { state } }),
    );
    await flushMicrotasks();
    const tile = root.querySelector('[role="button"]') as HTMLElement | null;
    expect(tile).toBeTruthy();
    tile!.click();
    await flushMicrotasks();
    expect(setTargetDir).toHaveBeenCalledWith('file:///D:/data/sub');
  });
});
