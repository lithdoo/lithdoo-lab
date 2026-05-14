import fs from 'fs';
import dotenv from 'dotenv';

/**
 * Parse a .env file into a plain map without mutating process.env.
 */
export const loadEnvFile = (absPath: string): Record<string, string> => {
  try {
    if (!fs.existsSync(absPath)) {
      return {};
    }
    const raw = fs.readFileSync(absPath, 'utf8');
    return dotenv.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
};
