export { bossGuideSchema } from "./boss-guide.js";
export { buildGuideSchema } from "./build-guide.js";
export { walkthroughSchema } from "./walkthrough.js";

import { bossGuideSchema } from "./boss-guide.js";
import { buildGuideSchema } from "./build-guide.js";
import { walkthroughSchema } from "./walkthrough.js";

export const ALL_SCHEMAS = {
  boss_guide: bossGuideSchema,
  build_guide: buildGuideSchema,
  walkthrough: walkthroughSchema,
} as const;

export type GuideType = keyof typeof ALL_SCHEMAS;
