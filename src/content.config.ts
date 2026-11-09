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

const reports = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/reports",
  }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    type: z.enum(["donation-report", "quarterly", "annual"]),
    amountReceivedRWF: z.number().nonnegative(),
    donorDisplayName: z.string().optional(),
    donorPermissionConfirmed: z.boolean().default(false),
    items: z.array(
      z.object({
        item: z.string(),
        quantity: z.string(),
        costRWF: z.number().nonnegative(),
        receiptImage: z.string().optional(),
      }),
    ),
    notes: z.string(),
  }),
});

const albums = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/albums",
  }),
  schema: z
    .object({
      title: z.string(),
      date: z.coerce.date(),
      category: z.string(),
      consentConfirmed: z.boolean(),
      published: z.boolean(),
      images: z
        .array(
          z.object({
            src: z.string(),
            alt: z.string(),
            caption: z.string(),
            depictsChildren: z.boolean(),
            consentNotes: z.string(),
          }),
        )
        .min(1),
      sample: z.boolean().default(false),
    })
    .superRefine((album, context) => {
      album.images.forEach((image, index) => {
        if (image.depictsChildren && !album.consentConfirmed) {
          context.addIssue({
            code: "custom",
            path: ["consentConfirmed"],
            message: `Album "${album.title}" includes a child photo, but consentConfirmed is false. Record guardian consent or remove the child photo.`,
          });
        }

        if (image.depictsChildren && !image.consentNotes.trim()) {
          context.addIssue({
            code: "custom",
            path: ["images", index, "consentNotes"],
            message: `Album "${album.title}" image ${index + 1} depicts children but has no consentNotes. Record who gave consent and how, or remove the child photo.`,
          });
        }

        if (album.published && !image.alt.trim()) {
          context.addIssue({
            code: "custom",
            path: ["images", index, "alt"],
            message: `Album "${album.title}" is published, but image ${index + 1} has no alt text. Add descriptive alt text before publishing.`,
          });
        }
      });
    }),
});

const news = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/news",
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    summary: z.string(),
    image: z.object({
      src: z.string(),
      alt: z.string().min(1),
    }),
    author: z.string(),
    draft: z.boolean().default(false),
    sample: z.boolean().default(false),
  }),
});

export const collections = { programs, reports, albums, news };
