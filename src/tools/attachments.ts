import { buildPagination } from "../client.js";
import {
  formatOptionsSchema,
  paginationSchema,
  pickPagination,
  requireId,
  requireString,
  type ToolDefinition,
} from "./shared.js";

const ATTACHMENT_PARENT_TYPES = [
  "organizations",
  "configurations",
  "contacts",
  "documents",
  "flexible_assets",
  "passwords",
] as const;
type AttachmentParentType = (typeof ATTACHMENT_PARENT_TYPES)[number];
const ATTACHMENT_PARENT_SET = new Set<string>(ATTACHMENT_PARENT_TYPES);

function assertParentType(value: unknown): AttachmentParentType {
  if (typeof value !== "string" || !ATTACHMENT_PARENT_SET.has(value)) {
    throw new Error(
      `Unsupported parentType. Must be one of: ${ATTACHMENT_PARENT_TYPES.join(", ")}.`,
    );
  }
  return value as AttachmentParentType;
}

export const attachmentTools: ToolDefinition[] = [
  {
    name: "itglue_list_attachments",
    description:
      "List attachments on a parent resource. Returns metadata only — file names, sizes, content types, and download URLs (use the URL out-of-band to fetch the actual file).",
    inputSchema: {
      type: "object",
      properties: {
        parentType: {
          type: "string",
          enum: [...ATTACHMENT_PARENT_TYPES],
          description: "Parent resource type that owns the attachments.",
        },
        parentId: { type: "string", description: "Parent resource id." },
        ...paginationSchema(),
        ...formatOptionsSchema(),
      },
      required: ["parentType", "parentId"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const parentType = assertParentType(args.parentType);
      const parentId = requireString(args, "parentId");
      const query = buildPagination(pickPagination(args));
      return client.get(
        `/${parentType}/${encodeURIComponent(parentId)}/relationships/attachments`,
        query,
      );
    },
  },
  {
    name: "itglue_delete_attachment",
    description:
      "Delete an attachment from a parent resource. Both parentType+parentId AND the attachment id are required.",
    inputSchema: {
      type: "object",
      properties: {
        parentType: {
          type: "string",
          enum: [...ATTACHMENT_PARENT_TYPES],
          description: "Parent resource type that owns the attachment.",
        },
        parentId: { type: "string", description: "Parent resource id." },
        id: { type: "string", description: "Attachment id to delete." },
      },
      required: ["parentType", "parentId", "id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const parentType = assertParentType(args.parentType);
      const parentId = requireString(args, "parentId");
      const id = requireId(args);
      return client.delete(
        `/${parentType}/${encodeURIComponent(parentId)}/relationships/attachments/${encodeURIComponent(id)}`,
      );
    },
  },
];
