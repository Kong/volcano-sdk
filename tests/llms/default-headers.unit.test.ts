import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { llmAnthropic, llmMistral, llmLlama, llmVertexStudio, llmAzure } from '../../dist/volcano-sdk.js';

describe('defaultHeaders support', () => {
  let originalFetch: typeof global.fetch;
  let fetchCalls: Array<{ url: string; init: RequestInit }>;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchCalls = [];

    // Mock fetch to capture calls
    global.fetch = vi.fn(async (url: any, init: any) => {
      fetchCalls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: 'response' }],
        choices: [{ message: { content: 'response' } }],
        candidates: [{ content: { parts: [{ text: 'response' }] } }],
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'response' }] }]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Anthropic provider', () => {
    it('includes defaultHeaders in fetch calls', async () => {
      const llm = llmAnthropic({
        model: 'claude-3-haiku',
        apiKey: 'test-key',
        defaultHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-User-ID': 'user-123'
        }
      });

      await llm.gen('test prompt');

      expect(fetchCalls.length).toBe(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['X-Custom-Header']).toBe('custom-value');
      expect(headers['X-User-ID']).toBe('user-123');
    });

    it('required headers override defaultHeaders', async () => {
      const llm = llmAnthropic({
        model: 'claude-3-haiku',
        apiKey: 'test-key',
        defaultHeaders: {
          'x-api-key': 'default-key', // This should be overridden
          'X-Custom': 'value'
        }
      });

      await llm.gen('test');

      expect(fetchCalls.length).toBe(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('test-key'); // Should use the required key
      expect(headers['X-Custom']).toBe('value');
    });

    it('works without defaultHeaders', async () => {
      const llm = llmAnthropic({
        model: 'claude-3-haiku',
        apiKey: 'test-key'
      });

      await llm.gen('test');

      expect(fetchCalls.length).toBe(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-api-key']).toBe('test-key');
    });
  });

  describe('Mistral provider', () => {
    it('includes defaultHeaders in fetch calls', async () => {
      const llm = llmMistral({
        model: 'mistral-small-latest',
        apiKey: 'test-key',
        defaultHeaders: {
          'X-Request-ID': 'req-123',
          'X-Client-Version': '1.0.0'
        }
      });

      await llm.gen('test prompt');

      expect(fetchCalls.length).toBe(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['X-Request-ID']).toBe('req-123');
      expect(headers['X-Client-Version']).toBe('1.0.0');
    });

    it('preserves authorization header', async () => {
      const llm = llmMistral({
        model: 'mistral-small',
        apiKey: 'test-key',
        defaultHeaders: {
          'Authorization': 'Bearer wrong-token',
          'X-Custom': 'value'
        }
      });

      await llm.gen('test');

      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-key'); // Should use apiKey
      expect(headers['X-Custom']).toBe('value');
    });
  });

  describe('Llama provider', () => {
    it('includes defaultHeaders in fetch calls', async () => {
      const llm = llmLlama({
        model: 'llama3.2:3b',
        baseURL: 'http://localhost:11434',
        defaultHeaders: {
          'X-Custom-Header': 'llama-value',
          'X-Session-ID': 'session-456'
        }
      });

      await llm.gen('test prompt');

      expect(fetchCalls.length).toBe(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['X-Custom-Header']).toBe('llama-value');
      expect(headers['X-Session-ID']).toBe('session-456');
    });

    it('works with apiKey and defaultHeaders', async () => {
      const llm = llmLlama({
        model: 'llama3.2',
        apiKey: 'test-key',
        defaultHeaders: {
          'X-Custom': 'value'
        }
      });

      await llm.gen('test');

      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-key');
      expect(headers['X-Custom']).toBe('value');
    });
  });

  describe('Vertex Studio provider', () => {
    it('includes defaultHeaders in fetch calls', async () => {
      const llm = llmVertexStudio({
        model: 'gemini-2.0-flash-lite',
        apiKey: 'test-key',
        defaultHeaders: {
          'X-Google-Client': 'custom-client',
          'X-Trace-ID': 'trace-789'
        }
      });

      await llm.gen('test prompt');

      expect(fetchCalls.length).toBe(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['X-Google-Client']).toBe('custom-client');
      expect(headers['X-Trace-ID']).toBe('trace-789');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('preserves required Content-Type header', async () => {
      const llm = llmVertexStudio({
        model: 'gemini-2.0-flash',
        apiKey: 'test-key',
        defaultHeaders: {
          'Content-Type': 'text/plain', // Should be overridden
          'X-Custom': 'value'
        }
      });

      await llm.gen('test');

      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json'); // Required header wins
      expect(headers['X-Custom']).toBe('value');
    });
  });

  describe('Azure provider', () => {
    it('includes defaultHeaders with apiKey auth', async () => {
      const llm = llmAzure({
        model: 'gpt-5-mini',
        endpoint: 'https://test.openai.azure.com/openai/responses',
        apiKey: 'test-key',
        defaultHeaders: {
          'X-Azure-Client': 'custom-client',
          'X-Correlation-ID': 'corr-123'
        }
      });

      await llm.gen('test prompt');

      expect(fetchCalls.length).toBe(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['X-Azure-Client']).toBe('custom-client');
      expect(headers['X-Correlation-ID']).toBe('corr-123');
      expect(headers['api-key']).toBe('test-key');
    });

    it('includes defaultHeaders with accessToken auth', async () => {
      const llm = llmAzure({
        model: 'gpt-5-mini',
        endpoint: 'https://test.openai.azure.com/openai/responses',
        accessToken: 'test-token',
        defaultHeaders: {
          'X-Custom': 'value'
        }
      });

      await llm.gen('test');

      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-token');
      expect(headers['X-Custom']).toBe('value');
    });

    it('preserves Content-Type header', async () => {
      const llm = llmAzure({
        model: 'gpt-5-mini',
        endpoint: 'https://test.openai.azure.com/openai/responses',
        apiKey: 'test-key',
        defaultHeaders: {
          'Content-Type': 'text/plain', // Should be overridden
          'X-Custom': 'value'
        }
      });

      await llm.gen('test');

      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json'); // Required
      expect(headers['X-Custom']).toBe('value');
    });
  });
});
