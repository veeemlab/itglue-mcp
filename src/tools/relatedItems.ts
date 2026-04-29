import { buildPagination } from "../client.js";
import {
  formatOptionsSchema,
  paginationSchema,
  pickPagination,
  requireId,
  requireString,
  toStrOrUndef,
  type ToolDefinition,
} from "./shared.js";

const RELATED_PARENT_TYPES = [
  "organizations",
  "configurations",
  "contacts",
  "documents",
  "flexible_assets",
  "passwords",
  "locations",
] as const;
type RelatedParentType = (typeof RELATED_PARENT_TYPES)[number];
const RELATED_PARENT_SET = new Set<string>(RELATED_PARENT_TYPES);

const DESTINATION_TYPES = [
  "organizations",
  "configurations",
  "contacts",
  "documents",
  "flexible_assets",
  "passwords",
  "locations",
] as const;
const DESTINATION_TYPE_SET = new Set<string>(DESTINATION_TYPES);

function assertParentType(value: unknown): RelatedParentType {
  if (typeof value !== "string" || !RELATED_PARENT_SET.has(value)) {
    throw new Error(
      `Unsupported parentType. Must be one of: ${RELATED_PARENT_TYPES.join(", ")}.`,
    );
  }
  return value as RelatedParentType;
}

function assertDestinationType(value: unknown): string {
  if (typeof value !== "string" || !DESTINATION_TYPE_SET.has(value)) {
    throw new Error(
      `Unsupported destinationType. Must be one of: ${DESTINATION_TYPES.join(", ")}.`,
    );
  }
  return value;
}

export const relatedItemTools: ToolDefinition[] = [
  {
    name: "itglue_list_related_items",
    description:
      "List items related to a parent resource (links between organizations, configurations, contacts, documents, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        parentType: {
          type: "string",
          enum: [...RELATED_PARENT_TYPES],
          description: "Type of the resource whose relationships you want to list.",
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
        `/${parentType}/${encodeURIComponent(parentId)}/relationships/related_items`,
        query,
      );
    },
  },
  {
    name: "itglue_create_related_item",
    description:
      "Link a destination resource to a parent. Creates a related-item edge from parent → destination.",
    inputSchema: {
      type: "object",
      properties: {
        parentType: {
          type: "string",
          enum: [...RELATED_PARENT_TYPES],
          description: "Type of the parent resource.",
        },
        parentId: { type: "string", description: "Parent resource id." },
        destinationType: {
          type: "string",
          enum: [...DESTINATION_TYPES],
          description: "Type of the resource being linked.",
        },
        destinationId: { type: "string", description: "Destination resource id." },
        notes: { type: "string", description: "Optional free-text notes on the relationship." },
      },
      required: ["parentType", "parentId", "destinationType", "destinationId"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const parentType = assertParentType(args.parentType);
      const parentId = requireString(args, "parentId");
      const destinationType = assertDestinationType(args.destinationType);
      const destinationId = requireString(args, "destinationId");
      const notes = toStrOrUndef(args.notes);
      const attributes: Record<string, unknown> = {
        "destination-id": destinationId,
        "destination-type": destinationType,
      };
      if (notes !== undefined) attributes.notes = notes;
      const body = {
        data: [
          {
            type: "related_items",
            attributes,
          },
        ],
      };
      return client.post(
        `/${parentType}/${encodeURIComponent(parentId)}/relationships/related_items`,
        body,
      );
    },
  },
  {
    name: "itglue_delete_related_item",
    description: "Remove a related-item link from a parent resource.",
    inputSchema: {
      type: "object",
      properties: {
        parentType: {
          type: "string",
          enum: [...RELATED_PARENT_TYPES],
          description: "Type of the parent resource.",
        },
        parentId: { type: "string", description: "Parent resource id." },
        id: { type: "string", description: "Related-item id to delete." },
      },
      required: ["parentType", "parentId", "id"],
      additionalProperties: false,
    },
    handler: async (args, { client }) => {
      const parentType = assertParentType(args.parentType);
      const parentId = requireString(args, "parentId");
      const id = requireId(args);
      return client.delete(
        `/${parentType}/${encodeURIComponent(parentId)}/relationships/related_items/${encodeURIComponent(id)}`,
      );
    },
  },
];
