import {
  buildFilters,
  buildPagination,
  mergeQuery,
} from "../client.js";
import {
  formatOptionsSchema,
  paginationSchema,
  pickPagination,
  requireId,
  toStrOrUndef,
  type ToolDefinition,
} from "./shared.js";

export const userTools: ToolDefinition[] = [
  {
    name: "itglue_list_users",
    description:
      "List IT Glue users (people with login access — distinct from contacts). May require admin permissions on the API key. Supports filter[name], filter[email], filter[role_name].",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name]" },
        email: { type: "string", description: "filter[email]" },
        roleName: { type: "string", description: "filter[role_name]" },
        ...paginationSchema(),
        ...formatOptionsSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const filters = buildFilters({
        name: toStrOrUndef(args.name),
        email: toStrOrUndef(args.email),
        role_name: toStrOrUndef(args.roleName),
      });
      const query = mergeQuery(filters, buildPagination(pickPagination(args)));
      return client.get("/users", query);
    },
  },
  {
    name: "itglue_get_user",
    description: "Fetch a single IT Glue user by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "User id." },
        ...formatOptionsSchema(),
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.get(`/users/${encodeURIComponent(id)}`);
    },
  },
];
