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

function passwordResource(args: Record<string, unknown>, id?: string) {
  const attributes: Record<string, unknown> = {};
  const assign = (src: string, dst: string, kind: "str" | "int" | "bool" = "str") => {
    const v = args[src];
    if (v === undefined || v === null || v === "") return;
    if (kind === "int") attributes[dst] = toIntOrUndef(v);
    else if (kind === "bool") attributes[dst] = Boolean(v);
    else attributes[dst] = String(v);
  };
  assign("name", "name");
  assign("username", "username");
  assign("password", "password");
  assign("url", "url");
  assign("notes", "notes");
  assign("passwordCategoryId", "password-category-id", "int");
  assign("organizationId", "organization-id", "int");
  assign("resourceType", "resource-type");
  assign("resourceId", "resource-id", "int");
  assign("passwordType", "password-type");
  assign("passwordFolderId", "password-folder-id", "int");
  assign("otpEnabled", "otp-enabled", "bool");
  assign("otpSecret", "otp-secret");

  if (Object.keys(attributes).length === 0) {
    throw new Error("No password attributes provided.");
  }
  const resource: Record<string, unknown> = { type: "passwords", attributes };
  if (id) resource.id = id;
  return { data: resource };
}

export const passwordTools: ToolDefinition[] = [
  {
    name: "itglue_search_passwords",
    description:
      "Search passwords. By default IT Glue returns metadata only; pass showPassword=true to include the password value in the response.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name]" },
        organizationId: { type: "string", description: "filter[organization_id]" },
        passwordCategoryId: { type: "string", description: "filter[password_category_id]" },
        url: { type: "string", description: "filter[url]" },
        cachedResourceName: { type: "string", description: "filter[cached_resource_name]" },
        showPassword: {
          type: "boolean",
          description: "If true, include the plaintext password field (show_password=true).",
        },
        ...paginationSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const filters = buildFilters({
        name: toStrOrUndef(args.name),
        organization_id: toStrOrUndef(args.organizationId),
        password_category_id: toStrOrUndef(args.passwordCategoryId),
        url: toStrOrUndef(args.url),
        cached_resource_name: toStrOrUndef(args.cachedResourceName),
      });
      const query = mergeQuery(filters, buildPagination(pickPagination(args)));
      if (args.showPassword === true) query.show_password = "true";
      return client.get("/passwords", query);
    },
  },
  {
    name: "itglue_get_password",
    description:
      "Fetch one password. Pass showPassword=true to include the plaintext password value.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Password id." },
        showPassword: { type: "boolean", description: "Include plaintext (show_password=true)." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      const query: Record<string, unknown> = {};
      if (args.showPassword === true) query.show_password = "true";
      return client.get(`/passwords/${encodeURIComponent(id)}`, query);
    },
  },
  {
    name: "itglue_create_password",
    description:
      "Create a password entry. organizationId, name and password are required; username/url/notes are common optional fields.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Owning organization id (required)." },
        name: { type: "string", description: "Display name (required)." },
        password: { type: "string", description: "Password value (required)." },
        username: { type: "string" },
        url: { type: "string" },
        notes: { type: "string" },
        passwordCategoryId: { type: "string" },
        passwordFolderId: { type: "string" },
        resourceType: {
          type: "string",
          description: "Associated resource type (e.g. 'Configuration').",
        },
        resourceId: { type: "string", description: "Associated resource id." },
        passwordType: {
          type: "string",
          description: "'embedded' for a password attached to a resource; omit for general.",
        },
        otpEnabled: { type: "boolean" },
        otpSecret: { type: "string" },
      },
      required: ["organizationId", "name", "password"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      requireString(args, "organizationId");
      requireString(args, "name");
      requireString(args, "password");
      const body = passwordResource(args);
      return client.post("/passwords", body);
    },
  },
  {
    name: "itglue_update_password",
    description: "Update a password entry by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Password id (required)." },
        name: { type: "string" },
        username: { type: "string" },
        password: { type: "string" },
        url: { type: "string" },
        notes: { type: "string" },
        passwordCategoryId: { type: "string" },
        passwordFolderId: { type: "string" },
        resourceType: { type: "string" },
        resourceId: { type: "string" },
        passwordType: { type: "string" },
        otpEnabled: { type: "boolean" },
        otpSecret: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      const { id: _omit, ...rest } = args;
      const body = passwordResource(rest, id);
      return client.patch(`/passwords/${encodeURIComponent(id)}`, body);
    },
  },
  {
    name: "itglue_delete_password",
    description: "Delete a password entry by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Password id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.delete(`/passwords/${encodeURIComponent(id)}`);
    },
  },
  {
    name: "itglue_list_password_categories",
    description: "List all password categories.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name]" },
        ...paginationSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const query = mergeQuery(
        buildFilters({ name: toStrOrUndef(args.name) }),
        buildPagination(pickPagination(args)),
      );
      return client.get("/password_categories", query);
    },
  },
];
