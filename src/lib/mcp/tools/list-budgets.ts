import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_budgets",
  title: "List budgets",
  description: "List the signed-in user's active budgets with amount, period, control type and category link.",
  inputSchema: {
    include_paused: z.boolean().optional().describe("Include paused budgets. Defaults to false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_paused }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("budgets")
      .select("id, name, amount, period, budget_type, control_type, category_id, alert_threshold, paused_at, occurrence_frequency, reference_date")
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (!include_paused) query = query.is("paused_at", null);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ budgets: data ?? [] });
  },
});