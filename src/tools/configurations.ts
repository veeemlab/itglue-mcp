import {
  buildFilters,
  buildPagination,
  mergeQuery,
} from "../client.js";
import { searchWithNameFallback } from "../searchFallback.js";
import {
  formatOptionsSchema,
  paginationSchema,
  pickPagination,
  requireId,
  requireString,
  toIntOrUndef,
  toStrOrUndef,
  type ToolDefinition,
} from "./shared.js";

function configurationResource(args: Record<string, unknown>, id?: string) {
  const attributes: Record<string, unknown> = {};
  const assign = (src: string, dst: string, kind: "str" | "int" | "raw" = "str") => {
    const v = args[src];
    if (v === undefined || v === null || v === "") return;
    if (kind === "int") attributes[dst] = toIntOrUndef(v);
    else if (kind === "raw") attributes[dst] = v;
    else attributes[dst] = String(v);
  };
  assign("name", "name");
  assign("hostname", "hostname");
  assign("primaryIp", "primary-ip");
  assign("macAddress", "mac-address");
  assign("serialNumber", "serial-number");
  assign("assetTag", "asset-tag");
  assign("position", "position");
  assign("installedBy", "installed-by");
  assign("purchasedBy", "purchased-by");
  assign("notes", "notes");
  assign("installedAt", "installed-at");
  assign("purchasedAt", "purchased-at");
  assign("warrantyExpiresAt", "warranty-expires-at");
  assign("organizationId", "organization-id", "int");
  assign("configurationTypeId", "configuration-type-id", "int");
  assign("configurationStatusId", "configuration-status-id", "int");
  assign("manufacturerId", "manufacturer-id", "int");
  assign("modelId", "model-id", "int");
  assign("operatingSystemId", "operating-system-id", "int");
  assign("operatingSystemNotes", "operating-system-notes");
  assign("locationId", "location-id", "int");
  assign("contactId", "contact-id", "int");
  if (args.archived !== undefined) attributes.archived = Boolean(args.archived);

  if (Object.keys(attributes).length === 0) {
    throw new Error("No configuration attributes provided.");
  }
  const resource: Record<string, unknown> = {
    type: "configurations",
    attributes,
  };
  if (id) resource.id = id;
  return { data: resource };
}

