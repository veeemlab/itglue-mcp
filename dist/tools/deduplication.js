import { buildFilters, buildPagination, mergeQuery, } from "../client.js";
import { classifyConfidence, normalize, similarity } from "../similarity.js";
import { requireString, toIntOrUndef, toStrOrUndef, } from "./shared.js";
const SCAN_RESOURCE_TYPES = [
    "organizations",
    "contacts",
    "configurations",
    "locations",
];
const SCAN_RESOURCE_SET = new Set(SCAN_RESOURCE_TYPES);
const DEFAULT_FIND_THRESHOLD = 0.7;
const DEFAULT_FIND_POOL = 100;
const DEFAULT_SCAN_THRESHOLD = 0.85;
const DEFAULT_SCAN_PAGE_SIZE = 50;
const DEFAULT_SCAN_MAX_PAGES = 20;
const HARD_SCAN_CAP = 5000;
function arrayData(doc) {
    return Array.isArray(doc.data) ? doc.data : [];
}
function attr(resource, key) {
    const v = resource.attributes?.[key];
    return typeof v === "string" ? v : "";
}
function roundTo(num, decimals) {
    const f = 10 ** decimals;
    return Math.round(num * f) / f;
}
function resourceDisplayName(r) {
    const a = (r.attributes ?? {});
    const direct = typeof a.name === "string" ? a.name : typeof a.title === "string" ? a.title : "";
    if (direct)
        return direct;
    const first = typeof a["first-name"] === "string" ? a["first-name"] : "";
    const last = typeof a["last-name"] === "string" ? a["last-name"] : "";
    return `${first} ${last}`.trim();
}
export const deduplicationTools = [
    {
        name: "itglue_find_org_match",
        description: "Fuzzy-match an organization name against existing IT Glue organizations BEFORE creating a new one. Returns candidates ranked by similarity with a confidence label: Update (>=95%, almost certainly the same record), ManualReview (80-94%), CreateNew (<80%).",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Organization name to match (required)." },
                organizationTypeId: {
                    type: "string",
                    description: "filter[organization_type_id] to scope the candidate pool.",
                },
                threshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Minimum similarity score to include. Default 0.7.",
                },
                pageSize: {
                    type: "integer",
                    minimum: 1,
                    maximum: 1000,
                    description: "Candidates to fetch from IT Glue. Default 100.",
                },
            },
            required: ["name"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const name = requireString(args, "name");
            const threshold = typeof args.threshold === "number" ? args.threshold : DEFAULT_FIND_THRESHOLD;
            const pageSize = toIntOrUndef(args.pageSize) ?? DEFAULT_FIND_POOL;
            const firstWord = normalize(name).split(" ")[0] ?? name;
            const filters = buildFilters({
                name: firstWord,
                organization_type_id: toStrOrUndef(args.organizationTypeId),
            });
            const query = mergeQuery(filters, buildPagination({ pageSize }));
            const result = await client.get("/organizations", query);
            const candidates = arrayData(result);
            const matches = candidates
                .map((r) => {
                const candidateName = attr(r, "name");
                const score = similarity(name, candidateName);
                return {
                    id: r.id ?? "",
                    name: candidateName,
                    score: roundTo(score, 4),
                    confidence: classifyConfidence(score),
                };
            })
                .filter((m) => m.score >= threshold)
                .sort((a, b) => b.score - a.score);
            return {
                input: { name, organizationTypeId: args.organizationTypeId },
                candidatesScanned: candidates.length,
                matches,
            };
        },
    },
    {
        name: "itglue_find_contact_match",
        description: "Fuzzy-match a contact (firstName + lastName) against existing IT Glue contacts. If primaryEmail is provided and matches an existing contact's primary email exactly, the score is forced to Update — email is a strong identity signal. Use before creating a new contact.",
        inputSchema: {
            type: "object",
            properties: {
                firstName: { type: "string", description: "Contact first name (required)." },
                lastName: { type: "string", description: "Contact last name." },
                organizationId: {
                    type: "string",
                    description: "filter[organization_id] to scope the candidate pool.",
                },
                primaryEmail: {
                    type: "string",
                    description: "If provided, exact-match against contact primary email forces Update confidence.",
                },
                threshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Minimum similarity score to include. Default 0.7.",
                },
                pageSize: {
                    type: "integer",
                    minimum: 1,
                    maximum: 1000,
                    description: "Candidates to fetch. Default 100.",
                },
            },
            required: ["firstName"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const firstName = requireString(args, "firstName");
            const lastName = toStrOrUndef(args.lastName) ?? "";
            const primaryEmail = toStrOrUndef(args.primaryEmail);
            const threshold = typeof args.threshold === "number" ? args.threshold : DEFAULT_FIND_THRESHOLD;
            const pageSize = toIntOrUndef(args.pageSize) ?? DEFAULT_FIND_POOL;
            const filters = buildFilters({
                first_name: firstName,
                organization_id: toStrOrUndef(args.organizationId),
            });
            const query = mergeQuery(filters, buildPagination({ pageSize }));
            const result = await client.get("/contacts", query);
            const candidates = arrayData(result);
            const inputFull = `${firstName} ${lastName}`.trim();
            const normalizedInputEmail = primaryEmail ? normalize(primaryEmail) : "";
            const matches = candidates
                .map((r) => {
                const cFirst = attr(r, "first-name");
                const cLast = attr(r, "last-name");
                const cEmail = attr(r, "primary-email") || attr(r, "primary-mail");
                const cFull = `${cFirst} ${cLast}`.trim();
                const nameScore = similarity(inputFull, cFull);
                const emailExact = normalizedInputEmail.length > 0 &&
                    cEmail.length > 0 &&
                    normalize(cEmail) === normalizedInputEmail;
                const score = emailExact ? Math.max(nameScore, 0.99) : nameScore;
                return {
                    id: r.id ?? "",
                    name: cFull,
                    email: cEmail || undefined,
                    emailExact: emailExact || undefined,
                    score: roundTo(score, 4),
                    confidence: classifyConfidence(score),
                };
            })
                .filter((m) => m.score >= threshold)
                .sort((a, b) => b.score - a.score);
            return {
                input: { firstName, lastName, organizationId: args.organizationId, primaryEmail },
                candidatesScanned: candidates.length,
                matches,
            };
        },
    },
    {
        name: "itglue_find_config_match",
        description: "Fuzzy-match a configuration name against existing IT Glue configurations. Exact match on serialNumber or assetTag forces Update confidence — those are strong identity signals. Use before creating a new configuration.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Configuration name to match (required)." },
                organizationId: {
                    type: "string",
                    description: "filter[organization_id] to scope the candidate pool.",
                },
                serialNumber: {
                    type: "string",
                    description: "If exact-match against an existing serial-number, forces Update.",
                },
                assetTag: {
                    type: "string",
                    description: "If exact-match against an existing asset-tag, forces Update.",
                },
                threshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Minimum similarity score to include. Default 0.7.",
                },
                pageSize: {
                    type: "integer",
                    minimum: 1,
                    maximum: 1000,
                    description: "Candidates to fetch. Default 100.",
                },
            },
            required: ["name"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const name = requireString(args, "name");
            const serialNumber = toStrOrUndef(args.serialNumber);
            const assetTag = toStrOrUndef(args.assetTag);
            const threshold = typeof args.threshold === "number" ? args.threshold : DEFAULT_FIND_THRESHOLD;
            const pageSize = toIntOrUndef(args.pageSize) ?? DEFAULT_FIND_POOL;
            const firstWord = normalize(name).split(" ")[0] ?? name;
            const filters = buildFilters({
                name: firstWord,
                organization_id: toStrOrUndef(args.organizationId),
            });
            const query = mergeQuery(filters, buildPagination({ pageSize }));
            const result = await client.get("/configurations", query);
            const candidates = arrayData(result);
            const normSerial = serialNumber ? normalize(serialNumber) : "";
            const normAsset = assetTag ? normalize(assetTag) : "";
            const matches = candidates
                .map((r) => {
                const candidateName = attr(r, "name");
                const cSerial = attr(r, "serial-number");
                const cAsset = attr(r, "asset-tag");
                const nameScore = similarity(name, candidateName);
                const serialExact = normSerial.length > 0 && cSerial.length > 0 && normalize(cSerial) === normSerial;
                const assetExact = normAsset.length > 0 && cAsset.length > 0 && normalize(cAsset) === normAsset;
                const strongMatch = serialExact || assetExact;
                const score = strongMatch ? Math.max(nameScore, 0.99) : nameScore;
                return {
                    id: r.id ?? "",
                    name: candidateName,
                    serialNumber: cSerial || undefined,
                    assetTag: cAsset || undefined,
                    serialExact: serialExact || undefined,
                    assetExact: assetExact || undefined,
                    score: roundTo(score, 4),
                    confidence: classifyConfidence(score),
                };
            })
                .filter((m) => m.score >= threshold)
                .sort((a, b) => b.score - a.score);
            return {
                input: { name, organizationId: args.organizationId, serialNumber, assetTag },
                candidatesScanned: candidates.length,
                matches,
            };
        },
    },
    {
        name: "itglue_scan_duplicates",
        description: "Scan an entire IT Glue resource type for groups of likely duplicate records by pairwise name similarity. Useful for cleanup audits. Capped at 5000 records per scan to bound cost; use organizationId to narrow. Returns groups of 2+ records that are above the threshold (default 0.85).",
        inputSchema: {
            type: "object",
            properties: {
                resourceType: {
                    type: "string",
                    enum: [...SCAN_RESOURCE_TYPES],
                    description: "Resource type to scan.",
                },
                organizationId: {
                    type: "string",
                    description: "filter[organization_id] to narrow the scan (recommended on large tenants).",
                },
                threshold: {
                    type: "number",
                    minimum: 0.5,
                    maximum: 1,
                    description: "Minimum pairwise similarity to group records together. Default 0.85.",
                },
                pageSize: {
                    type: "integer",
                    minimum: 1,
                    maximum: 1000,
                    description: "Page size for fetching candidates. Default 50.",
                },
                maxPages: {
                    type: "integer",
                    minimum: 1,
                    maximum: 200,
                    description: "Hard limit on pages to fetch. Default 20 (so 1000 records by default).",
                },
            },
            required: ["resourceType"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const resourceType = String(args.resourceType);
            if (!SCAN_RESOURCE_SET.has(resourceType)) {
                throw new Error(`Unsupported resourceType. Must be one of: ${SCAN_RESOURCE_TYPES.join(", ")}.`);
            }
            const typedResource = resourceType;
            const threshold = typeof args.threshold === "number" ? args.threshold : DEFAULT_SCAN_THRESHOLD;
            const pageSize = toIntOrUndef(args.pageSize) ?? DEFAULT_SCAN_PAGE_SIZE;
            const maxPages = toIntOrUndef(args.maxPages) ?? DEFAULT_SCAN_MAX_PAGES;
            const records = [];
            const filters = buildFilters({
                organization_id: toStrOrUndef(args.organizationId),
            });
            let truncated = false;
            for (let page = 1; page <= maxPages; page++) {
                const query = mergeQuery(filters, buildPagination({ pageSize, pageNumber: page }));
                const result = await client.get(`/${typedResource}`, query);
                const data = arrayData(result);
                if (data.length === 0)
                    break;
                for (const r of data) {
                    const name = resourceDisplayName(r);
                    if (name)
                        records.push({ id: r.id ?? "", name });
                    if (records.length >= HARD_SCAN_CAP) {
                        truncated = true;
                        break;
                    }
                }
                if (truncated || data.length < pageSize)
                    break;
            }
            const grouped = new Set();
            const groups = [];
            for (let i = 0; i < records.length; i++) {
                if (grouped.has(i))
                    continue;
                const group = [
                    { id: records[i].id, name: records[i].name, score: 1 },
                ];
                for (let j = i + 1; j < records.length; j++) {
                    if (grouped.has(j))
                        continue;
                    const score = similarity(records[i].name, records[j].name);
                    if (score >= threshold) {
                        group.push({ id: records[j].id, name: records[j].name, score: roundTo(score, 4) });
                        grouped.add(j);
                    }
                }
                if (group.length > 1) {
                    grouped.add(i);
                    groups.push(group);
                }
            }
            groups.sort((a, b) => b.length - a.length);
            return {
                resourceType: typedResource,
                organizationId: args.organizationId,
                threshold,
                totalScanned: records.length,
                truncated,
                duplicateGroups: groups.length,
                groups,
            };
        },
    },
];
