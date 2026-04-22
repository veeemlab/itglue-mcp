#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";
async function main() {
    const apiKey = process.env.ITGLUE_API_KEY;
    const region = (process.env.ITGLUE_REGION ?? "us").toLowerCase();
    if (!apiKey) {
        console.error("[itglue-mcp] ITGLUE_API_KEY is not set. The server will start but every tool call will fail.");
    }
    if (process.env.ITGLUE_TRANSPORT === "http") {
        await runHttp(apiKey ?? "", region);
        return;
    }
    const server = buildServer({ apiKey: apiKey ?? "placeholder", region });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
async function runHttp(apiKey, region) {
    const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
    const http = await import("node:http");
    const server = buildServer({ apiKey: apiKey || "placeholder", region });
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(transport);
    const port = Number(process.env.PORT ?? 3000);
    const httpServer = http.createServer((req, res) => {
        if (!req.url) {
            res.statusCode = 400;
            res.end();
            return;
        }
        if (req.url === "/health") {
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (req.url.startsWith("/mcp")) {
            void transport.handleRequest(req, res);
            return;
        }
        res.statusCode = 404;
        res.end();
    });
    httpServer.listen(port, () => {
        console.error(`[itglue-mcp] HTTP transport listening on :${port}`);
    });
}
main().catch((err) => {
    console.error("[itglue-mcp] fatal:", err);
    process.exit(1);
});
