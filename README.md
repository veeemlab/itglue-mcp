# @veeemlab/itglue-mcp

[![CI](https://img.shields.io/github/actions/workflow/status/veeemlab/itglue-mcp/release.yml?style=for-the-badge&label=CI&logo=github)](https://github.com/veeemlab/itglue-mcp/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@veeemlab/itglue-mcp?style=for-the-badge&color=blue&label=npm)](https://www.npmjs.com/package/@veeemlab/itglue-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@veeemlab/itglue-mcp?style=for-the-badge&color=blue&label=downloads)](https://www.npmjs.com/package/@veeemlab/itglue-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)](LICENSE)

A Model Context Protocol (MCP) server for [IT Glue](https://www.itglue.com/) with full **read + write** support. Talks JSON:API to `api.itglue.com` / `api.eu.itglue.com` / `api.au.itglue.com` and exposes 40+ tools to any MCP-compatible client (Claude Desktop, Claude Code, MCPHub, etc.). Built-in rate limiting and retry-with-backoff keep you safely under IT Glue's 3000 req / 5min ceiling.

## Quick start

Add it to any MCP client's config (example for MCPHub's `mcp_settings.json`):

```json
{
  "itglue": {
    "command": "npx",
    "args": ["-y", "@veeemlab/itglue-mcp"],
    "env": {
      "ITGLUE_API_KEY": "${ITGLUE_API_KEY}",
      "ITGLUE_REGION": "${ITGLUE_REGION}"
    }
  }
}
```

`npx` resolves the latest published version from npm and caches it; subsequent runs are instant.

### Alternative: run from GitHub HEAD

If you want the bleeding-edge `main` branch without waiting for an npm release:

```json
"args": ["-y", "github:veeemlab/itglue-mcp"]
```

## Environment

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `ITGLUE_API_KEY` | yes | – | Sent as the `x-api-key` header. |
| `ITGLUE_REGION` | no | `us` | One of `us`, `eu`, `au`. |
| `ITGLUE_TRANSPORT` | no | stdio | Set to `http` to expose the server over Streamable HTTP on `:PORT/mcp` (with `/health` for liveness). |
| `PORT` | no | `3000` | Only used when `ITGLUE_TRANSPORT=http`. |

## Tools

All tools share the `itglue_` prefix. Read-only tools accept `pageSize` / `pageNumber` for `page[size]` / `page[number]`, plus typed filters that map to `filter[...]`.

**Organizations** — `search_organizations`, `get_organization`

**Configurations** — `search_configurations`, `get_configuration`, `create_configuration`, `update_configuration`, `delete_configuration`, `list_configuration_types`, `list_configuration_statuses`

**Passwords** — `search_passwords`, `get_password`, `create_password`, `update_password`, `delete_password`, `list_password_categories` (pass `showPassword: true` to reveal plaintext)

**Documents** — `search_documents`, `get_document`, `create_document`, `list_document_sections`, `create_document_section`, `update_document_section`, `delete_document_section`, `publish_document`

**Flexible Assets** — `list_flexible_asset_types`, `list_flexible_asset_fields`, `search_flexible_assets`, `get_flexible_asset`, `create_flexible_asset`, `update_flexible_asset`, `delete_flexible_asset`

> Flexible assets use a dynamic `traits` object — always call `list_flexible_asset_fields` for the target type first to learn the valid keys.

**Contacts** — `search_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact`

**Locations** — `list_locations`, `get_location`, `create_location`, `update_location`, `delete_location`

**Health** — `itglue_health_check`

## How it works

- JSON:API request/response envelopes (`type` + `id` + `attributes`) with kebab-case attribute keys
- `GET` / `POST` / `PATCH` / `DELETE` map cleanly to IT Glue's CRUD verbs
- Errors from the API are parsed and surfaced as `isError: true` tool responses with the original `errors[]` payload
- Transport defaults to `StdioServerTransport`; opt into `StreamableHTTPServerTransport` with `ITGLUE_TRANSPORT=http`

### Rate limiting & retry

Every outbound request goes through a serialized queue with a configurable minimum interval (100 ms by default → ~10 req/s, comfortably under IT Glue's 3000 / 5 min limit). Responses with status 408 / 429 / 500 / 502 / 503 / 504 are retried up to 3 times with exponential backoff (1 s, 2 s, 4 s); the `Retry-After` header is honored in both numeric-seconds and HTTP-date forms.

## Why `dist/` is committed

`npx -y github:veeemlab/itglue-mcp` runs the package straight from GitHub without a build step. So the compiled output under `dist/` is intentionally tracked in git. A `prepare` script (`tsc`) regenerates it as a fallback if the package is ever installed from source.

## Local development

```bash
npm install
npm run build        # or npm run dev for watch mode
ITGLUE_API_KEY=... ITGLUE_REGION=eu node dist/index.js
```

Project layout:

```
src/
  index.ts            # stdio entry (+ optional HTTP)
  server.ts           # MCP server wiring
  client.ts           # IT Glue HTTP + JSON:API client
  tools/
    organizations.ts
    configurations.ts
    passwords.ts
    documents.ts
    flexibleAssets.ts
    contacts.ts
    locations.ts
    health.ts
    shared.ts         # tool helpers (schemas, errors, pagination)
    index.ts          # tool registry
```

## License

MIT — see [LICENSE](LICENSE).
