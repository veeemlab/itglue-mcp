# @veeemlab/itglue-mcp

[![CI](https://github.com/veeemlab/itglue-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/veeemlab/itglue-mcp/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@veeemlab/itglue-mcp?color=blue&label=npm)](https://www.npmjs.com/package/@veeemlab/itglue-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@veeemlab/itglue-mcp?color=blue)](https://www.npmjs.com/package/@veeemlab/itglue-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Model Context Protocol (MCP) server for [IT Glue](https://www.itglue.com/) with full **read + write** support. Talks JSON:API to `api.itglue.com` / `api.eu.itglue.com` / `api.au.itglue.com` and exposes **56 tools** to any MCP-compatible client (Claude Desktop, Claude Code, MCPHub, etc.). Built-in rate limiting and retry-with-backoff keep you safely under IT Glue's 3000 req / 5min ceiling. Destructive operations require explicit confirm tokens; password reveal requires a separate acknowledgement; the HTTP transport requires a bearer token and binds to loopback by default.

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
| `ITGLUE_READ_ONLY` | no | `false` | Set to `true` to skip registration of all 25 mutating tools (create/update/delete/bulk/publish). |
| `ITGLUE_TRANSPORT` | no | stdio | Set to `http` to expose the server over Streamable HTTP on `:PORT/mcp` (with `/health` for liveness). |
| `ITGLUE_HTTP_TOKEN` | when `http` | – | Bearer token required on `/mcp` requests. Must be ≥ 16 chars; server refuses to start without it. |
| `ITGLUE_HTTP_HOST` | no | `127.0.0.1` | Only used when `ITGLUE_TRANSPORT=http`. Loopback by default — set explicitly (`0.0.0.0` etc.) to expose. |
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

**Users** — `list_users`, `get_user`

**Groups** — `list_groups`, `get_group`

**Attachments** — `list_attachments`, `delete_attachment`

**Related Items** — `list_related_items`, `create_related_item`, `delete_related_item`

**Bulk** — `bulk_update`, `bulk_delete` (one tool per operation across resource types)

**Deduplication** — `find_org_match`, `find_contact_match`, `find_config_match`, `scan_duplicates`

**Health** — `itglue_health_check`

### Token-saving `formatOptions`

Every read tool accepts an optional `formatOptions` argument: `format: "compact"` keeps id + a small set of identifying attributes, `fields: [...]` whitelists specific attribute keys, `omitEmpty: true` drops null and empty values. Combine to reduce response tokens by up to 80%.

## How it works

- JSON:API request/response envelopes (`type` + `id` + `attributes`) with kebab-case attribute keys
- `GET` / `POST` / `PATCH` / `DELETE` map cleanly to IT Glue's CRUD verbs
- Errors from the API are parsed and surfaced as `isError: true` tool responses with the original `errors[]` payload
- Transport defaults to `StdioServerTransport`; opt into `StreamableHTTPServerTransport` with `ITGLUE_TRANSPORT=http`

### Rate limiting & retry

Every outbound request goes through a serialized queue with a configurable minimum interval (100 ms by default → ~10 req/s, comfortably under IT Glue's 3000 / 5 min limit). 429 responses are retried up to 3 times with exponential backoff (1 s, 2 s, 4 s) and honor the `Retry-After` header. 408 and 5xx responses are retried **only for GET and DELETE** — POST and PATCH surface the error to the caller, since retrying them risks duplicate side effects.

### LRU response cache

GET responses are kept in an in-memory LRU cache with per-resource TTLs (1 hour for reference data, 5 minutes for organizations/locations, 1 minute for configurations/contacts/documents/flexible-assets, **never** for passwords). Successful write operations invalidate every cache entry for the touched resource.

## Security

This server can read, modify, and delete IT Glue records — including passwords. Guards built in:

- **`ITGLUE_READ_ONLY=true`** disables registration of all 25 mutating tools; `listTools` never advertises them. The intended posture for handing an LLM an inspection-only view.
- **Confirm tokens** are required on every destructive tool. Each tool refuses to run unless the caller passes a verbatim `confirm` value matching the operation: `DELETE_CONFIGURATION`, `DELETE_CONTACT`, `DELETE_DOCUMENT_SECTION`, `DELETE_FLEXIBLE_ASSET`, `DELETE_LOCATION`, `DELETE_ATTACHMENT`, `DELETE_RELATED_ITEM`, `DELETE_PASSWORD`, `PUBLISH_DOCUMENT`, `BULK_UPDATE`, `BULK_DELETE`.
- **`showPassword=true`** on `get_password` / `search_passwords` is conditionally gated: passing it without `confirm: "SHOW_PASSWORD"` is refused. The plaintext path stays available but cannot be hit by accident.
- **Error response redaction**: API error bodies pass through a redactor that masks values whose key matches `/password|secret|token|api_key|otp|private_key/i`. IT Glue sometimes echoes back submitted fields on validation failure — the redactor catches that before the LLM sees them.
- **HTTP transport**: requires `ITGLUE_HTTP_TOKEN` (≥ 16 chars) and binds to `127.0.0.1` by default. `/mcp` requests must carry `Authorization: Bearer <token>`; token comparison uses `timingSafeEqual`. `/health` is unauthenticated for liveness probes.

Passwords are **never cached** regardless of TTL settings.

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
  index.ts            # stdio entry (+ optional HTTP with bearer auth)
  server.ts           # MCP server wiring + read-only filter
  client.ts           # IT Glue HTTP client (throttle, retry, cache)
  cache.ts            # LRU cache + per-resource TTL table
  format.ts           # formatOptions transform
  redact.ts           # secret-key redaction for error responses
  searchFallback.ts   # diacritic / first-word variants for filter[name]
  similarity.ts       # Jaro-Winkler + normalize for dedup tools
  tools/
    organizations.ts
    configurations.ts
    passwords.ts
    documents.ts
    flexibleAssets.ts
    contacts.ts
    locations.ts
    users.ts
    groups.ts
    attachments.ts
    relatedItems.ts
    bulk.ts
    deduplication.ts
    health.ts
    shared.ts         # tool helpers (schemas, errors, pagination, confirm)
    index.ts          # tool registry
```

## License

MIT — see [LICENSE](LICENSE).
