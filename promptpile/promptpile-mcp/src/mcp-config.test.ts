import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { after, describe, it } from 'node:test';
import { parseGatewayTable, parseOptionalPort } from './gateway-config';
import { readMcpConfig, validateServerId } from './mcp-config';

describe('parseOptionalPort', () => {
  it('accepts integer and string port', () => {
    assert.equal(parseOptionalPort(8080, 'ctx'), 8080);
    assert.equal(parseOptionalPort('8765', 'ctx'), 8765);
  });
  it('floors finite floats', () => {
    assert.equal(parseOptionalPort(8765.7, 'ctx'), 8765);
  });
  it('rejects out of range', () => {
    assert.throws(() => parseOptionalPort(0, 'ctx'));
    assert.throws(() => parseOptionalPort(65536, 'ctx'));
  });
  it('returns undefined for absent', () => {
    assert.equal(parseOptionalPort(undefined, 'ctx'), undefined);
  });
});

describe('parseGatewayTable', () => {
  it('coerces string port', () => {
    assert.deepEqual(parseGatewayTable({ port: '3000' }), { port: 3000, token: undefined });
  });
  it('rejects non-numeric string', () => {
    assert.throws(() => parseGatewayTable({ port: 'abc' }));
  });
});

describe('validateServerId', () => {
  it('rejects double underscore in key', () => {
    assert.throws(() => validateServerId('bad__id'), /__/);
  });
  it('rejects characters outside A-Za-z0-9_-', () => {
    assert.throws(() => validateServerId('a.b'));
    assert.throws(() => validateServerId('服务器'));
  });
  it('accepts common keys', () => {
    validateServerId('filesystem');
    validateServerId('my-server_1');
  });
});

describe('readMcpConfig', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cfg-'));
  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults version to 1', () => {
    const p = path.join(dir, 'minimal.toml');
    fs.writeFileSync(p, '[gateway]\nport = 8080\n');
    const c = readMcpConfig(p);
    assert.equal(c.version, 1);
    assert.equal(c.gateway.port, 8080);
  });

  it('warns when version is not 1', () => {
    const p = path.join(dir, 'v2.toml');
    fs.writeFileSync(p, 'version = 2\n[gateway]\nport = 8080\n');
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (...a: unknown[]) => {
      warns.push(a.map(String).join(' '));
    };
    try {
      const c = readMcpConfig(p);
      assert.equal(c.version, 2);
      assert.ok(warns.some((w) => w.includes('version=2')));
    } finally {
      console.warn = orig;
    }
  });

  it('rejects invalid failure_policy', () => {
    const p = path.join(dir, 'bad-policy.toml');
    fs.writeFileSync(
      p,
      '[gateway]\nport = 8080\n\n[behavior]\nfailure_policy = "oops"\n',
    );
    assert.throws(() => readMcpConfig(p), /failure_policy/);
  });

  it('rejects unsupported transport', () => {
    const p = path.join(dir, 'http-transport.toml');
    fs.writeFileSync(
      p,
      '[gateway]\nport = 8080\n\n[servers.x]\ncommand = "npx"\ntransport = "http"\n',
    );
    assert.throws(() => readMcpConfig(p), /transport/);
  });

  it('accepts transport stdio explicitly', () => {
    const p = path.join(dir, 'stdio.toml');
    fs.writeFileSync(
      p,
      '[gateway]\nport = 8080\n\n[servers.x]\ncommand = "npx"\ntransport = "stdio"\n',
    );
    const c = readMcpConfig(p);
    assert.equal(c.servers.x.transport, 'stdio');
  });

  it('coerces env number and boolean to strings', () => {
    const p = path.join(dir, 'env.toml');
    fs.writeFileSync(
      p,
      '[gateway]\nport = 8080\n\n[servers.x]\ncommand = "x"\n\n[servers.x.env]\nN = 42\nB = true\n',
    );
    const c = readMcpConfig(p);
    assert.equal(c.servers.x.env?.N, '42');
    assert.equal(c.servers.x.env?.B, 'true');
  });

  it('rejects server id containing __', () => {
    const p = path.join(dir, 'bad-server-key.toml');
    fs.writeFileSync(
      p,
      '[gateway]\nport = 8080\n\n[servers.bad__id]\ncommand = "x"\n',
    );
    assert.throws(() => readMcpConfig(p), /表键不得包含/);
  });
});
