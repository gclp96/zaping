import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const globalsCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
const rootLayout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');

describe('global semantic foundation', () => {
  it('defines the required semantic color families', () => {
    const requiredTokens = [
      '--background',
      '--foreground',
      '--surface',
      '--surface-subtle',
      '--surface-elevated',
      '--text',
      '--text-secondary',
      '--text-muted',
      '--border',
      '--border-strong',
      '--primary',
      '--primary-foreground',
      '--primary-hover',
      '--success',
      '--success-foreground',
      '--success-subtle',
      '--warning',
      '--warning-foreground',
      '--warning-subtle',
      '--danger',
      '--danger-foreground',
      '--danger-subtle',
      '--info',
      '--info-foreground',
      '--info-subtle',
      '--neutral',
      '--neutral-foreground',
      '--neutral-subtle',
    ];

    for (const token of requiredTokens) {
      expect(globalsCss).toContain(`${token}:`);
      expect(globalsCss).toContain(`--color-${token.slice(2)}:`);
    }
  });

  it('defines depth, radius, layers, motion, and focus foundations', () => {
    const requiredTokens = [
      '--radius-small',
      '--radius-medium',
      '--radius-large',
      '--elevation-subtle',
      '--elevation-popover',
      '--elevation-modal',
      '--z-base',
      '--z-sticky',
      '--z-popover',
      '--z-drawer',
      '--z-modal',
      '--z-toast',
      '--motion-duration-fast',
      '--motion-duration-normal',
      '--motion-easing-standard',
      '--focus-ring',
      '--focus-ring-offset',
      '--focus-ring-width',
    ];

    for (const token of requiredTokens) {
      expect(globalsCss).toContain(`${token}:`);
    }
  });

  it('keeps existing semantic utility aliases defined', () => {
    expect(globalsCss).toContain('--color-card: var(--surface);');
    expect(globalsCss).toContain('--color-muted: var(--surface-subtle);');
    expect(globalsCss).toContain('--color-muted-foreground: var(--text-muted);');
    expect(globalsCss).toContain('--color-ring: var(--focus-ring);');
  });

  it('uses a deliberate light foundation instead of partial automatic dark mode', () => {
    expect(globalsCss).toContain('color-scheme: light;');
    expect(globalsCss).not.toContain('prefers-color-scheme: dark');
  });

  it('uses the existing Geist configuration as the global sans font', () => {
    expect(globalsCss).toContain('--font-sans: var(--font-geist-sans);');
    expect(globalsCss).not.toContain('font-family: Arial');
    expect(rootLayout).toContain('geistSans.variable');
    expect(rootLayout).toContain('geistMono.variable');
    expect(rootLayout).toMatch(/<body className="[^"]*font-sans[^"]*"/);
  });
});
