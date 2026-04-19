#!/usr/bin/env node
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { getCliOptions } from './cli';
import { loadConfig } from './config';
import {
  appendAssistantMessage,
  appendUserMessage,
  buildMessages,
  scanDirectory
} from './file-handler';
import { callAI, callAIStream } from './ai-client';
import { loadToolsJsonl } from './tools-loader';
import type { ToolCall } from './types';

const readUserInputFromTerminal = async (): Promise<string> => {
  console.log('Enter user message. Finish with Ctrl+Z then Enter (Windows), or Ctrl+D (macOS/Linux).');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }

  rl.close();
  return lines.join('\n').trim();
};

const resolveOutputPath = (outputPath: string): string =>
  path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);

/**
 * Ensure parent directory exists and is writable before calling the API.
 */
const ensureOutputPaths = (outputPath: string): string => {
  const resolvedPath = resolveOutputPath(outputPath);
  const dir = path.dirname(resolvedPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    console.error(`Error: Cannot create or write to output directory: ${dir}`);
    process.exit(1);
  }
  return resolvedPath;
};

const callsPathForMainOutput = (resolvedMainPath: string): string => {
  const { dir, name } = path.parse(resolvedMainPath);
  return path.join(dir, `${name}.calls.jsonl`);
};

const writeCallsFile = (resolvedMainPath: string, toolCalls: ToolCall[] | undefined): void => {
  if (!toolCalls || toolCalls.length === 0) {
    return;
  }
  const callsPath = callsPathForMainOutput(resolvedMainPath);
  const body = toolCalls.map(tc => JSON.stringify(tc)).join('\n') + '\n';
  fs.writeFileSync(callsPath, body, 'utf8');
};

const printToolCallsLines = (toolCalls: ToolCall[] | undefined, quiet: boolean): void => {
  if (quiet || !toolCalls?.length) {
    return;
  }
  for (const tc of toolCalls) {
    process.stdout.write(`${JSON.stringify(tc)}\n`);
  }
};

async function main() {
  try {
    const cliOptions = getCliOptions();
    const config = loadConfig(cliOptions);

    if (!config.apiKey) {
      console.error('Error: AI API key is required');
      process.exit(1);
    }

    const quiet = config.quiet;

    if (!quiet) {
      console.log(`Scanning directory: ${config.directory}`);
    }
    let files = scanDirectory(config.directory);

    if (config.inputMode) {
      const userContent = await readUserInputFromTerminal();
      if (!userContent) {
        console.error('Error: Empty input. Nothing was written.');
        process.exit(1);
      }

      const userFilePath = appendUserMessage(config.directory, files, userContent);
      if (!quiet) {
        console.log(`Saved user message: ${userFilePath}`);
      }
      files = scanDirectory(config.directory);
    }
    if (files.length === 0) {
      console.error(
        'Error: No files found matching message patterns ([idx]role.md/json, [idx]assistant.call.jsonl, [idx]assistant.result.jsonl)'
      );
      process.exit(1);
    }

    let tools;
    try {
      tools = loadToolsJsonl(config.directory);
    } catch (e) {
      console.error('Error loading .tools.jsonl:', e instanceof Error ? e.message : e);
      process.exit(1);
    }

    const messages = buildMessages(files);

    let resolvedOutput: string | undefined;
    if (config.output) {
      resolvedOutput = ensureOutputPaths(config.output);
    }

    if (!quiet) {
      console.log(`Calling AI API with ${messages.length} messages...`);
    }

    let response = '';
    let toolCalls: ToolCall[] | undefined;

    if (config.format === 'json') {
      const result = await callAI(
        config.apiKey,
        config.apiBaseUrl,
        config.model,
        messages,
        tools
      );
      response = result.content;
      toolCalls = result.toolCalls;

      if (resolvedOutput) {
        fs.writeFileSync(resolvedOutput, response, 'utf8');
        writeCallsFile(resolvedOutput, toolCalls);
      }
      if (!quiet) {
        process.stdout.write(
          `${JSON.stringify({ response, tool_calls: toolCalls ?? null }, null, 2)}\n`
        );
      }
    } else {
      const result = await callAIStream(
        config.apiKey,
        config.apiBaseUrl,
        config.model,
        messages,
        tools,
        (chunk) => {
          if (!quiet) {
            process.stdout.write(chunk);
          }
        }
      );
      response = result.content;
      toolCalls = result.toolCalls;

      if (resolvedOutput) {
        fs.writeFileSync(resolvedOutput, response, 'utf8');
        writeCallsFile(resolvedOutput, toolCalls);
      }
      printToolCallsLines(toolCalls, quiet);
    }

    if (config.continueMode) {
      const savedPath = appendAssistantMessage(config.directory, files, response);
      if (!quiet) {
        console.log(`Saved assistant reply: ${savedPath}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
