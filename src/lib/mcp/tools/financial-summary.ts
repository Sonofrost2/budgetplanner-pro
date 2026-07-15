import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "financial_summary",
  title: "Financial summary",
  description:
    "Compute total income, total expense and net balance for the signed-in user over a period. Transfers are excluded. Defaults to the current calendar month.",
  inputSchema: {
    start_date: z.string().optional().describe("ISO date (YYYY-MM-DD). Defaults to first day of current month."),
    end_date: z.string().optional().describe("ISO date (YYYY-MM-DD). Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const defaultEnd = today.toISOString().slice(0, 10);
    const from = start_date ?? defaultStart;
    const to = end_date ?? defaultEnd;

    const { data, error } = await supabase
      .from("transactions")
      .select("amount, type, is_transfer")
      .is("deleted_at", null)
      .gte("date", from)
      .lte("date", to);
    if (error) return errorResult(error.message);

    let income = 0;
    let expense = 0;
    for (const row of data ?? []) {
      if (row.is_transfer) continue;
      const amount = Number(row.amount) || 0;
      if (row.type === "income") income += amount;
      else if (row.type === "expense") expense += amount;
    }
    return jsonResult({
      period: { start_date: from, end_date: to },
      total_income: income,
      total_expense: expense,
      net: income - expense,
      transaction_count: data?.length ?? 0,
    });
  },
});