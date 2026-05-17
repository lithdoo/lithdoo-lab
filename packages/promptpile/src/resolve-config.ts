import fs from 'fs';
import path from 'path';
import type { Config } from './types';
import { parseCli } from './cli';
import { loadEnvFile } from './env-file';
import { loadTomlConfigFile, type ParsedTomlConfig } from './toml-config';
import { parseBoolEnv, trimEnv } from './config';
import { coerceExtraBodyValue, parseExtraBodyInput, type ExtraBody } from './llm-extra-body';
import {
  coerceTemperatureValue,
  DEFAULT_TEMPERATURE,
  parseTemperatureInput
} from './llm-sampling';

/** Pre-merge shape: booleans use undefined = “本层未写”. */
interface FlatLayer {
  directory?: string;
  model?: string;
  apiKey?: string;
  apiKeyEnvName?: string;
  apiBaseUrl?: string;
  output?: string;
  format?: string;
  quiet?: boolean;
  continueMode?: boolean;
  inputMode?: boolean;
  toolsFileEnv?: string;
  afterHookEnv?: string;
  toolChoice?: string;
  insertFiles?: string;
  appendFiles?: string;
  disableTool?: boolean;
  temperature?: number;
  extraBody?: ExtraBody;
}

const trim = (v: string | undefined): string | undefined => {
  if (v === undefined) {
    return undefined;
  }
  const t = v.trim();
  return t === '' ? undefined : t;
};

const getStr = (r: Record<string, unknown>, key: string): string | undefined => {
  const v = r[key];
  if (typeof v === 'string') {
    return trim(v);
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return trim(String(v));
  }
  return undefined;
};

const getNum = (r: Record<string, unknown>, key: string): number | undefined => {
  const v = r[key];
  if (v === undefined) {
    return undefined;
  }
  return coerceTemperatureValue(v);
};

const getBool = (r: Record<string, unknown>, key: string): boolean | undefined => {
  const v = r[key];
  if (typeof v === 'boolean') {
    return v;
  }
  if (typeof v === 'string') {
    return parseBoolEnv(v) ? true : v.trim() === '' ? undefined : false;
  }
  return undefined;
};

const envBool = (val: string | undefined): boolean | undefined => {
  if (val === undefined || val.trim() === '') {
    return undefined;
  }
  return parseBoolEnv(val);
};

const mapProcessEnv = (): FlatLayer => {
  const e = process.env;
  const out: FlatLayer = {};
  const d = trimEnv(e.DEFAULT_DIRECTORY) ?? trimEnv(e.PROMPTPILE_DIR);
  if (d !== undefined) {
    out.directory = d;
  }
  const m = trimEnv(e.AI_MODEL);
  if (m !== undefined) {
    out.model = m;
  }
  const k = trimEnv(e.AI_API_KEY);
  if (k !== undefined) {
    out.apiKey = k;
  }
  const kn = trimEnv(e.PROMPTPILE_LLM_API_KEY_ENV);
  if (kn !== undefined) {
    out.apiKeyEnvName = kn;
  }
  const b = trimEnv(e.AI_API_BASE_URL);
  if (b !== undefined) {
    out.apiBaseUrl = b;
  }
  const o = trimEnv(e.OUTPUT_FILE);
  if (o !== undefined) {
    out.output = o;
  }
  const q = envBool(e.QUIET);
  if (q !== undefined) {
    out.quiet = q;
  }
  const f = trimEnv(e.PROMPTPILE_FORMAT);
  if (f !== undefined) {
    out.format = f;
  }
  const cont = envBool(e.PROMPTPILE_CONTINUE);
  if (cont !== undefined) {
    out.continueMode = cont;
  }
  const inp = envBool(e.PROMPTPILE_INPUT);
  if (inp !== undefined) {
    out.inputMode = inp;
  }
  const tf = trimEnv(e.TOOLS_FILE) ?? trimEnv(e.PROMPTPILE_TOOLS_FILE);
  if (tf !== undefined) {
    out.toolsFileEnv = tf;
  }
  const ah = trimEnv(e.AFTER_HOOK_PATH);
  if (ah !== undefined) {
    out.afterHookEnv = ah;
  }
  const tc = trimEnv(e.TOOL_CHOICE);
  if (tc !== undefined) {
    out.toolChoice = tc;
  }
  const ins = trimEnv(e.PROMPTPILE_INSERT_FILES);
  if (ins !== undefined) {
    out.insertFiles = ins;
  }
  const app = trimEnv(e.PROMPTPILE_APPEND_FILES);
  if (app !== undefined) {
    out.appendFiles = app;
  }
  const dis = envBool(e.PROMPTPILE_DISABLE_TOOL);
  if (dis !== undefined) {
    out.disableTool = dis;
  }
  const temp =
    trimEnv(e.PROMPTPILE_LLM_API_TEMPERATURE) ?? trimEnv(e.AI_TEMPERATURE);
  if (temp !== undefined) {
    out.temperature = parseTemperatureInput(temp);
  }
  const extraBody = trimEnv(e.PROMPTPILE_LLM_API_EXTRA_BODY);
  if (extraBody !== undefined) {
    out.extraBody = parseExtraBodyInput(extraBody);
  }
  return out;
};

