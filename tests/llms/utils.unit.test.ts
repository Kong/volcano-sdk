import { describe, it, expect } from 'vitest';
import { mergeHeaders } from '../../dist/llms/utils.js';

describe('mergeHeaders utility', () => {
  it('returns required headers when no default headers provided', () => {
    const required = { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' };
    const result = mergeHeaders(required);
    expect(result).toEqual(required);
  });

  it('returns required headers when default headers is undefined', () => {
    const required = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(required, undefined);
    expect(result).toEqual(required);
  });

  it('merges default headers with required headers', () => {
    const required = { 'Content-Type': 'application/json' };
    const defaults = { 'X-Custom-Header': 'custom-value', 'X-User-ID': 'user-123' };
    const result = mergeHeaders(required, defaults);
    expect(result).toEqual({
      'Content-Type': 'application/json',
      'X-Custom-Header': 'custom-value',
      'X-User-ID': 'user-123',
    });
  });

  it('required headers take precedence over default headers', () => {
    const required = { 'Authorization': 'Bearer required-token', 'Content-Type': 'application/json' };
    const defaults = { 'Authorization': 'Bearer default-token', 'X-Custom': 'value' };
    const result = mergeHeaders(required, defaults);
    expect(result).toEqual({
      'Authorization': 'Bearer required-token', // Should use required, not default
      'Content-Type': 'application/json',
      'X-Custom': 'value',
    });
  });

  it('handles empty default headers object', () => {
    const required = { 'Content-Type': 'application/json' };
    const defaults = {};
    const result = mergeHeaders(required, defaults);
    expect(result).toEqual(required);
  });

  it('handles empty required headers object', () => {
    const required = {};
    const defaults = { 'X-Custom': 'value' };
    const result = mergeHeaders(required, defaults);
    expect(result).toEqual({ 'X-Custom': 'value' });
  });

  it('preserves all headers from both objects', () => {
    const required = { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' };
    const defaults = { 'X-Header-1': 'value1', 'X-Header-2': 'value2', 'X-Header-3': 'value3' };
    const result = mergeHeaders(required, defaults);
    expect(result).toEqual({
      'Authorization': 'Bearer token',
      'Content-Type': 'application/json',
      'X-Header-1': 'value1',
      'X-Header-2': 'value2',
      'X-Header-3': 'value3',
    });
  });
});
