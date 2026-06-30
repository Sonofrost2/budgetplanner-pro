// Lightweight Sentry reporter for Deno edge functions.
// Uses the Sentry "store" HTTP envelope — no SDK dependency.
const DSN = Deno.env.get("SENTRY_EDGE_DSN") ?? Deno.env.get("SENTRY_DSN_EDGE") ?? "";

function parseDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    const publicKey = url.username;
    const host = url.host;
    const protocol = url.protocol.replace(":", "");
    return { projectId, publicKey, host, protocol };
  } catch {
    return null;
  }
}

const parsed = DSN ? parseDsn(DSN) : null;

function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g, "[JWT]")
      .replace(/(sk_(?:live|test)_[A-Za-z0-9]+)/g, "[PAYSTACK_SECRET]");
  }
  return value;
}

export async function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (!parsed) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const payload = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      environment: Deno.env.get("ENVIRONMENT") ?? "production",
      server_name: context.function_name as string ?? "edge-function",
      tags: { runtime: "deno", ...(context.tags as Record<string, string> ?? {}) },
      extra: Object.fromEntries(
        Object.entries(context).filter(([k]) => k !== "tags").map(([k, v]) => [k, scrub(v)])
      ),
      exception: {
        values: [{
          type: err.name,
          value: scrub(err.message) as string,
          stacktrace: err.stack ? { frames: [{ filename: "edge", function: err.stack.split("\n")[0] }] } : undefined,
        }],
      },
    };
    const endpoint = `${parsed.protocol}://${parsed.host}/api/${parsed.projectId}/store/`;
    const auth = `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=lovable-edge/1.0`;
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentry-Auth": auth },
      body: JSON.stringify(payload),
    });
  } catch {
    // Never throw from telemetry.
  }
}

export function withSentry<T extends (...args: any[]) => Promise<Response>>(
  fnName: string,
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      await reportError(error, { function_name: fnName });
      throw error;
    }
  }) as T;
}