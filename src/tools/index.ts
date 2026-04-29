import { attachmentTools } from "./attachments.js";
import { bulkTools } from "./bulk.js";
import { configurationTools } from "./configurations.js";
import { contactTools } from "./contacts.js";
import { deduplicationTools } from "./deduplication.js";
import { documentTools } from "./documents.js";
import { flexibleAssetTools } from "./flexibleAssets.js";
import { groupTools } from "./groups.js";
import { healthTools } from "./health.js";
import { locationTools } from "./locations.js";
import { organizationTools } from "./organizations.js";
import { passwordTools } from "./passwords.js";
import { relatedItemTools } from "./relatedItems.js";
import { userTools } from "./users.js";
import type { ToolDefinition } from "./shared.js";

export const allTools: ToolDefinition[] = [
  ...organizationTools,
  ...configurationTools,
  ...passwordTools,
  ...documentTools,
  ...flexibleAssetTools,
  ...contactTools,
  ...locationTools,
  ...userTools,
  ...groupTools,
  ...attachmentTools,
  ...relatedItemTools,
  ...bulkTools,
  ...deduplicationTools,
  ...healthTools,
];

export { errorResult, textResult } from "./shared.js";
export type { ToolDefinition, ToolContext } from "./shared.js";
