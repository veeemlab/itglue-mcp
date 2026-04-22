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

function contactResource(args: Record<string, unknown>, id?: string) {
  const attributes: Record<string, unknown> = {};
  const assign = (src: string, dst: string, kind: "str" | "int" | "bool" = "str") => {
    const v = args[src];
    if (v === undefined || v === null || v === "") return;
    if (kind === "int") attributes[dst] = toIntOrUndef(v);
    else if (kind === "bool") attributes[dst] = Boolean(v);
    else attributes[dst] = String(v);
  };
  assign("firstName", "first-name");
  assign("lastName", "last-name");
  assign("title", "title");
  assign("notes", "notes");
  assign("important", "important", "bool");
  assign("organizationId", "organization-id", "int");
  assign("contactTypeId", "contact-type-id", "int");
  assign("locationId", "location-id", "int");

  if (args.contactEmails !== undefined && Array.isArray(args.contactEmails)) {
    attributes["contact-emails"] = args.contactEmails;
  }
  if (args.contactPhones !== undefined && Array.isArray(args.contactPhones)) {
    attributes["contact-phones"] = args.contactPhones;
  }

  if (Object.keys(attributes).length === 0) {
    throw new Error("No contact attributes provided.");
  }
  const resource: Record<string, unknown> = { type: "contacts", attributes };
  if (id) resource.id = id;
  return { data: resource };
}

const contactEmailSchema = {
  type: "array",
  description:
    "Array of {value, label-name, primary}. label-name typical values: 'Work', 'Home', 'Other'.",
  items: {
    type: "object",
    properties: {
      value: { type: "string" },
      "label-name": { type: "string" },
      primary: { type: "boolean" },
    },
    required: ["value"],
  },
} as const;

const contactPhoneSchema = {
  type: "array",
  description: "Array of {value, label-name, primary, extension}.",
  items: {
    type: "object",
    properties: {
      value: { type: "string" },
      "label-name": { type: "string" },
      primary: { type: "boolean" },
      extension: { type: "string" },
    },
    required: ["value"],
  },
} as const;

export const contactTools: ToolDefinition[] = [
  {
    name: "itglue_search_contacts",
    description: "Search contacts with optional filters and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        firstName: { type: "string", description: "filter[first_name]" },
        lastName: { type: "string", description: "filter[last_name]" },
        organizationId: { type: "string", description: "filter[organization_id]" },
        contactTypeId: { type: "string", description: "filter[contact_type_id]" },
        important: { type: "boolean", description: "filter[important]" },
        primaryEmail: { type: "string", description: "filter[primary_email]" },
        ...paginationSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const filters = buildFilters({
        first_name: toStrOrUndef(args.firstName),
        last_name: toStrOrUndef(args.lastName),
        organization_id: toStrOrUndef(args.organizationId),
        contact_type_id: toStrOrUndef(args.contactTypeId),
        important: args.important === undefined ? undefined : Boolean(args.important),
        primary_email: toStrOrUndef(args.primaryEmail),
      });
      const query = mergeQuery(filters, buildPagination(pickPagination(args)));
      return client.get("/contacts", query);
    },
  },
  {
    name: "itglue_get_contact",
    description: "Fetch one contact by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Contact id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.get(`/contacts/${encodeURIComponent(id)}`);
    },
  },
  {
    name: "itglue_create_contact",
    description:
      "Create a contact. organizationId and firstName are required. Emails/phones are arrays of {value, label-name, primary}.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Owning organization id (required)." },
        firstName: { type: "string", description: "First name (required)." },
        lastName: { type: "string" },
        title: { type: "string" },
        notes: { type: "string" },
        important: { type: "boolean" },
        contactTypeId: { type: "string" },
        locationId: { type: "string" },
        contactEmails: contactEmailSchema,
        contactPhones: contactPhoneSchema,
      },
      required: ["organizationId", "firstName"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const orgId = requireString(args, "organizationId");
      requireString(args, "firstName");
      const body = contactResource(args);
      return client.post(
        `/organizations/${encodeURIComponent(orgId)}/relationships/contacts`,
        body,
      );
    },
  },
  {
    name: "itglue_update_contact",
    description: "Update a contact by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Contact id (required)." },
        firstName: { type: "string" },
        lastName: { type: "string" },
        title: { type: "string" },
        notes: { type: "string" },
        important: { type: "boolean" },
        contactTypeId: { type: "string" },
        locationId: { type: "string" },
        contactEmails: contactEmailSchema,
        contactPhones: contactPhoneSchema,
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      const { id: _omit, ...rest } = args;
      const body = contactResource(rest, id);
      return client.patch(`/contacts/${encodeURIComponent(id)}`, body);
    },
  },
  {
    name: "itglue_delete_contact",
    description: "Delete a contact by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Contact id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.delete(`/contacts/${encodeURIComponent(id)}`);
    },
  },
];
