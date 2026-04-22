import {
  buildFilters,
  buildPagination,
  mergeQuery,
} from "../client.js";
import {
  paginationSchema,
  pickPagination,
  requireId,
  requireString,
  toIntOrUndef,
  toStrOrUndef,
  type ToolDefinition,
} from "./shared.js";

function flexibleAssetResource(args: Record<string, unknown>, id?: string) {
  const attributes: Record<string, unknown> = {};
  if (args.organizationId !== undefined && args.organizationId !== "") {
    attributes["organization-id"] = toIntOrUndef(args.organizationId);
  }
  if (args.flexibleAssetTypeId !== undefined && args.flexibleAssetTypeId !== "") {
    attributes["flexible-asset-type-id"] = toIntOrUndef(args.flexibleAssetTypeId);
  }
  if (args.traits !== undefined && args.traits !== null) {
    if (typeof args.traits !== "object" || Array.isArray(args.traits)) {
      throw new Error("`traits` must be a JSON object mapping field keys to values.");
    }
    attributes.traits = args.traits;
  }
  if (Object.keys(attributes).length === 0) {
    throw new Error("No flexible asset attributes provided.");
  }
  const resource: Record<string, unknown> = { type: "flexible_assets", attributes };
  if (id) resource.id = id;
  return { data: resource };
}

export const flexibleAssetTools: ToolDefinition[] = [
  {
    name: "itglue_list_flexible_asset_types",
    description: "List all flexible asset types.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name]" },
        enabled: { type: "boolean", description: "filter[enabled]" },
        ...paginationSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const filters = buildFilters({
        name: toStrOrUndef(args.name),
        enabled: args.enabled === undefined ? undefined : Boolean(args.enabled),
      });
      const query = mergeQuery(filters, buildPagination(pickPagination(args)));
      return client.get("/flexible_asset_types", query);
    },
  },
  {
    name: "itglue_list_flexible_asset_fields",
    description:
      "List fields for a flexible asset type. Call this before create/update to learn the required trait keys.",
    inputSchema: {
      type: "object",
      properties: {
        flexibleAssetTypeId: { type: "string", description: "Flexible asset type id (required)." },
        ...paginationSchema(),
      },
      required: ["flexibleAssetTypeId"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const typeId = requireString(args, "flexibleAssetTypeId");
      const query = buildPagination(pickPagination(args));
      return client.get(
        `/flexible_asset_types/${encodeURIComponent(typeId)}/relationships/flexible_asset_fields`,
        query,
      );
    },
  },
  {
    name: "itglue_search_flexible_assets",
    description:
      "Search flexible assets. You must supply filterFlexibleAssetTypeId — IT Glue requires it.",
    inputSchema: {
      type: "object",
      properties: {
        flexibleAssetTypeId: {
          type: "string",
          description: "filter[flexible_asset_type_id] (required by IT Glue).",
        },
        name: { type: "string", description: "filter[name]" },
        organizationId: { type: "string", description: "filter[organization_id]" },
        ...paginationSchema(),
      },
      required: ["flexibleAssetTypeId"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      requireString(args, "flexibleAssetTypeId");
      const filters = buildFilters({
        flexible_asset_type_id: toStrOrUndef(args.flexibleAssetTypeId),
        name: toStrOrUndef(args.name),
        organization_id: toStrOrUndef(args.organizationId),
      });
      const query = mergeQuery(filters, buildPagination(pickPagination(args)));
      return client.get("/flexible_assets", query);
    },
  },
  {
    name: "itglue_get_flexible_asset",
    description: "Fetch a single flexible asset by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Flexible asset id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.get(`/flexible_assets/${encodeURIComponent(id)}`);
    },
  },
  {
    name: "itglue_create_flexible_asset",
    description:
      "Create a flexible asset. Call itglue_list_flexible_asset_fields first to learn the `traits` keys required by the chosen flexible asset type.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Owning organization id (required)." },
        flexibleAssetTypeId: { type: "string", description: "Flexible asset type id (required)." },
        traits: {
          type: "object",
          description:
            "Dynamic field values, keyed by the flexible asset type's field keys. Shape varies per type — fetch fields first.",
          additionalProperties: true,
        },
      },
      required: ["organizationId", "flexibleAssetTypeId", "traits"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      requireString(args, "organizationId");
      requireString(args, "flexibleAssetTypeId");
      if (typeof args.traits !== "object" || args.traits === null || Array.isArray(args.traits)) {
        throw new Error("`traits` must be a JSON object.");
      }
      const body = flexibleAssetResource(args);
      return client.post("/flexible_assets", body);
    },
  },
  {
    name: "itglue_update_flexible_asset",
    description:
      "Update a flexible asset. Provide the id plus the traits you want to change; other trait keys remain untouched.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Flexible asset id (required)." },
        traits: {
          type: "object",
          description: "Trait updates. Only the provided keys are changed.",
          additionalProperties: true,
        },
      },
      required: ["id", "traits"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      if (typeof args.traits !== "object" || args.traits === null || Array.isArray(args.traits)) {
        throw new Error("`traits` must be a JSON object.");
      }
      const body = flexibleAssetResource({ traits: args.traits }, id);
      return client.patch(`/flexible_assets/${encodeURIComponent(id)}`, body);
    },
  },
  {
    name: "itglue_delete_flexible_asset",
    description: "Delete a flexible asset by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Flexible asset id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.delete(`/flexible_assets/${encodeURIComponent(id)}`);
    },
  },
];
