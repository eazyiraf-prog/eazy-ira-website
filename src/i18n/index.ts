import en from "./en.json";
import fr from "./fr.json";
import rw from "./rw.json";

export type Locale = "en" | "fr" | "rw";
export type TranslationKey = keyof typeof en;

const dictionaries = { en, fr, rw } as const;

export function t(
  key: TranslationKey | string,
  locale: Locale = "en",
  values: Record<string, string | number> = {},
): string {
  if (!(key in en)) {
    throw new Error(`Unknown i18n key: ${key}`);
  }
  const entry = dictionaries[locale][key as TranslationKey];
  const message =
    typeof entry === "string"
      ? entry
      : entry?.value ?? dictionaries.en[key as TranslationKey];

  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function getLocale(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  return segment === "fr" || segment === "rw" ? segment : "en";
}

export function localizedPath(pathname: string, locale: Locale): string {
  const pathWithoutLocale = pathname.replace(/^\/(fr|rw)(?=\/|$)/, "") || "/";
  if (locale === "en") return pathWithoutLocale;
  return `/${locale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
}
