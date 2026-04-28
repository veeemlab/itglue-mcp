const BULK_RESOURCE_TYPES = [
    "organizations",
    "configurations",
    "contacts",
    "locations",
    "documents",
    "flexible_assets",
    "passwords",
];
const BULK_RESOURCE_SET = new Set(BULK_RESOURCE_TYPES);
const MAX_ITEMS = 50;
function assertResourceType(value) {
    if (typeof value !== "string" || !BULK_RESOURCE_SET.has(value)) {
        throw new Error(`Unsupported resourceType. Must be one of: ${BULK_RESOURCE_TYPES.join(", ")}.`);
    }
    return value;
}
function summarize(resourceType, results) {
    const succeeded = [];
    const failed = [];
    for (const r of results) {
        if (r.ok)
            succeeded.push({ id: r.id, data: r.data });
        else
            failed.push({
                id: r.id,
                status: r.status,
                error: r.error,
                details: r.details,
            });
    }
    return {
        resourceType,
        totalRequested: results.length,
        succeededCount: succeeded.length,
        failedCount: failed.length,
        succeeded,
        failed,
    };
}
function captureError(id, err) {
    const e = err;
    return {
        ok: false,
        id,
        status: typeof e?.status === "number" ? e.status : undefined,
        error: typeof e?.message === "string" && e.message.length > 0
            ? e.message
            : String(err),
        details: e?.body,
    };
}
export const bulkTools = [
    {
        name: "itglue_bulk_update",
        description: "Update multiple resources of the same type in one call. JSON:API merge semantics — omitted attributes are left untouched. Up to 50 items per call. Returns separate succeeded[] and failed[] arrays so partial failures don't abort the batch.",
        inputSchema: {
            type: "object",
            properties: {
                resourceType: {
                    type: "string",
                    enum: [...BULK_RESOURCE_TYPES],
                    description: "IT Glue resource type. Each id targets `/{resourceType}/{id}`.",
                },
                items: {
                    type: "array",
                    minItems: 1,
                    maxItems: MAX_ITEMS,
                    description: "Up to 50 update operations. Each item: { id, attributes }. Attribute keys use IT Glue's kebab-case (e.g. organization-id, asset-tag).",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            attributes: { type: "object", additionalProperties: true },
                        },
                        required: ["id", "attributes"],
                    },
                },
            },
            required: ["resourceType", "items"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const resourceType = assertResourceType(args.resourceType);
            const items = args.items;
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error("`items` must be a non-empty array.");
            }
            if (items.length > MAX_ITEMS) {
                throw new Error(`Too many items: max ${MAX_ITEMS} per bulk call.`);
            }
            const results = await Promise.all(items.map(async (raw) => {
                const item = raw;
                const id = item.id !== undefined ? String(item.id) : "";
                if (!id) {
                    return captureError("<missing>", new Error("item.id is required"));
                }
                if (!item.attributes ||
                    typeof item.attributes !== "object" ||
                    Array.isArray(item.attributes)) {
                    return captureError(id, new Error("item.attributes must be a JSON object"));
                }
                try {
                    const body = {
                        data: {
                            type: resourceType,
                            id,
                            attributes: item.attributes,
                        },
                    };
                    const data = await client.patch(`/${resourceType}/${encodeURIComponent(id)}`, body);
                    return { ok: true, id, data };
                }
                catch (err) {
                    return captureError(id, err);
                }
            }));
            return summarize(resourceType, results);
        },
    },
    {
        name: "itglue_bulk_delete",
        description: "Delete multiple resources of the same type in one call. Up to 50 ids per call. Returns separate succeeded[] and failed[] arrays so partial failures don't abort the batch.",
        inputSchema: {
            type: "object",
            properties: {
                resourceType: {
                    type: "string",
                    enum: [...BULK_RESOURCE_TYPES],
                    description: "IT Glue resource type. Each id targets `/{resourceType}/{id}`.",
                },
                ids: {
                    type: "array",
                    minItems: 1,
                    maxItems: MAX_ITEMS,
                    items: { type: "string" },
                    description: "Up to 50 ids to delete.",
                },
            },
            required: ["resourceType", "ids"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const resourceType = assertResourceType(args.resourceType);
            const idsRaw = args.ids;
            if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
                throw new Error("`ids` must be a non-empty array.");
            }
            if (idsRaw.length > MAX_ITEMS) {
                throw new Error(`Too many ids: max ${MAX_ITEMS} per bulk call.`);
            }
            const ids = idsRaw.map((v) => String(v)).filter((s) => s.length > 0);
            const results = await Promise.all(ids.map(async (id) => {
                try {
                    const data = await client.delete(`/${resourceType}/${encodeURIComponent(id)}`);
                    return { ok: true, id, data };
                }
                catch (err) {
                    return captureError(id, err);
                }
            }));
            return summarize(resourceType, results);
        },
    },
];