export const configurationTools: ToolDefinition[] = [
  {
    name: "itglue_search_configurations",
    description:
      "Search IT Glue configurations. IT Glue's filter[name] is a case-sensitive substring match — not fuzzy. On a 0-hit response, the tool auto-retries with first-word and diacritic-stripped variants and reports which strategy worked via meta.search_strategy. For fuzzy lookup with confidence scoring (and serial/asset-tag exact-match boosting), use itglue_find_config_match.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name] — case-sensitive substring (IT Glue limitation; tool falls back to first-word and diacritic-stripped variants on miss)." },
        organizationId: { type: "string", description: "filter[organization_id]" },
        configurationTypeId: { type: "string", description: "filter[configuration_type_id]" },
        configurationStatusId: { type: "string", description: "filter[configuration_status_id]" },
        serialNumber: { type: "string", description: "filter[serial_number]" },
        assetTag: { type: "string", description: "filter[asset_tag]" },
        rmmId: { type: "string", description: "filter[rmm_id]" },
        archived: { type: "boolean", description: "filter[archived]" },
        ...paginationSchema(),
        ...formatOptionsSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const inputName = toStrOrUndef(args.name);
      return searchWithNameFallback(inputName, async (variant) => {
        const filters = buildFilters({
          name: variant,
          organization_id: toStrOrUndef(args.organizationId),
          configuration_type_id: toStrOrUndef(args.configurationTypeId),
          configuration_status_id: toStrOrUndef(args.configurationStatusId),
          serial_number: toStrOrUndef(args.serialNumber),
          asset_tag: toStrOrUndef(args.assetTag),
          rmm_id: toStrOrUndef(args.rmmId),
          archived: args.archived === undefined ? undefined : Boolean(args.archived),
        });
        const query = mergeQuery(filters, buildPagination(pickPagination(args)));
        return client.get("/configurations", query);
      });
    },
  },
  {
    name: "itglue_get_configuration",
    description: "Fetch a single configuration by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Configuration id." },
        ...formatOptionsSchema(),
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.get(`/configurations/${encodeURIComponent(id)}`);
    },
  },
  {
    name: "itglue_create_configuration",
    description:
      "Create a configuration. organizationId, name and configurationTypeId are required. Dates must be ISO8601.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Owning organization id (required)." },
        name: { type: "string", description: "Display name (required)." },
        configurationTypeId: { type: "string", description: "Configuration type id (required)." },
        configurationStatusId: { type: "string" },
        hostname: { type: "string" },
        primaryIp: { type: "string" },
        macAddress: { type: "string" },
        serialNumber: { type: "string" },
        assetTag: { type: "string" },
        position: { type: "string" },
        notes: { type: "string" },
        installedBy: { type: "string" },
        purchasedBy: { type: "string" },
        installedAt: { type: "string", description: "ISO8601 date." },
        purchasedAt: { type: "string", description: "ISO8601 date." },
        warrantyExpiresAt: { type: "string", description: "ISO8601 date." },
        manufacturerId: { type: "string" },
        modelId: { type: "string" },
        operatingSystemId: { type: "string" },
        operatingSystemNotes: { type: "string" },
        locationId: { type: "string" },
        contactId: { type: "string" },
      },
      required: ["organizationId", "name", "configurationTypeId"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      requireString(args, "organizationId");
      requireString(args, "name");
      requireString(args, "configurationTypeId");
      const body = configurationResource(args);
      return client.post("/configurations", body);
    },
  },
  {
    name: "itglue_update_configuration",
    description:
      "Update a configuration. Provide the id plus any attributes to change. Attributes not provided are left untouched.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Configuration id (required)." },
        name: { type: "string" },
        hostname: { type: "string" },
        primaryIp: { type: "string" },
        macAddress: { type: "string" },
        serialNumber: { type: "string" },
        assetTag: { type: "string" },
        position: { type: "string" },
        notes: { type: "string" },
        installedBy: { type: "string" },
        purchasedBy: { type: "string" },
        installedAt: { type: "string" },
        purchasedAt: { type: "string" },
        warrantyExpiresAt: { type: "string" },
        configurationTypeId: { type: "string" },
        configurationStatusId: { type: "string" },
        manufacturerId: { type: "string" },
        modelId: { type: "string" },
        operatingSystemId: { type: "string" },
        operatingSystemNotes: { type: "string" },
        locationId: { type: "string" },
        contactId: { type: "string" },
        archived: { type: "boolean" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      const { id: _omit, ...rest } = args;
      const body = configurationResource(rest, id);
      return client.patch(`/configurations/${encodeURIComponent(id)}`, body);
    },
  },
  {
    name: "itglue_delete_configuration",
    description: "Delete a configuration by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Configuration id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.delete(`/configurations/${encodeURIComponent(id)}`);
    },
  },
  {
    name: "itglue_list_configuration_types",
    description: "List all configuration types (e.g. Laptop, Server).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name]" },
        ...paginationSchema(),
        ...formatOptionsSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const query = mergeQuery(
        buildFilters({ name: toStrOrUndef(args.name) }),
        buildPagination(pickPagination(args)),
      );
      return client.get("/configuration_types", query);
    },
  },
  {
    name: "itglue_list_configuration_statuses",
    description: "List all configuration statuses (e.g. Active, Inactive).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name]" },
        ...paginationSchema(),
        ...formatOptionsSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const query = mergeQuery(
        buildFilters({ name: toStrOrUndef(args.name) }),
        buildPagination(pickPagination(args)),
      );
      return client.get("/configuration_statuses", query);
    },
  },
];
