// Parser for inline AI action tags. Format: [ACTION:type|arg1|arg2|...]
// Strips tags from displayed text and returns structured actions.

export type AIAction =
  | { type: 'create_budget'; category: string; amount: number; raw: string }
  | { type: 'create_savings_goal'; name: string; target: number; raw: string }
  | { type: 'view_module'; module: 'budgets' | 'transactions' | 'savings' | 'debts' | 'wealth' | 'recurring'; raw: string };

const ACTION_RE = /\[ACTION:([a-z_]+)\|([^\]]+)\]/gi;

export function parseAIActions(content: string): { clean: string; actions: AIAction[] } {
  const actions: AIAction[] = [];
  const clean = content.replace(ACTION_RE, (raw, type, args) => {
    const parts = String(args).split('|').map((s) => s.trim());
    try {
      switch (type) {
        case 'create_budget':
          actions.push({ type: 'create_budget', category: parts[0], amount: Number(parts[1]) || 0, raw });
          return '';
        case 'create_savings_goal':
          actions.push({ type: 'create_savings_goal', name: parts[0], target: Number(parts[1]) || 0, raw });
          return '';
        case 'view_module':
          actions.push({ type: 'view_module', module: parts[0] as any, raw });
          return '';
        default:
          return raw;
      }
    } catch {
      return raw;
    }
  }).trim();

  return { clean, actions };
}
