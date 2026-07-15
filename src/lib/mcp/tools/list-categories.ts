import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description: "List the signed-in user's transaction categories (with icon, color and type).",
  inputSchema: {
    type: z.enum(["income", "expense"]).optional().describe("Filter by category type."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("categories")
      .select("id, name, icon, color, type, parent_category_id")
      .order("name");
    if (type) query = query.eq("type", type);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ categories: data ?? [] });
  },
});