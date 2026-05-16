import { trimEnv } from 'promptpile/dist/config';
import { parseTemperatureInput } from 'promptpile/dist/llm-sampling';
import { envBool, trim } from './merge-utils';

export interface ReactEnvLayer {
  directory?: string;
  quiet?: boolean;
  afterHook?: string;
  toolsFile?: string;
  continueMode?: boolean;
  inputMode?: boolean;
  maxStep?: number;
  thoughtPrompt?: string;
  observePrompt?: string;
  finalPrompt?: string;
  thoughtLlmApi?: string;
  observeLlmApi?: string;
  finalLlmApi?: string;
  thoughtLlmApiKey?: string;
  thoughtLlmApiKeyEnv?: string;
  thoughtLlmApiModel?: string;
  thoughtLlmApiBaseUrl?: string;
  observeLlmApiKey?: string;
  observeLlmApiKeyEnv?: string;
  observeLlmApiModel?: string;
  observeLlmApiBaseUrl?: string;
  finalLlmApiKey?: string;
  finalLlmApiKeyEnv?: string;
  finalLlmApiModel?: string;
  finalLlmApiBaseUrl?: string;
  thoughtLlmApiTemperature?: number;
  observeLlmApiTemperature?: number;
  finalLlmApiTemperature?: number;
}

export interface SharedEnvLayer {
  directory?: string;
  quiet?: boolean;
  afterHook?: string;
  toolsFile?: string;
  continueMode?: boolean;
  inputMode?: boolean;
  defaultLlmApi?: string;
  model?: string;
  apiKey?: string;
  apiKeyEnvName?: string;
  apiBaseUrl?: string;
  temperature?: number;
}

const mapRecord = (r: Record<string, string>, get: (k: string) => string | undefined): SharedEnvLayer => {
  const out: SharedEnvLayer = {};
  const d = get('DEFAULT_DIRECTORY') ?? get('PROMPTPILE_DIR');
  if (d !== undefined) {
    out.directory = d;
  }
  const q = envBool(get('QUIET') ?? get('PROMPTPILE_QUIET'));
  if (q !== undefined) {
    out.quiet = q;
  }
  const ah = get('AFTER_HOOK_PATH') ?? get('PROMPTPILE_AFTER_HOOK');
  if (ah !== undefined) {
    out.afterHook = ah;
  }
  const tf = get('TOOLS_FILE') ?? get('PROMPTPILE_TOOLS_FILE');
  if (tf !== undefined) {
    out.toolsFile = tf;
  }
  const cont = envBool(get('PROMPTPILE_CONTINUE'));
  if (cont !== undefined) {
    out.continueMode = cont;
  }
  const inp = envBool(get('PROMPTPILE_INPUT'));
  if (inp !== undefined) {
    out.inputMode = inp;
  }
  const llmApi = get('PROMPTPILE_LLM_API');
  if (llmApi !== undefined) {
    out.defaultLlmApi = llmApi;
  }
  const m = get('AI_MODEL') ?? get('PROMPTPILE_LLM_API_MODEL');
  if (m !== undefined) {
    out.model = m;
  }
  const k = get('AI_API_KEY') ?? get('PROMPTPILE_LLM_API_KEY');
  if (k !== undefined) {
    out.apiKey = k;
  }
  const kn = get('PROMPTPILE_LLM_API_KEY_ENV');
  if (kn !== undefined) {
    out.apiKeyEnvName = kn;
  }
  const b = get('AI_API_BASE_URL') ?? get('PROMPTPILE_LLM_API_BASE_URL');
  if (b !== undefined) {
    out.apiBaseUrl = b;
  }
  const temp = get('PROMPTPILE_LLM_API_TEMPERATURE') ?? get('AI_TEMPERATURE');
  if (temp !== undefined) {
    out.temperature = parseTemperatureInput(temp);
  }
  return out;
};

export const mapSharedEnvRecord = (r: Record<string, string>): SharedEnvLayer =>
  mapRecord(r, (k) => trim(r[k]));

