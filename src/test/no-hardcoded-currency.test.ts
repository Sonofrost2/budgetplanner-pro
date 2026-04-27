/**
 * Guardrail: detects hardcoded currency symbols (FCFA / XOF / €  / $ / EUR / USD)
 * inside UI string literals across the codebase.
 *
 * Goal: prevent regressions on FR/EN currency harmonisation.
 * Anything user-facing must go through `currencySymbol()` / `formatExample()`
 * / `useProfile().fmt` (see `src/lib/currency.ts`).
 *
 * The scan walks `src/**` and, for every TS/TSX file, looks at:
 *   - JSX text nodes
 *   - String literals passed as `placeholder=`, `title=`, `aria-label=`
 *   - Object literal values for keys like `label`, `title`, `message`,
 *     `placeholder`, `description`, `tooltip`
 *
 * Files / paths in the WHITELIST below are intentionally allowed
 * (currency helpers, denomination tables, comments, marketing copy with no
 * monetary intent, etc.). Add a clear justification when extending it.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..'); // → src/

/** Files (relative to src/) that are allowed to mention raw currency symbols. */
const FILE_WHITELIST = new Set<string>([
  // Centralized currency helpers — by definition contain raw symbols
  'lib/currency.ts',
  // Country dial-codes / locale tables
  'lib/countries.ts',
  // Demo seed (CFA-only by design)
  'lib/demo.ts',
  // SMS template samples — now derived from currency helper, but still
  // exports a deprecated XOF-defaulted constant for back-compat.
  'lib/smsTemplates.ts',
  // Cash count denominations (real banknote values per ISO code)
  'components/dashboard/CashCountDialog.tsx',
  // Test files themselves (this scanner contains the patterns!)
  'test/no-hardcoded-currency.test.ts',
]);

/** Directory prefixes (relative to src/) to skip entirely. */
const DIR_SKIP = ['integrations/', 'test/__snapshots__/'];

/**
 * Patterns that flag a hardcoded currency mention.
 * We deliberately match the SYMBOL/LIBELLÉ inside a string-like context.
 */
const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'FCFA',     re: /\bFCFA\b/ },
  { name: 'XOF/XAF code in string',  re: /['"`][^'"`]*\b(XOF|XAF|GNF)\b[^'"`]*['"`]/ },
  { name: 'EUR/USD code in string',  re: /['"`][^'"`]*\b(EUR|USD|GBP)\b[^'"`]*['"`]/ },
  // € / £ / ₦ / ¥ inside a string literal (any quote type)
  { name: 'currency symbol in string', re: /['"`][^'"`]*[€£₦¥][^'"`]*['"`]/ },
  // "$" used as a money prefix inside a string literal: "$100", "$ 50", "100$"
  // (we ignore "${...}" template interpolations and JS identifiers).
  { name: '$ as money prefix',  re: /['"`][^'"`{}]*\$\s?\d/ },
  { name: '$ as money suffix',  re: /['"`][^'"`{}]*\d\s?\$[^'"`{}]*['"`]/ },
];

/** Lines containing any of these markers are tolerated (per-line opt-out). */
const LINE_TOLERATE = [
  'currency:',           // Intl.NumberFormat({ currency: 'XOF' }) — programmatic
  "from '@/lib/currency'", // imports
  'from "@/lib/currency"',
  'currencySymbol(',
  'formatExample(',
  'exampleValue(',
  'exampleAmount(',
  'eslint-disable',
  '// allow-currency',   // explicit per-line opt-out marker
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).split(sep).join('/');
    if (DIR_SKIP.some((p) => rel.startsWith(p))) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      yield full;
    }
  }
}

interface Hit {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const abs of walk(ROOT)) {
    const rel = relative(ROOT, abs).split(sep).join('/');
    if (FILE_WHITELIST.has(rel)) continue;

    const src = readFileSync(abs, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comment-only lines
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (LINE_TOLERATE.some((m) => line.includes(m))) continue;

      for (const { name, re } of PATTERNS) {
        if (re.test(line)) {
          hits.push({
            file: rel,
            line: i + 1,
            pattern: name,
            snippet: trimmed.slice(0, 160),
          });
          break; // one hit per line is enough
        }
      }
    }
  }
  return hits;
}

describe('Currency harmonisation guardrail', () => {
  it('has no hardcoded currency symbols in user-facing strings', () => {
    const hits = scan();
    if (hits.length > 0) {
      const report = hits
        .map((h) => `  • ${h.file}:${h.line}  [${h.pattern}]\n      ${h.snippet}`)
        .join('\n');
      throw new Error(
        `Found ${hits.length} hardcoded currency mention(s).\n` +
          `Use currencySymbol() / formatExample() from "@/lib/currency" instead,\n` +
          `or whitelist the file in src/test/no-hardcoded-currency.test.ts with a justification.\n\n` +
          report,
      );
    }
    expect(hits).toEqual([]);
  });
});