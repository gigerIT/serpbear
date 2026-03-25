import Cryptr from "cryptr";
import safeJsonParse from "./safeJsonParse";

/// <reference path="../types.d.ts" />

export type PersistedDomainScraperSettings = {
  scraper_type?: string | null;
  scraping_api?: string | null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const parseDomainScraperSettings = (
  raw: unknown
): PersistedDomainScraperSettings | null => {
  if (!raw) {
    return null;
  }

  const payload =
    typeof raw === "string"
      ? safeJsonParse<Record<string, unknown> | null>(raw, null)
      : raw;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const payloadRecord = payload as Record<string, unknown>;

  const scraperType = isNonEmptyString(payloadRecord.scraper_type)
    ? payloadRecord.scraper_type.trim()
    : null;
  const scrapingApi = isNonEmptyString(payloadRecord.scraping_api)
    ? payloadRecord.scraping_api
    : null;

  if (!scraperType && !scrapingApi) {
    return null;
  }

  return {
    scraper_type: scraperType,
    scraping_api: scrapingApi,
  };
};

export const maskDomainScraperSettings = (
  raw: PersistedDomainScraperSettings | null
): DomainScraperSettings | null => {
  if (!raw || !isNonEmptyString(raw.scraper_type)) {
    return null;
  }

  return {
    scraper_type: raw.scraper_type,
    has_api_key: isNonEmptyString(raw.scraping_api),
  };
};

export const buildPersistedScraperSettings = (
  incoming: DomainScraperSettings | null | undefined,
  existing: PersistedDomainScraperSettings | null,
  cryptr: Cryptr
): PersistedDomainScraperSettings | null => {
  if (!incoming) {
    return existing ?? null;
  }

  const nextType = isNonEmptyString(incoming.scraper_type)
    ? incoming.scraper_type.trim()
    : null;

  if (!nextType) {
    return null;
  }

  const next: PersistedDomainScraperSettings = {
    scraper_type: nextType,
  };

  if (isNonEmptyString(incoming.scraping_api)) {
    next.scraping_api = cryptr.encrypt(incoming.scraping_api.trim());
  } else if (incoming.clear_api_key) {
    next.scraping_api = null;
  } else if (
    existing &&
    existing.scraper_type === nextType &&
    isNonEmptyString(existing.scraping_api)
  ) {
    next.scraping_api = existing.scraping_api;
  } else {
    next.scraping_api = null;
  }

  return next;
};

export const decryptDomainScraperSettings = (
  raw: PersistedDomainScraperSettings | null,
  cryptr: Cryptr
): PersistedDomainScraperSettings | null => {
  if (!raw || !isNonEmptyString(raw.scraper_type)) {
    return null;
  }

  return {
    scraper_type: raw.scraper_type,
    scraping_api: isNonEmptyString(raw.scraping_api)
      ? cryptr.decrypt(raw.scraping_api)
      : null,
  };
};
