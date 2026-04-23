import fs from 'fs';
import path from 'path';
import { DEFAULT_REACT_CORE, DEFAULT_REACT_OBSERVE } from './default-react-prompts';

export const REACT_PROMPT_FILES = {
  core: '.react.core.md',
  final: '.react.final.md',
  observe: '.react.observe.md'
} as const;

export interface ReactPromptTexts {
  core: string;
  final: string;
  observe: string;
}

const readUtf8IfExists = (absPath: string): string | undefined => {
  try {
    if (!fs.existsSync(absPath)) {
      return undefined;
    }
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return undefined;
  }
};

/**
 * 从 `-d` 目录读取 `.react.*.md`；`core` / `observe` 缺失或仅空白时用内置中文默认；`final` 缺失或空白则为空字符串。
 * 若未传 `directory`，不读盘，`core`/`observe` 用默认，`final` 为空。
 */
export function loadReactPrompts(directory: string | undefined): ReactPromptTexts {
  if (directory === undefined || directory.trim() === '') {
    return {
      core: DEFAULT_REACT_CORE,
      final: '',
      observe: DEFAULT_REACT_OBSERVE
    };
  }

  const root = path.resolve(process.cwd(), directory.trim());
  const rawCore = readUtf8IfExists(path.join(root, REACT_PROMPT_FILES.core));
  const rawFinal = readUtf8IfExists(path.join(root, REACT_PROMPT_FILES.final));
  const rawObserve = readUtf8IfExists(path.join(root, REACT_PROMPT_FILES.observe));

  const pickCore =
    rawCore !== undefined && rawCore.trim() !== '' ? rawCore.trim() : DEFAULT_REACT_CORE;
  const pickObserve =
    rawObserve !== undefined && rawObserve.trim() !== ''
      ? rawObserve.trim()
      : DEFAULT_REACT_OBSERVE;
  const pickFinal =
    rawFinal !== undefined && rawFinal.trim() !== '' ? rawFinal.trim() : '';

  return {
    core: pickCore,
    final: pickFinal,
    observe: pickObserve
  };
}
