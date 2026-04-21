#!/usr/bin/env node

import { runPromptpileForward } from './forward-cli';

const code = runPromptpileForward(process.argv);
process.exit(code);
