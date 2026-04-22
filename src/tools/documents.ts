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

function documentResource(args: Record<string, unknown>, id?: string) {
  const attributes: Record<string, unknown> = {};
  const assign = (src: string, dst: string, kind: "str" | "int" | "bool" = "str") => {
    const v = args[src];
    if (v === undefined || v === null || v === "") return;
    if (kind === "int") attributes[dst] = toIntOrUndef(v);
    else if (kind === "bool") attributes[dst] = Boolean(v);
    else attributes[dst] = String(v);
  };
  assign("name", "name");
  assign("content", "content");
  assign("restricted", "restricted", "bool");
  assign("public", "public", "bool");
  assign("organizationId", "organization-id", "int");
  assign("documentFolderId", "document-folder-id", "int");
  assign("parentFolderId", "document-folder-id", "int");

  if (Object.keys(attributes).length === 0) {
    throw new Error("No document attributes provided.");
  }
  const resource: Record<string, unknown> = { type: "documents", attributes };
  if (id) resource.id = id;
  return { data: resource };
}

function sectionResource(args: Record<string, unknown>, id?: string) {
  const attributes: Record<string, unknown> = {};
  if (args.name !== undefined && args.name !== "") attributes.name = String(args.name);
  if (args.content !== undefined) attributes.content = String(args.content);
  if (args.position !== undefined && args.position !== "") {
    attributes.position = toIntOrUndef(args.position);
  }
  if (Object.keys(attributes).length === 0) {
    throw new Error("No document section attributes provided.");
  }
  const resource: Record<string, unknown> = { type: "document_sections", attributes };
  if (id) resource.id = id;
  return { data: resource };
}

export const documentTools: ToolDefinition[] = [
  {
    name: "itglue_search_documents",
    description: "Search documents across organizations.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "filter[name]" },
        organizationId: { type: "string", description: "filter[organization_id]" },
        documentFolderId: { type: "string", description: "filter[document_folder_id]" },
        ...paginationSchema(),
      },
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const filters = buildFilters({
        name: toStrOrUndef(args.name),
        organization_id: toStrOrUndef(args.organizationId),
        document_folder_id: toStrOrUndef(args.documentFolderId),
      });
      const query = mergeQuery(filters, buildPagination(pickPagination(args)));
      return client.get("/documents", query);
    },
  },
  {
    name: "itglue_get_document",
    description: "Fetch one document by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.get(`/documents/${encodeURIComponent(id)}`);
    },
  },
  {
    name: "itglue_create_document",
    description: "Create a document. organizationId and name are required.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Owning organization id (required)." },
        name: { type: "string", description: "Title (required)." },
        content: { type: "string", description: "HTML body. Optional — can be added later via sections." },
        documentFolderId: { type: "string", description: "Parent folder id." },
        restricted: { type: "boolean" },
        public: { type: "boolean" },
      },
      required: ["organizationId", "name"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const orgId = requireString(args, "organizationId");
      requireString(args, "name");
      const body = documentResource(args);
      return client.post(`/organizations/${encodeURIComponent(orgId)}/relationships/documents`, body);
    },
  },
  {
    name: "itglue_list_document_sections",
    description: "List sections of a document.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document id (required)." },
        ...paginationSchema(),
      },
      required: ["documentId"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const documentId = requireString(args, "documentId");
      const query = buildPagination(pickPagination(args));
      return client.get(
        `/documents/${encodeURIComponent(documentId)}/relationships/document_sections`,
        query,
      );
    },
  },
  {
    name: "itglue_create_document_section",
    description: "Create a section within a document. name and content are required.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document id (required)." },
        name: { type: "string", description: "Section heading (required)." },
        content: { type: "string", description: "HTML body (required)." },
        position: { type: "integer", description: "Display order." },
      },
      required: ["documentId", "name", "content"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const documentId = requireString(args, "documentId");
      requireString(args, "name");
      requireString(args, "content");
      const body = sectionResource(args);
      return client.post(
        `/documents/${encodeURIComponent(documentId)}/relationships/document_sections`,
        body,
      );
    },
  },
  {
    name: "itglue_update_document_section",
    description: "Update a document section by id.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document id (required)." },
        id: { type: "string", description: "Section id (required)." },
        name: { type: "string" },
        content: { type: "string" },
        position: { type: "integer" },
      },
      required: ["documentId", "id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const documentId = requireString(args, "documentId");
      const id = requireId(args);
      const { id: _omitId, documentId: _omitDoc, ...rest } = args;
      const body = sectionResource(rest, id);
      return client.patch(
        `/documents/${encodeURIComponent(documentId)}/relationships/document_sections/${encodeURIComponent(id)}`,
        body,
      );
    },
  },
  {
    name: "itglue_delete_document_section",
    description: "Delete a document section.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document id (required)." },
        id: { type: "string", description: "Section id (required)." },
      },
      required: ["documentId", "id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const documentId = requireString(args, "documentId");
      const id = requireId(args);
      return client.delete(
        `/documents/${encodeURIComponent(documentId)}/relationships/document_sections/${encodeURIComponent(id)}`,
      );
    },
  },
  {
    name: "itglue_publish_document",
    description: "Publish a document (makes the latest draft visible).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const id = requireId(args);
      return client.post(`/documents/${encodeURIComponent(id)}/publish`, {});
    },
  },
];