const mapDotEnvRecord = (r: Record<string, string>): FlatLayer => {
  const get = (k: string): string | undefined => trim(r[k]);
  const out: FlatLayer = {};
  const d = get('DEFAULT_DIRECTORY') ?? get('PROMPTPILE_DIR');
  if (d !== undefined) {
    out.directory = d;
  }
  const m = get('AI_MODEL');
  if (m !== undefined) {
    out.model = m;
  }
  const k = get('AI_API_KEY');
  if (k !== undefined) {
    out.apiKey = k;
  }
  const kn = get('PROMPTPILE_LLM_API_KEY_ENV');
  if (kn !== undefined) {
    out.apiKeyEnvName = kn;
  }
  const b = get('AI_API_BASE_URL');
  if (b !== undefined) {
    out.apiBaseUrl = b;
  }
  const o = get('OUTPUT_FILE');
  if (o !== undefined) {
    out.output = o;
  }
  const q = envBool(r.QUIET);
  if (q !== undefined) {
    out.quiet = q;
  }
  const f = get('PROMPTPILE_FORMAT');
  if (f !== undefined) {
    out.format = f;
  }
  const cont = envBool(r.PROMPTPILE_CONTINUE);
  if (cont !== undefined) {
    out.continueMode = cont;
  }
  const inp = envBool(r.PROMPTPILE_INPUT);
  if (inp !== undefined) {
    out.inputMode = inp;
  }
  const tf = get('TOOLS_FILE') ?? get('PROMPTPILE_TOOLS_FILE');
  if (tf !== undefined) {
    out.toolsFileEnv = tf;
  }
  const ah = get('AFTER_HOOK_PATH');
  if (ah !== undefined) {
    out.afterHookEnv = ah;
  }
  const tc = get('TOOL_CHOICE');
  if (tc !== undefined) {
    out.toolChoice = tc;
  }
  const ins = get('PROMPTPILE_INSERT_FILES');
  if (ins !== undefined) {
    out.insertFiles = ins;
  }
  const app = get('PROMPTPILE_APPEND_FILES');
  if (app !== undefined) {
    out.appendFiles = app;
  }
  const dis = envBool(r.PROMPTPILE_DISABLE_TOOL);
  if (dis !== undefined) {
    out.disableTool = dis;
  }
  const temp = get('PROMPTPILE_LLM_API_TEMPERATURE') ?? get('AI_TEMPERATURE');
  if (temp !== undefined) {
    out.temperature = parseTemperatureInput(temp);
  }
  const extraBody = get('PROMPTPILE_LLM_API_EXTRA_BODY');
  if (extraBody !== undefined) {
    out.extraBody = parseExtraBodyInput(extraBody);
  }
  return out;
};

