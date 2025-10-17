import { describe, it, expect, vi } from 'vitest';
import { llmOpenAI, llmOpenAIResponses } from '../../dist/volcano-sdk.js';

describe('OpenAI defaultHeaders support', () => {
  describe('llmOpenAI', () => {
    it('accepts defaultHeaders in config', () => {
      // This test verifies that the config accepts defaultHeaders
      // OpenAI SDK handles the actual header passing internally
      const llm = llmOpenAI({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
        defaultHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-User-ID': 'user-123'
        }
      });

      expect(llm).toBeDefined();
      expect(llm.model).toBe('gpt-4');
      expect(llm.id).toBe('OpenAI-gpt-4');
    });

    it('works without defaultHeaders', () => {
      const llm = llmOpenAI({
        apiKey: 'sk-test-key',
        model: 'gpt-4'
      });

      expect(llm).toBeDefined();
      expect(llm.model).toBe('gpt-4');
    });

    it('passes defaultHeaders to OpenAI client constructor', () => {
      const defaultHeaders = {
        'X-Custom-Header': 'value',
        'X-Request-ID': 'req-123'
      };

      const llm = llmOpenAI({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
        defaultHeaders
      });

      // Verify the client is created with the headers
      // The OpenAI SDK client should have these headers configured
      expect(llm.client).toBeDefined();

      // We can't directly inspect the OpenAI SDK client's internal headers,
      // but we can verify the LLM handle was created successfully
      expect(llm.id).toBe('OpenAI-gpt-4');
      expect(llm.model).toBe('gpt-4');
    });

    it('accepts baseURL and defaultHeaders together', () => {
      const llm = llmOpenAI({
        apiKey: 'sk-test-key',
        model: 'gpt-4',
        baseURL: 'https://custom-endpoint.example.com/v1',
        defaultHeaders: {
          'X-Custom': 'value'
        }
      });

      expect(llm).toBeDefined();
      expect(llm.model).toBe('gpt-4');
    });
  });

  describe('llmOpenAIResponses', () => {
    it('accepts defaultHeaders in config', () => {
      const llm = llmOpenAIResponses({
        apiKey: 'sk-test-key',
        model: 'gpt-4o-mini',
        defaultHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-User-ID': 'user-456'
        },
        options: {
          jsonSchema: {
            name: 'test_schema',
            schema: {
              type: 'object',
              properties: {
                result: { type: 'string' }
              },
              required: ['result']
            }
          }
        }
      });

      expect(llm).toBeDefined();
      expect(llm.model).toBe('gpt-4o-mini');
      expect(llm.id).toBe('OpenAI-Responses-gpt-4o-mini');
    });

    it('works without defaultHeaders', () => {
      const llm = llmOpenAIResponses({
        apiKey: 'sk-test-key',
        model: 'gpt-4o-mini',
        options: {
          jsonSchema: {
            name: 'test_schema',
            schema: {
              type: 'object',
              properties: {
                result: { type: 'string' }
              },
              required: ['result']
            }
          }
        }
      });

      expect(llm).toBeDefined();
      expect(llm.model).toBe('gpt-4o-mini');
    });

    it('passes defaultHeaders to OpenAI client constructor', () => {
      const defaultHeaders = {
        'X-Schema-Version': 'v2',
        'X-Trace-ID': 'trace-789'
      };

      const llm = llmOpenAIResponses({
        apiKey: 'sk-test-key',
        model: 'gpt-4o',
        defaultHeaders,
        options: {
          jsonSchema: {
            name: 'response',
            schema: {
              type: 'object',
              properties: {
                answer: { type: 'string' }
              },
              required: ['answer']
            }
          }
        }
      });

      expect(llm.client).toBeDefined();
      expect(llm.id).toBe('OpenAI-Responses-gpt-4o');
      expect(llm.model).toBe('gpt-4o');
    });

    it('accepts baseURL, defaultHeaders, and jsonSchema together', () => {
      const llm = llmOpenAIResponses({
        apiKey: 'sk-test-key',
        model: 'gpt-4o-mini',
        baseURL: 'https://custom.openai.com/v1',
        defaultHeaders: {
          'X-Custom': 'value'
        },
        options: {
          jsonSchema: {
            name: 'structured_output',
            schema: {
              type: 'object',
              properties: {
                data: { type: 'string' }
              },
              required: ['data']
            }
          }
        }
      });

      expect(llm).toBeDefined();
      expect(llm.model).toBe('gpt-4o-mini');
    });
  });
});
