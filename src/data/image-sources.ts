const designPlaceholderSrcSet = [
  "/images/hero-placeholder-640.svg 640w",
  "/images/design-placeholder.svg 1200w",
  "/images/hero-placeholder-1920.svg 1920w",
].join(", ");

export function getResponsiveImageSrcSet(src: string): string | undefined {
  return src === "/images/design-placeholder.svg"
    ? designPlaceholderSrcSet
    : undefined;
}
