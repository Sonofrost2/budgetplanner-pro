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
  // Geolocated currency symbol table — same role as lib/currency.ts but
  // landing-page focused (kept separate to avoid auth pulls in marketing).
  'hooks/useGeolocatedCurrency.tsx',
  // Admin-only screens — ISO codes are referenced in instructions to other
  // admins, not customer-facing prices.
  'pages/dashboard/AdminPricingPage.tsx',
  // FX helper: the toast preview mentions the converted XOF amount alongside
  // its ISO code so admins can sanity-check the result.
  'lib/paystackCurrency.ts',
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
 * Patterns that flag a hardcoded currency mention in USER-FACING strings.
 *
 * We intentionally ignore programmatic uses of ISO codes (default values,
 * <SelectItem value="EUR">, currency lists, etc.) because those are required
 * to wire the dynamic system. We only flag literal symbols/labels that
 * would appear verbatim in the UI.
 */
const PATTERNS: Array<{ name: string; re: RegExp }> = [
  // "FCFA" appears literally in any code form — always a regression
  { name: 'FCFA literal',     re: /\bFCFA\b/ },

  // ISO code embedded INSIDE a longer UI sentence:
  //   "Montant en EUR par mois"  → flagged
  //   = 'EUR'                    → ignored (default value, no spaces around)
  //   value="EUR"                → ignored
  //   ['EUR', 'USD', …]          → ignored
  // Heuristic: the ISO code must be surrounded by other words (whitespace + letters)
  // inside the same string literal.
  {
    name: 'ISO code inside UI sentence',
    re: /['"`][^'"`]*\s(XOF|XAF|GNF|EUR|USD|GBP|CAD|CHF)\s[^'"`]*['"`]|['"`][^'"`]*\s(XOF|XAF|GNF|EUR|USD|GBP|CAD|CHF)['"`]|['"`](XOF|XAF|GNF|EUR|USD|GBP|CAD|CHF)\s[^'"`]*['"`]/,
  },

  // Currency symbol followed (or preceded) by a digit inside a string —
  // typical hardcoded price like "€50", "100 €", "$25"
  { name: '€/£/₦ next to digit',   re: /['"`][^'"`]*([€£₦¥]\s?\d|\d\s?[€££₦¥])[^'"`]*['"`]/ },
  // "$" as money prefix/suffix in a string literal (skip "${...}" templates)
  { name: '$ as money prefix',     re: /['"`][^'"`{}]*\$\s?\d[^'"`{}]*['"`]/ },
  { name: '$ as money suffix',     re: /['"`][^'"`{}]*\d\s?\$[^'"`{}]*['"`]/ },

  // JSX text node containing a currency symbol next to a digit, e.g.
  //   <span>€50</span>  or  >100 € <
  // We require >…< boundaries so we only match real JSX text, not code.
  { name: 'JSX text with currency+digit', re: />[^<>{}]*([€£₦¥]\s?\d|\d\s?[€£₦¥]|\$\s?\d|\d\s?\$)[^<>{}]*</ },
  // JSX text with literal "FCFA" between tags
  { name: 'JSX text with FCFA',     re: />[^<>{}]*\bFCFA\b[^<>{}]*</ },
];

/** Lines containing any of these markers are tolerated (per-line opt-out). */
const LINE_TOLERATE = [
  'currency:',                 // Intl.NumberFormat({ currency: 'XOF' })
  "from '@/lib/currency'",     // imports
  'from "@/lib/currency"',
  'currencySymbol(',
  'formatExample(',
  'exampleValue(',
  'exampleAmount(',
  'priceCurrency:',            // schema.org JSON-LD field name
  'SelectItem value=',         // ISO picker entries
  'CURRENCIES =',              // currency arrays
  'eslint-disable',
  '// allow-currency',         // explicit per-line opt-out marker
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