export const mapReactEnvRecord = (r: Record<string, string>): ReactEnvLayer => {
  const get = (k: string): string | undefined => trim(r[k]);
  const out: ReactEnvLayer = {};
  const d = get('PROMPTPILE_REACT_DIR');
  if (d !== undefined) {
    out.directory = d;
  }
  const q = envBool(get('PROMPTPILE_REACT_QUIET'));
  if (q !== undefined) {
    out.quiet = q;
  }
  const ah = get('PROMPTPILE_REACT_AFTER_HOOK');
  if (ah !== undefined) {
    out.afterHook = ah;
  }
  const tf = get('PROMPTPILE_REACT_TOOLS_FILE');
  if (tf !== undefined) {
    out.toolsFile = tf;
  }
  const cont = envBool(get('PROMPTPILE_REACT_CONTINUE'));
  if (cont !== undefined) {
    out.continueMode = cont;
  }
  const inp = envBool(get('PROMPTPILE_REACT_INPUT'));
  if (inp !== undefined) {
    out.inputMode = inp;
  }
  const ms = get('PROMPTPILE_REACT_MAX_STEP');
  if (ms !== undefined) {
    const n = Number(ms);
    if (Number.isInteger(n) && n >= 1) {
      out.maxStep = n;
    }
  }
  const tp = get('PROMPTPILE_REACT_THOUGHT_PROMPT');
  if (tp !== undefined) {
    out.thoughtPrompt = tp;
  }
  const op = get('PROMPTPILE_REACT_OBSERVE_PROMPT');
  if (op !== undefined) {
    out.observePrompt = op;
  }
  const fp = get('PROMPTPILE_REACT_FINAL_PROMPT');
  if (fp !== undefined) {
    out.finalPrompt = fp;
  }
  const bind = (prefix: string, target: keyof ReactEnvLayer, suffix: string): void => {
    const v = get(`${prefix}_${suffix}`);
    if (v !== undefined) {
      (out as Record<string, unknown>)[target as string] = v;
    }
  };
  bind('PROMPTPILE_REACT_THOUGHT_LLM_API', 'thoughtLlmApi', '');
  bind('PROMPTPILE_REACT_OBSERVE_LLM_API', 'observeLlmApi', '');
  bind('PROMPTPILE_REACT_FINAL_LLM_API', 'finalLlmApi', '');
  const tKey = get('PROMPTPILE_REACT_THOUGHT_LLM_API_KEY');
  if (tKey !== undefined) {
    out.thoughtLlmApiKey = tKey;
  }
  const tEnv = get('PROMPTPILE_REACT_THOUGHT_LLM_API_KEY_ENV');
  if (tEnv !== undefined) {
    out.thoughtLlmApiKeyEnv = tEnv;
  }
  const tModel = get('PROMPTPILE_REACT_THOUGHT_LLM_API_MODEL');
  if (tModel !== undefined) {
    out.thoughtLlmApiModel = tModel;
  }
  const tBase = get('PROMPTPILE_REACT_THOUGHT_LLM_API_BASE_URL');
  if (tBase !== undefined) {
    out.thoughtLlmApiBaseUrl = tBase;
  }
  const oKey = get('PROMPTPILE_REACT_OBSERVE_LLM_API_KEY');
  if (oKey !== undefined) {
    out.observeLlmApiKey = oKey;
  }
  const oEnv = get('PROMPTPILE_REACT_OBSERVE_LLM_API_KEY_ENV');
  if (oEnv !== undefined) {
    out.observeLlmApiKeyEnv = oEnv;
  }
  const oModel = get('PROMPTPILE_REACT_OBSERVE_LLM_API_MODEL');
  if (oModel !== undefined) {
    out.observeLlmApiModel = oModel;
  }
  const oBase = get('PROMPTPILE_REACT_OBSERVE_LLM_API_BASE_URL');
  if (oBase !== undefined) {
    out.observeLlmApiBaseUrl = oBase;
  }
  const fKey = get('PROMPTPILE_REACT_FINAL_LLM_API_KEY');
  if (fKey !== undefined) {
    out.finalLlmApiKey = fKey;
  }
  const fEnv = get('PROMPTPILE_REACT_FINAL_LLM_API_KEY_ENV');
  if (fEnv !== undefined) {
    out.finalLlmApiKeyEnv = fEnv;
  }
  const fModel = get('PROMPTPILE_REACT_FINAL_LLM_API_MODEL');
  if (fModel !== undefined) {
    out.finalLlmApiModel = fModel;
  }
  const fBase = get('PROMPTPILE_REACT_FINAL_LLM_API_BASE_URL');
  if (fBase !== undefined) {
    out.finalLlmApiBaseUrl = fBase;
  }
  const tTemp = get('PROMPTPILE_REACT_THOUGHT_LLM_API_TEMPERATURE');
  if (tTemp !== undefined) {
    out.thoughtLlmApiTemperature = parseTemperatureInput(tTemp);
  }
  const oTemp = get('PROMPTPILE_REACT_OBSERVE_LLM_API_TEMPERATURE');
  if (oTemp !== undefined) {
    out.observeLlmApiTemperature = parseTemperatureInput(oTemp);
  }
  const fTemp = get('PROMPTPILE_REACT_FINAL_LLM_API_TEMPERATURE');
  if (fTemp !== undefined) {
    out.finalLlmApiTemperature = parseTemperatureInput(fTemp);
  }
  const thoughtApi = get('PROMPTPILE_REACT_THOUGHT_LLM_API');
  if (thoughtApi !== undefined) {
    out.thoughtLlmApi = thoughtApi;
  }
  const observeApi = get('PROMPTPILE_REACT_OBSERVE_LLM_API');
  if (observeApi !== undefined) {
    out.observeLlmApi = observeApi;
  }
  const finalApi = get('PROMPTPILE_REACT_FINAL_LLM_API');
  if (finalApi !== undefined) {
    out.finalLlmApi = finalApi;
  }
  return out;
};

export const mapProcessEnvShared = (): SharedEnvLayer => {
  const e = process.env;
  const get = (k: string): string | undefined => trimEnv(e[k]);
  return mapRecord(e as Record<string, string>, get);
};

export const mapProcessEnvReact = (): ReactEnvLayer => {
  const e = process.env;
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(e)) {
    if (v !== undefined) {
      r[k] = v;
    }
  }
  return mapReactEnvRecord(r);
};