const buildTomlLayer = (parsed: ParsedTomlConfig): FlatLayer => {
  const p = parsed.promptpile;
  const out: FlatLayer = {};
  const dir = getStr(p, 'dir');
  if (dir !== undefined) {
    out.directory = dir;
  }
  const fmt = getStr(p, 'format');
  if (fmt !== undefined) {
    out.format = fmt;
  }
  const outv = p.output;
  if (typeof outv === 'string') {
    const t = trim(outv);
    if (t !== undefined) {
      out.output = t;
    }
  }
  const qb = getBool(p, 'quiet');
  if (qb !== undefined) {
    out.quiet = qb;
  }
  const ah = getStr(p, 'after_hook');
  if (ah !== undefined) {
    out.afterHookEnv = ah;
  }
  const tc = getStr(p, 'tool_choice');
  if (tc !== undefined) {
    out.toolChoice = tc;
  }
  const tf = getStr(p, 'tools_file');
  if (tf !== undefined) {
    out.toolsFileEnv = tf;
  }
  const dt = getBool(p, 'disable_tool');
  if (dt !== undefined) {
    out.disableTool = dt;
  }
  const cm = getBool(p, 'continue');
  if (cm !== undefined) {
    out.continueMode = cm;
  }
  const im = getBool(p, 'input');
  if (im !== undefined) {
    out.inputMode = im;
  }
  const ins = getStr(p, 'insert_files');
  if (ins !== undefined) {
    out.insertFiles = ins;
  }
  const app = getStr(p, 'append_files');
  if (app !== undefined) {
    out.appendFiles = app;
  }

  const profileName = getStr(p, 'llm_api');
  let model = getStr(p, 'llm_api_model');
  let baseUrl = getStr(p, 'llm_api_base_url');
  let apiKey = getStr(p, 'llm_api_key');
  let apiKeyEnv = getStr(p, 'llm_api_key_env');
  let temperature = getNum(p, 'llm_api_temperature');
  let extraBody =
    p.llm_api_extra_body !== undefined
      ? coerceExtraBodyValue(p.llm_api_extra_body)
      : undefined;
  if (profileName) {
    const prof = parsed.llmApis.find(
      x => x.name.toLowerCase() === profileName!.toLowerCase()
    );
    if (prof) {
      model = model ?? trim(prof.model);
      baseUrl = baseUrl ?? trim(prof.base_url);
      apiKey = apiKey ?? trim(prof.api_key);
      apiKeyEnv = apiKeyEnv ?? trim(prof.api_key_env);
      temperature = temperature ?? prof.temperature;
      extraBody = extraBody ?? prof.extra_body;
    }
  }
  if (model !== undefined) {
    out.model = model;
  }
  if (baseUrl !== undefined) {
    out.apiBaseUrl = baseUrl;
  }
  if (apiKey !== undefined) {
    out.apiKey = apiKey;
  }
  if (apiKeyEnv !== undefined) {
    out.apiKeyEnvName = apiKeyEnv;
  }
  if (temperature !== undefined) {
    out.temperature = temperature;
  }
  if (extraBody !== undefined) {
    out.extraBody = extraBody;
  }
  return out;
};

const pickStr = (
  cli: string | undefined,
  toml: string | undefined,
  scan: string | undefined,
  cwd: string | undefined,
  proc: string | undefined,
  fallback?: string
): string => {
  const v =
    trim(cli) ?? trim(toml) ?? trim(scan) ?? trim(cwd) ?? trim(proc) ?? trim(fallback);
  return v ?? '';
};

const pickOptStr = (
  cli: string | undefined,
  toml: string | undefined,
  scan: string | undefined,
  cwd: string | undefined,
  proc: string | undefined
): string | undefined => trim(cli) ?? trim(toml) ?? trim(scan) ?? trim(cwd) ?? trim(proc);

const pickNum = (
  cli: number | undefined,
  toml: number | undefined,
  scan: number | undefined,
  cwd: number | undefined,
  proc: number | undefined,
  fallback: number
): number => {
  if (cli !== undefined) {
    return cli;
  }
  if (toml !== undefined) {
    return toml;
  }
  if (scan !== undefined) {
    return scan;
  }
  if (cwd !== undefined) {
    return cwd;
  }
  if (proc !== undefined) {
    return proc;
  }
  return fallback;
};

const pickRecord = (
  cli: ExtraBody | undefined,
  toml: ExtraBody | undefined,
  scan: ExtraBody | undefined,
  cwd: ExtraBody | undefined,
  proc: ExtraBody | undefined
): ExtraBody | undefined => {
  if (cli !== undefined) {
    return cli;
  }
  if (toml !== undefined) {
    return toml;
  }
  if (scan !== undefined) {
    return scan;
  }
  if (cwd !== undefined) {
    return cwd;
  }
  if (proc !== undefined) {
    return proc;
  }
  return undefined;
};

