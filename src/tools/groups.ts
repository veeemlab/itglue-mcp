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

export const groupTools: ToolDefinition[] = [
  {
    name: "itglue_list_groups",
    description: "List IT Glue user groups (RBAC). Supports filter[name].",
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
      const filters = buildFilters({ name: toStrOrUndef(args.name) });
      const query = mergeQuery(filters, buildPagination(pickPagination(args)));
      return client.get("/groups", query);
    },
  },
  {
    name: "itglue_get_group",
    description: "Fetch a single IT Glue group by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Group id." },
        ...formatOptionsSchema(),
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.get(`/groups/${encodeURIComponent(id)}`);
    },
  },
];
