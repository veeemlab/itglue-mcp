import { buildFilters, buildPagination, mergeQuery, } from "../client.js";
import { formatOptionsSchema, paginationSchema, pickPagination, requireId, toStrOrUndef, } from "./shared.js";
export const organizationTools = [
    {
        name: "itglue_search_organizations",
        description: "Search IT Glue organizations. Supports name/organization-type-id/organization-status-id filters and pagination.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "filter[name] — fuzzy match on organization name." },
                organizationTypeId: {
                    type: "string",
                    description: "filter[organization_type_id]",
                },
                organizationStatusId: {
                    type: "string",
                    description: "filter[organization_status_id]",
                },
                psaIntegrationType: {
                    type: "string",
                    description: "filter[psa_integration_type] (e.g. manually, connectwise-rest, autotask).",
                },
                ...paginationSchema(),
                ...formatOptionsSchema(),
            },
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const filters = buildFilters({
                name: toStrOrUndef(args.name),
                organization_type_id: toStrOrUndef(args.organizationTypeId),
                organization_status_id: toStrOrUndef(args.organizationStatusId),
                psa_integration_type: toStrOrUndef(args.psaIntegrationType),
            });
            const query = mergeQuery(filters, buildPagination(pickPagination(args)));
            return client.get("/organizations", query);
        },
    },
    {
        name: "itglue_get_organization",
        description: "Fetch a single organization by id.",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "string", description: "Organization id." },
                ...formatOptionsSchema(),
            },
            required: ["id"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const id = requireId(args);
            return client.get(`/organizations/${encodeURIComponent(id)}`);
        },
    },
];
