import { readFile } from "node:fs/promises";
import process from "node:process";
import { z } from "astro/zod";

const file = new URL("../src/data/hero-slides.json", import.meta.url);
let source;
try {
  source = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`Hero slides validation failed: ${error.message}`);
  process.exit(1);
}

const slideSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.enum(["image", "video"]),
    src: z.string().trim().min(1),
    alt: z.string().trim().min(1),
    consentConfirmed: z.boolean(),
    depictsChildren: z.boolean(),
    consentNotes: z.string(),
  })
  .superRefine((slide, context) => {
    if (slide.depictsChildren && !slide.consentConfirmed) {
      context.addIssue({
        code: "custom",
        path: ["consentConfirmed"],
        message: `slide "${slide.id}" depicts children but consentConfirmed is false; confirm guardian consent or set depictsChildren to false.`,
      });
    }

    if (slide.depictsChildren && !slide.consentNotes.trim()) {
      context.addIssue({
        code: "custom",
        path: ["consentNotes"],
        message: `slide "${slide.id}" depicts children but consentNotes is empty; record who gave consent and how.`,
      });
    }
  });

const schema = z.object({ slides: z.array(slideSchema).min(1) });
const result = schema.safeParse(source);

if (!result.success) {
  for (const issue of result.error.issues) {
    const slideIndex = issue.path[0] === "slides" ? issue.path[1] : undefined;
    const slide = Number.isInteger(slideIndex)
      ? source.slides?.[slideIndex]
      : undefined;
    const slideLabel = slide?.id ? `"${slide.id}"` : `at index ${Number(slideIndex) + 1}`;
    const field = issue.path.slice(2).join(".") || "slides";
    console.error(`Hero slide ${slideLabel}: ${field}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`Hero slide validation passed (${result.data.slides.length} slides).`);
