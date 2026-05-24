import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ITGlueClient } from "./client.js";
import { applyFormat, pickFormatOptions } from "./format.js";
import {
  allTools,
  errorResult,
  textResult,
  type ToolDefinition,
} from "./tools/index.js";

export interface BuildServerOptions {
  apiKey: string;
  region: string;
  name?: string;
  version?: string;
  readOnly?: boolean;
}

const MUTATING_NAME_PATTERN = /^itglue_(create|update|delete|bulk|publish)_/;

export function isMutatingTool(name: string): boolean {
  return MUTATING_NAME_PATTERN.test(name);
}

export function selectTools(readOnly: boolean): ToolDefinition[] {
  return readOnly ? allTools.filter((t) => !isMutatingTool(t.name)) : allTools;
}

export function buildServer(opts: BuildServerOptions): Server {
  const client = new ITGlueClient({ apiKey: opts.apiKey, region: opts.region });
  const readOnly = opts.readOnly ?? false;
  const enabledTools = selectTools(readOnly);
  const toolMap = new Map<string, ToolDefinition>();
  for (const t of enabledTools) toolMap.set(t.name, t);

  if (readOnly) {
    const skipped = allTools.length - enabledTools.length;
    console.error(
      `[itglue-mcp] read-only mode: exposing ${enabledTools.length} tools, skipping ${skipped} mutating tools`,
    );
  }

  const server = new Server(
    {
      name: opts.name ?? "itglue-mcp",
      version: opts.version ?? "0.1.0",
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: enabledTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const tool = toolMap.get(name);
    if (!tool) {
      return errorResult(new Error(`Unknown tool: ${name}`));
    }
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await tool.handler(args, { client });
      const formatted = applyFormat(result, pickFormatOptions(args));
      return textResult(formatted);
    } catch (err) {
      return errorResult(err);
    }
  });

  return server;
}
