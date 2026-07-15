import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_transactions",
  title: "List transactions",
  description:
    "List the signed-in user's recent transactions (income, expense, transfers). Supports date range, type and limit filters.",
  inputSchema: {
    type: z.enum(["income", "expense"]).optional().describe("Filter by transaction type."),
    start_date: z.string().optional().describe("ISO date (YYYY-MM-DD) lower bound, inclusive."),
    end_date: z.string().optional().describe("ISO date (YYYY-MM-DD) upper bound, inclusive."),
    limit: z.number().int().positive().max(200).optional().describe("Max rows to return (default 50, max 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, start_date, end_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("transactions")
      .select("id, date, description, amount, type, notes, tags, category_id, account_id, linked_transfer_id, created_at")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(limit ?? 50, 200));
    if (type) query = query.eq("type", type);
    if (start_date) query = query.gte("date", start_date);
    if (end_date) query = query.lte("date", end_date);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ transactions: data ?? [], count: data?.length ?? 0 });
  },
});