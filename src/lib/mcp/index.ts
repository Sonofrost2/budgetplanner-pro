import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAccounts from "./tools/list-accounts";
import listTransactions from "./tools/list-transactions";
import createTransaction from "./tools/create-transaction";
import listCategories from "./tools/list-categories";
import listBudgets from "./tools/list-budgets";
import listSavingsGoals from "./tools/list-savings-goals";
import financialSummary from "./tools/financial-summary";

// Build the OAuth issuer from the project ref (Vite inlines this at build time,
// so the entry stays import-safe — no runtime env read). The `.lovable.cloud`
// runtime URL cannot be used as the issuer: mcp-js compares it against the
// direct `supabase.co` issuer published in the OpenID discovery document
// (RFC 8414 §3.3) and rejects any mismatch.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "budget-planner-pro-mcp",
  title: "Budget Planner Pro",
  version: "0.1.0",
  instructions:
    "Personal finance tools for Budget Planner Pro. Read the signed-in user's accounts, transactions, categories, budgets and savings goals, and record new income or expense entries. All amounts are in the user's app currency (default XOF / CFA franc). Transfers are excluded from income and expense summaries.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listAccounts,
    listTransactions,
    createTransaction,
    listCategories,
    listBudgets,
    listSavingsGoals,
    financialSummary,
  ],
});