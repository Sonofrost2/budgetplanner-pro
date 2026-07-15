import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_accounts",
  title: "List accounts",
  description:
    "List the signed-in user's payment accounts (cash, bank, mobile money, savings) with opening and real balances.",
  inputSchema: {
    include_archived: z
      .boolean()
      .optional()
      .describe("Include archived accounts. Defaults to false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_archived }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("payment_accounts")
      .select("id, name, type, icon, opening_balance, real_balance, status, archived_at, last_activity_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!include_archived) query = query.is("archived_at", null);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ accounts: data ?? [] });
  },
});