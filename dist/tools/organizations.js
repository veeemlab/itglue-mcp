import { buildFilters, buildPagination, mergeQuery, } from "../client.js";
import { fuzzyFallbackScan, hasAnyHits, searchWithNameFallback } from "../searchFallback.js";
import { formatOptionsSchema, paginationSchema, pickPagination, requireId, toStrOrUndef, } from "./shared.js";
export const organizationTools = [
    {
        name: "itglue_search_organizations",
        description: "Search IT Glue organizations. IT Glue's filter[name] is a case-sensitive substring match — not fuzzy. On a 0-hit response, the tool auto-retries with first-word and diacritic-stripped variants and reports which strategy worked via meta.search_strategy. For genuine fuzzy lookup with confidence scoring, use itglue_find_org_match.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "filter[name] — case-sensitive substring (IT Glue limitation; tool falls back to first-word and diacritic-stripped variants on miss)." },
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
            const inputName = toStrOrUndef(args.name);
            const otherFilters = {
                organization_type_id: toStrOrUndef(args.organizationTypeId),
                organization_status_id: toStrOrUndef(args.organizationStatusId),
                psa_integration_type: toStrOrUndef(args.psaIntegrationType),
            };
            const pagination = buildPagination(pickPagination(args));
            const result = await searchWithNameFallback(inputName, async (variant) => {
                const filters = buildFilters({ name: variant, ...otherFilters });
                return client.get("/organizations", mergeQuery(filters, pagination));
            });
            if (inputName && !hasAnyHits(result)) {
                return fuzzyFallbackScan({
                    input: inputName,
                    fetchUnfiltered: () => {
                        const filters = buildFilters(otherFilters);
                        return client.get("/organizations", mergeQuery(filters, pagination));
                    },
                    getName: (r) => {
                        const name = r.attributes?.name;
                        return typeof name === "string" ? name : "";
                    },
                });
            }
            return result;
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
