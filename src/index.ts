#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { buildServer } from "./server.js";
import { toBoolOrUndef } from "./tools/shared.js";

function tokensMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function main() {
  const apiKey = process.env.ITGLUE_API_KEY;
  const region = (process.env.ITGLUE_REGION ?? "us").toLowerCase();
  const readOnly = toBoolOrUndef(process.env.ITGLUE_READ_ONLY) === true;

  if (!apiKey) {
    console.error(
      "[itglue-mcp] ITGLUE_API_KEY is not set. The server will start but every tool call will fail.",
    );
  }

  if (process.env.ITGLUE_TRANSPORT === "http") {
    await runHttp(apiKey ?? "", region, readOnly);
    return;
  }

  const server = buildServer({ apiKey: apiKey ?? "placeholder", region, readOnly });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttp(apiKey: string, region: string, readOnly: boolean) {
  const httpToken = process.env.ITGLUE_HTTP_TOKEN;
  if (!httpToken || httpToken.length < 16) {
    console.error(
      "[itglue-mcp] ITGLUE_TRANSPORT=http requires ITGLUE_HTTP_TOKEN " +
        "(>= 16 chars). Aborting — refusing to expose /mcp without auth.",
    );
    process.exit(1);
  }
  const host = process.env.ITGLUE_HTTP_HOST ?? "127.0.0.1";

  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const http = await import("node:http");

  const server = buildServer({ apiKey: apiKey || "placeholder", region, readOnly });
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
      const auth = req.headers["authorization"];
      const presented =
        typeof auth === "string" && auth.startsWith("Bearer ")
          ? auth.slice("Bearer ".length)
          : "";
      if (!presented || !tokensMatch(presented, httpToken)) {
        res.statusCode = 401;
        res.setHeader("WWW-Authenticate", 'Bearer realm="itglue-mcp"');
        res.end();
        return;
      }
      void transport.handleRequest(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  httpServer.listen(port, host, () => {
    console.error(`[itglue-mcp] HTTP transport listening on ${host}:${port}`);
  });
}

main().catch((err) => {
  console.error("[itglue-mcp] fatal:", err);
  process.exit(1);
});
