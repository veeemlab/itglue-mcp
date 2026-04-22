import { buildFilters, buildPagination, mergeQuery, } from "../client.js";
import { paginationSchema, pickPagination, requireId, requireString, toIntOrUndef, toStrOrUndef, } from "./shared.js";
function locationResource(args, id) {
    const attributes = {};
    const assign = (src, dst, kind = "str") => {
        const v = args[src];
        if (v === undefined || v === null || v === "")
            return;
        if (kind === "int")
            attributes[dst] = toIntOrUndef(v);
        else if (kind === "bool")
            attributes[dst] = Boolean(v);
        else
            attributes[dst] = String(v);
    };
    assign("name", "name");
    assign("addressOne", "address-1");
    assign("addressTwo", "address-2");
    assign("city", "city");
    assign("region", "region");
    assign("regionId", "region-id", "int");
    assign("postalCode", "postal-code");
    assign("country", "country");
    assign("countryId", "country-id", "int");
    assign("phone", "phone");
    assign("fax", "fax");
    assign("notes", "notes");
    assign("primary", "primary", "bool");
    assign("organizationId", "organization-id", "int");
    if (Object.keys(attributes).length === 0) {
        throw new Error("No location attributes provided.");
    }
    const resource = { type: "locations", attributes };
    if (id)
        resource.id = id;
    return { data: resource };
}
export const locationTools = [
    {
        name: "itglue_list_locations",
        description: "List locations. If organizationId is provided the tool scopes to /organizations/{id}/relationships/locations; otherwise it returns all accessible locations.",
        inputSchema: {
            type: "object",
            properties: {
                organizationId: {
                    type: "string",
                    description: "When set, fetches only locations for this organization.",
                },
                name: { type: "string", description: "filter[name]" },
                city: { type: "string", description: "filter[city]" },
                country: { type: "string", description: "filter[country]" },
                ...paginationSchema(),
            },
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const filters = buildFilters({
                name: toStrOrUndef(args.name),
                city: toStrOrUndef(args.city),
                country: toStrOrUndef(args.country),
            });
            const query = mergeQuery(filters, buildPagination(pickPagination(args)));
            const orgId = toStrOrUndef(args.organizationId);
            const path = orgId
                ? `/organizations/${encodeURIComponent(orgId)}/relationships/locations`
                : "/locations";
            return client.get(path, query);
        },
    },
    {
        name: "itglue_get_location",
        description: "Fetch one location by id.",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "string", description: "Location id." },
            },
            required: ["id"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const id = requireId(args);
            return client.get(`/locations/${encodeURIComponent(id)}`);
        },
    },
    {
        name: "itglue_create_location",
        description: "Create a location under an organization. organizationId and name are required.",
        inputSchema: {
            type: "object",
            properties: {
                organizationId: { type: "string", description: "Owning organization id (required)." },
                name: { type: "string", description: "Location name (required)." },
                addressOne: { type: "string" },
                addressTwo: { type: "string" },
                city: { type: "string" },
                region: { type: "string", description: "State/region name (use regionId for strict match)." },
                regionId: { type: "string" },
                postalCode: { type: "string" },
                country: { type: "string" },
                countryId: { type: "string" },
                phone: { type: "string" },
                fax: { type: "string" },
                notes: { type: "string" },
                primary: { type: "boolean" },
            },
            required: ["organizationId", "name"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const orgId = requireString(args, "organizationId");
            requireString(args, "name");
            const body = locationResource(args);
            return client.post(`/organizations/${encodeURIComponent(orgId)}/relationships/locations`, body);
        },
    },
    {
        name: "itglue_update_location",
        description: "Update a location by id.",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "string", description: "Location id (required)." },
                name: { type: "string" },
                addressOne: { type: "string" },
                addressTwo: { type: "string" },
                city: { type: "string" },
                region: { type: "string" },
                regionId: { type: "string" },
                postalCode: { type: "string" },
                country: { type: "string" },
                countryId: { type: "string" },
                phone: { type: "string" },
                fax: { type: "string" },
                notes: { type: "string" },
                primary: { type: "boolean" },
            },
            required: ["id"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const id = requireId(args);
            const { id: _omit, ...rest } = args;
            const body = locationResource(rest, id);
            return client.patch(`/locations/${encodeURIComponent(id)}`, body);
        },
    },
    {
        name: "itglue_delete_location",
        description: "Delete a location by id.",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "string", description: "Location id." },
            },
            required: ["id"],
            additionalProperties: false,
        },
        handler: async (args, { client }) => {
            const id = requireId(args);
            return client.delete(`/locations/${encodeURIComponent(id)}`);
        },
    },
];
