import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

function waitForOutput(proc: any, match: RegExp, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for: ${match}`)), timeoutMs);
    const handler = (data: Buffer) => {
      if (match.test(data.toString())) {
        clearTimeout(timer);
        proc.stdout?.off('data', handler);
        proc.stderr?.off('data', handler);
        resolve(true);
      }
    };
    proc.stdout?.on('data', handler);
    proc.stderr?.on('data', handler);
  });
}

function startServer(cmd: string, args: string[], env: Record<string, string | undefined> = {}) {
  const proc = spawn(cmd, args, { env: { ...process.env, ...env } });
  return proc;
}

describe('MCP OAuth - Direct Client Validation', () => {
  let authProc: any;
  
  beforeAll(async () => {
    // Start OAuth-protected MCP server
    authProc = startServer('node', ['mcp/auth-server/server.mjs'], { PORT: '3501' });
    await waitForOutput(authProc, /listening on :3501/);
  }, 30000);
  
  afterAll(async () => {
    if (authProc) {
      authProc.kill('SIGKILL');
      authProc = null;
    }
    // Give processes time to terminate
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  
  it('MCP client fails to connect without OAuth token', async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost:3501/mcp')
    );
    
    const client = new MCPClient({
      name: 'test-client',
      version: '1.0.0'
    });
    
    let error: any;
    try {
      await client.connect(transport);
      // Try to list tools (should fail)
      await client.listTools();
    } catch (e) {
      error = e;
    }
    
    expect(error).toBeDefined();
    // The error should indicate authentication failure
    const errorStr = String(error?.message || error || '');
    expect(errorStr).toMatch(/401|unauthorized|authentication/i);
  }, 20000);
  
  it('obtains OAuth token from token endpoint', async () => {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'test-client',
      client_secret: 'test-secret'
    });
    
    const response = await fetch('http://localhost:3501/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.access_token).toBe('test-oauth-token-12345');
    expect(data.token_type).toBe('Bearer');
    expect(data.expires_in).toBe(3600);
  }, 20000);
  
  it('rejects invalid OAuth credentials', async () => {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'wrong-client',
      client_secret: 'wrong-secret'
    });
    
    const response = await fetch('http://localhost:3501/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('invalid_client');
  }, 20000);
});
