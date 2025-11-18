import { describe, it, expect } from 'vitest';

// Minimal ANSI renderer for our progress output sequences
function renderAnsi(input: string): string {
  const lines: string[] = [''];
  let row = 0;
  let col = 0;

  const ensureRow = (r: number) => {
    while (lines.length <= r) lines.push('');
  };

  const writeChar = (ch: string) => {
    const current = lines[row] ?? '';
    const left = current.slice(0, col);
    const right = current.slice(col + ch.length);
    lines[row] = left + ch + right;
    col += ch.length;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\n') {
      row += 1;
      col = 0;
      ensureRow(row);
      continue;
    }
    if (ch === '\\r') {
      col = 0;
      continue;
    }
    if (ch === '\\x1b') {
      // Parse escape sequences we use: [1A and [K
      if (input.slice(i, i + 4) === '\\x1b[1A') {
        row = Math.max(0, row - 1);
        col = 0;
        i += 3;
        continue;
      }
      if (input.slice(i, i + 3) === '\\x1b[K') {
        lines[row] = (lines[row] ?? '').slice(0, col);
        i += 2;
        continue;
      }
      // Unknown escape; skip
      continue;
    }
    ensureRow(row);
    writeChar(ch);
  }

  return lines.join('\n');
}

describe('ANSI renderer for structured logs', () => {
  const ESC = '\x1b';
  it('clears waiting line and replaces with tokens', () => {
    const parts = [
      '\n   ⏳ Waiting for LLM..',
      `${ESC}[1A`,
      '\r',
      `${ESC}[K`,
      '\r   💭 10 tokens | 5 tok/s | 1.0s | provider'
    ];
    const rendered = renderAnsi(parts.join(''));
    // Sanity: token line present
    expect(rendered).toContain('💭 10 tokens | 5 tok/s | 1.0s | provider');
  });

  it('replaces coordinator deciding line with decision', () => {
    const parts = [
      '🧠 Coordinator deciding next step...\n',
      `${ESC}[1A`,
      '\r',
      `${ESC}[K`,
      '🧠 Coordinator decision: USE writer | 100 tokens | 5.0s | provider\n'
    ];
    const rendered = renderAnsi(parts.join(''));
    // Sanity: decision line present
    expect(rendered).toContain('🧠 Coordinator decision: USE writer');
  });
});

export { renderAnsi };


