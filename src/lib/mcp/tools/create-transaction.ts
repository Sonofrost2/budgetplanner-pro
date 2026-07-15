import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_transaction",
  title: "Create transaction",
  description:
    "Record a new income or expense transaction for the signed-in user. Amount must be positive; the type field determines direction. Use list_accounts / list_categories to look up ids.",
  inputSchema: {
    type: z.enum(["income", "expense"]).describe("Direction of the transaction."),
    amount: z.number().positive().describe("Amount in the account currency (positive number)."),
    description: z.string().min(1).describe("Short human-readable label."),
    date: z.string().optional().describe("ISO date (YYYY-MM-DD). Defaults to today."),
    account_id: z.string().uuid().optional().describe("Payment account id from list_accounts."),
    category_id: z.string().uuid().optional().describe("Category id from list_categories."),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: ctx.getUserId(),
        type: input.type,
        amount: input.amount,
        description: input.description,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        account_id: input.account_id ?? null,
        category_id: input.category_id ?? null,
        notes: input.notes ?? null,
      })
      .select("id, date, description, amount, type, account_id, category_id")
      .single();
    if (error) return errorResult(error.message);
    return jsonResult({ transaction: data });
  },
});