const pickBool = (
  cli: boolean | undefined,
  toml: boolean | undefined,
  scan: boolean | undefined,
  cwd: boolean | undefined,
  proc: boolean | undefined,
  def: boolean
): boolean => {
  if (cli !== undefined) {
    return cli;
  }
  if (toml !== undefined) {
    return toml;
  }
  if (scan !== undefined) {
    return scan;
  }
  if (cwd !== undefined) {
    return cwd;
  }
  if (proc !== undefined) {
    return proc;
  }
  return def;
};

const mapCliToFlat = (cli: Partial<Config>): FlatLayer => ({
  directory: trim(cli.directory),
  model: trim(cli.model),
  apiKey: trim(cli.apiKey),
  apiBaseUrl: trim(cli.apiBaseUrl),
  output: trim(cli.output),
  format: trim(cli.format),
  quiet: cli.quiet,
  continueMode: cli.continueMode,
  inputMode: cli.inputMode,
  toolChoice: trim(cli.toolChoice),
  disableTool: cli.disableTool,
  temperature: cli.temperature,
  extraBody: cli.extraBody
});

export const computeDir0 = (
  cwd: string,
  cliDir: string | undefined,
  tomlDir: string | undefined,
  cwdDotDir: string | undefined,
  procDir: string | undefined
): string => {
  const rel =
    trim(cliDir) ??
    trim(tomlDir) ??
    trim(cwdDotDir) ??
    trim(procDir) ??
    './messages';
  return path.resolve(cwd, rel);
};

