import { parseBoolEnv } from 'promptpile/dist/config';
import { coerceTemperatureValue } from 'promptpile/dist/llm-sampling';

export const trim = (v: string | undefined): string | undefined => {
  if (v === undefined) {
    return undefined;
  }
  const t = v.trim();
  return t === '' ? undefined : t;
};

export const getStr = (r: Record<string, unknown>, key: string): string | undefined => {
  const v = r[key];
  if (typeof v === 'string') {
    return trim(v);
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return trim(String(v));
  }
  return undefined;
};

export const getBool = (r: Record<string, unknown>, key: string): boolean | undefined => {
  const v = r[key];
  if (typeof v === 'boolean') {
    return v;
  }
  if (typeof v === 'string') {
    return parseBoolEnv(v) ? true : v.trim() === '' ? undefined : false;
  }
  return undefined;
};

export const getNum = (r: Record<string, unknown>, key: string): number | undefined => {
  const v = r[key];
  if (v === undefined) {
    return undefined;
  }
  return coerceTemperatureValue(v);
};

export const getInt = (r: Record<string, unknown>, key: string): number | undefined => {
  const v = r[key];
  if (typeof v === 'number' && Number.isInteger(v)) {
    return v;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') {
      return undefined;
    }
    const n = Number(s);
    if (Number.isInteger(n)) {
      return n;
    }
  }
  return undefined;
};

export const envBool = (val: string | undefined): boolean | undefined => {
  if (val === undefined || val.trim() === '') {
    return undefined;
  }
  return parseBoolEnv(val);
};

export const pickStr = (
  ...values: (string | undefined)[]
): string | undefined => {
  for (const v of values) {
    const t = trim(v);
    if (t !== undefined) {
      return t;
    }
  }
  return undefined;
};

export const pickBool = (
  ...values: (boolean | undefined)[]
): boolean | undefined => {
  for (const v of values) {
    if (v !== undefined) {
      return v;
    }
  }
  return undefined;
};

export const pickInt = (
  ...values: (number | undefined)[]
): number | undefined => {
  for (const v of values) {
    if (v !== undefined) {
      return v;
    }
  }
  return undefined;
};

export const pickNum = (
  ...values: (number | undefined)[]
): number | undefined => {
  for (const v of values) {
    if (v !== undefined) {
      return v;
    }
  }
  return undefined;
};
