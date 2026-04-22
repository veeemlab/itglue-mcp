import { configurationTools } from "./configurations.js";
import { contactTools } from "./contacts.js";
import { documentTools } from "./documents.js";
import { flexibleAssetTools } from "./flexibleAssets.js";
import { healthTools } from "./health.js";
import { locationTools } from "./locations.js";
import { organizationTools } from "./organizations.js";
import { passwordTools } from "./passwords.js";
export const allTools = [
    ...organizationTools,
    ...configurationTools,
    ...passwordTools,
    ...documentTools,
    ...flexibleAssetTools,
    ...contactTools,
    ...locationTools,
    ...healthTools,
];
export { errorResult, textResult } from "./shared.js";
