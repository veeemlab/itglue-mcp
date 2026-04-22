import type { ToolDefinition } from "./shared.js";

export const healthTools: ToolDefinition[] = [
  {
    name: "itglue_health_check",
    description:
      "Ping IT Glue by requesting a single organization. Returns status, region host and whether the API key is accepted.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (_args, { client }) => {
      try {
        const res = await client.get("/organizations", { "page[size]": 1 });
        const meta = (res as { meta?: Record<string, unknown> }).meta ?? {};
        return {
          ok: true,
          baseUrl: client.baseHost,
          meta,
        };
      } catch (err) {
        const status =
          err && typeof err === "object" && "status" in (err as Record<string, unknown>)
            ? (err as { status?: number }).status
            : undefined;
        const body =
          err && typeof err === "object" && "body" in (err as Record<string, unknown>)
            ? (err as { body?: unknown }).body
            : undefined;
        return {
          ok: false,
          baseUrl: client.baseHost,
          status,
          error: err instanceof Error ? err.message : String(err),
          details: body,
        };
      }
    },
  },
];
