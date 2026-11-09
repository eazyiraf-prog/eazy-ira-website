import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const programs = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/programs",
  }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    summary: z.string(),
    heroText: z.string(),
    need: z.string(),
    whatWeDo: z.array(z.string()),
    howItWorks: z.array(z.string()),
    results: z.array(
      z.enum([
        "childrenServed",
        "weeklyGatherings",
        "gatheringStart",
        "schoolMaterials",
        "schoolYears",
        "firstSchool",
        "familyOutreach",
        "academySessions",
      ]),
    ),
    howToHelp: z.array(z.string()),
    relatedSlugs: z.array(z.string()),
    enrolmentInfo: z.string().optional(),
    courseOutline: z.string().optional(),
  }),
});

export const collections = { programs };
