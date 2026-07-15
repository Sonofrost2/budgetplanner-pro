import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_savings_goals",
  title: "List savings goals",
  description: "List the signed-in user's savings goals with progress toward target amount.",
  inputSchema: {
    status: z.enum(["active", "completed", "archived"]).optional().describe("Filter by goal status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("savings_goals")
      .select("id, name, target_amount, current_amount, deadline, status, priority, monthly_contribution, icon, account_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ goals: data ?? [] });
  },
});