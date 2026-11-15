import process from "node:process";

function normalizedOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return value.replace(/\/+$/, "").toLowerCase();
  }
}

export function isProductionLaunchGateActive() {
  const siteOrigin = normalizedOrigin(process.env.PUBLIC_SITE_URL);
  return (
    siteOrigin !== null &&
    siteOrigin === normalizedOrigin(process.env.PRODUCTION_SITE_URL)
  );
}
