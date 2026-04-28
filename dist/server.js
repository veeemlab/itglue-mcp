import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { ITGlueClient } from "./client.js";
import { applyFormat, pickFormatOptions } from "./format.js";
import { allTools, errorResult, textResult, } from "./tools/index.js";
export function buildServer(opts) {
    const client = new ITGlueClient({ apiKey: opts.apiKey, region: opts.region });
    const toolMap = new Map();
    for (const t of allTools)
        toolMap.set(t.name, t);
    const server = new Server({
        name: opts.name ?? "itglue-mcp",
        version: opts.version ?? "0.1.0",
    }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: allTools.map((t) => ({
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
        const args = (req.params.arguments ?? {});
        try {
            const result = await tool.handler(args, { client });
            const formatted = applyFormat(result, pickFormatOptions(args));
            return textResult(formatted);
        }
        catch (err) {
            return errorResult(err);
        }
    });
    return server;
}