export const resolveConfig = (cwd: string, argv: string[]): Config => {
  let cliPartial: Partial<Config>;
  let configPath: string | undefined;
  try {
    const parsed = parseCli(argv);
    configPath = parsed.configPath;
    cliPartial = parsed.options;
  } catch (e) {
    console.error('Error: Invalid CLI options:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const rawConfigPath = configPath;

  let tomlParsed: ParsedTomlConfig = { promptpile: {}, llmApis: [] };
  if (rawConfigPath !== undefined && rawConfigPath !== '') {
    const abs = path.isAbsolute(rawConfigPath)
      ? rawConfigPath
      : path.resolve(cwd, rawConfigPath);
    if (!fs.existsSync(abs)) {
      console.error(`Error: config file not found: ${abs}`);
      process.exit(1);
    }
    try {
      tomlParsed = loadTomlConfigFile(abs);
    } catch (e) {
      console.error(`Error: failed to parse TOML config: ${abs}`, e);
      process.exit(1);
    }
  }

  const cwdEnvPath = path.join(cwd, '.env');
  const cwdEnvMap = loadEnvFile(cwdEnvPath);
  const cwdLayer = mapDotEnvRecord(cwdEnvMap);

  const tomlLayer = buildTomlLayer(tomlParsed);

  const procLayer = mapProcessEnv();

  const dir0 = computeDir0(
    cwd,
    cliPartial.directory,
    tomlLayer.directory,
    cwdLayer.directory,
    procLayer.directory
  );

  const scanEnvPath = path.join(dir0, '.env');
  const scanEnvMap = loadEnvFile(scanEnvPath);
  const scanLayer = mapDotEnvRecord(scanEnvMap);

  const cliLayer = mapCliToFlat(cliPartial);

  const directory = pickStr(
    cliLayer.directory,
    tomlLayer.directory,
    scanLayer.directory,
    cwdLayer.directory,
    procLayer.directory,
    './messages'
  );
  const resolvedDirAbs = path.isAbsolute(directory) ? directory : path.resolve(cwd, directory);

  const model = pickStr(
    cliLayer.model,
    tomlLayer.model,
    scanLayer.model,
    cwdLayer.model,
    procLayer.model,
    'gpt-3.5-turbo'
  );
  const apiBaseUrl = pickStr(
    cliLayer.apiBaseUrl,
    tomlLayer.apiBaseUrl,
    scanLayer.apiBaseUrl,
    cwdLayer.apiBaseUrl,
    procLayer.apiBaseUrl,
    'https://api.openai.com/v1'
  );

  const apiKeyDirect = pickOptStr(
    cliLayer.apiKey,
    tomlLayer.apiKey,
    scanLayer.apiKey,
    cwdLayer.apiKey,
    procLayer.apiKey
  );
  const apiKeyEnvName = pickOptStr(
    undefined,
    tomlLayer.apiKeyEnvName,
    scanLayer.apiKeyEnvName,
    cwdLayer.apiKeyEnvName,
    procLayer.apiKeyEnvName
  );
  let apiKey = apiKeyDirect ?? '';
  if (apiKey === '' && apiKeyEnvName !== undefined) {
    apiKey = trim(process.env[apiKeyEnvName]) ?? '';
  }

  const fmtRaw = pickOptStr(
    cliLayer.format,
    tomlLayer.format,
    scanLayer.format,
    cwdLayer.format,
    procLayer.format
  );
  const format: 'text' | 'json' = fmtRaw === 'json' ? 'json' : 'text';

  const output = pickOptStr(
    cliLayer.output,
    tomlLayer.output,
    scanLayer.output,
    cwdLayer.output,
    procLayer.output
  );

  const quiet = pickBool(
    cliLayer.quiet,
    tomlLayer.quiet,
    scanLayer.quiet,
    cwdLayer.quiet,
    procLayer.quiet,
    false
  );

  const continueMode = pickBool(
    cliLayer.continueMode,
    tomlLayer.continueMode,
    scanLayer.continueMode,
    cwdLayer.continueMode,
    procLayer.continueMode,
    false
  );

  const inputMode = pickBool(
    cliLayer.inputMode,
    tomlLayer.inputMode,
    scanLayer.inputMode,
    cwdLayer.inputMode,
    procLayer.inputMode,
    false
  );

  const disableTool = pickBool(
    cliLayer.disableTool,
    tomlLayer.disableTool,
    scanLayer.disableTool,
    cwdLayer.disableTool,
    procLayer.disableTool,
    false
  );

  const toolsFileEnv = pickOptStr(
    undefined,
    tomlLayer.toolsFileEnv,
    scanLayer.toolsFileEnv,
    cwdLayer.toolsFileEnv,
    procLayer.toolsFileEnv
  );

  const afterHookEnv = pickOptStr(
    undefined,
    tomlLayer.afterHookEnv,
    scanLayer.afterHookEnv,
    cwdLayer.afterHookEnv,
    procLayer.afterHookEnv
  );

  const toolChoice = pickOptStr(
    cliLayer.toolChoice,
    tomlLayer.toolChoice,
    scanLayer.toolChoice,
    cwdLayer.toolChoice,
    procLayer.toolChoice
  );

  const insertFilesMerged = pickOptStr(
    cliPartial.insertFilesCli,
    tomlLayer.insertFiles,
    scanLayer.insertFiles,
    cwdLayer.insertFiles,
    procLayer.insertFiles
  );

  const appendFilesMerged = pickOptStr(
    cliPartial.appendFilesCli,
    tomlLayer.appendFiles,
    scanLayer.appendFiles,
    cwdLayer.appendFiles,
    procLayer.appendFiles
  );

  const temperature = pickNum(
    cliLayer.temperature,
    tomlLayer.temperature,
    scanLayer.temperature,
    cwdLayer.temperature,
    procLayer.temperature,
    DEFAULT_TEMPERATURE
  );

  const extraBody = pickRecord(
    cliLayer.extraBody,
    tomlLayer.extraBody,
    scanLayer.extraBody,
    cwdLayer.extraBody,
    procLayer.extraBody
  );

  return {
    directory: resolvedDirAbs,
    model,
    apiKey,
    apiBaseUrl,
    temperature,
    extraBody,
    format,
    continueMode,
    inputMode,
    output,
    quiet,
    toolsFileCli: cliPartial.toolsFileCli,
    toolsFileEnv,
    insertFilesCli: insertFilesMerged,
    appendFilesCli: appendFilesMerged,
    afterHookCli: cliPartial.afterHookCli,
    afterHookEnv,
    toolChoice,
    disableTool
  };
};
