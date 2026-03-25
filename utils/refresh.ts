import { performance } from "perf_hooks";
import { setTimeout as sleep } from "timers/promises";
import Cryptr from "cryptr";
import {
  RefreshResult,
  removeFromRetryQueue,
  retryScrape,
  scrapeKeywordWithStrategy,
} from "./scraper";
import parseKeywords from "./parseKeywords";
import Keyword from "../database/models/keyword";
import { logger } from "./logger";
import {
  decryptDomainScraperSettings,
  parseDomainScraperSettings,
} from "./domainScraperSettings";

const buildLastUpdateError = (error: string, scraperType: string): string =>
  JSON.stringify({
    date: new Date().toJSON(),
    error,
    scraper: scraperType,
  });

const clearKeywordUpdatingState = async (
  keyword: Keyword,
  settings: SettingsType,
  error?: string
): Promise<KeywordType> => {
  const currentKeyword = keyword.get({ plain: true }) as KeywordType;
  const lastUpdateError = error
    ? buildLastUpdateError(error, settings.scraper_type)
    : "false";

  try {
    await keyword.update({
      updating: false,
      lastUpdateError,
    });
  } catch (updateError) {
    logger.error(
      "Clearing keyword updating state failed",
      updateError instanceof Error
        ? updateError
        : new Error(String(updateError)),
      { keyword: currentKeyword.keyword }
    );
  }

  try {
    if (error && settings?.scrape_retry) {
      await retryScrape(currentKeyword.ID);
    } else {
      await removeFromRetryQueue(currentKeyword.ID);
    }
  } catch (queueError) {
    logger.error(
      "Updating retry queue failed",
      queueError instanceof Error ? queueError : new Error(String(queueError)),
      { keyword: currentKeyword.keyword }
    );
  }

  return parseKeywords([
    {
      ...currentKeyword,
      updating: false,
      lastUpdateError,
    } as unknown as Keyword,
  ])[0];
};

const resolveEffectiveSettings = (
  settings: SettingsType,
  domainSettings?: DomainType
): SettingsType => {
  if (!domainSettings?.scraper_settings || !process.env.SECRET) {
    return settings;
  }

  try {
    const cryptr = new Cryptr(process.env.SECRET);
    const parsed = parseDomainScraperSettings(domainSettings.scraper_settings);
    const decrypted = decryptDomainScraperSettings(parsed, cryptr);

    if (!decrypted?.scraper_type) {
      return settings;
    }

    return {
      ...settings,
      scraper_type: decrypted.scraper_type,
      ...(typeof decrypted.scraping_api === "string"
        ? {
            scraping_api: decrypted.scraping_api,
            scaping_api: decrypted.scraping_api,
          }
        : {}),
    };
  } catch (error) {
    logger.warn("Resolving domain scraper override failed", {
      domain: domainSettings.domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return settings;
  }
};

/**
 * Refreshes the Keywords position by Scraping Google Search Result by
 * Determining whether the keywords should be scraped in Parallel or not
 * @param {Keyword[]} rawKeyword - Keywords to scrape
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @param {DomainType[]} domains - Optional domain list for per-domain strategy overrides
 * @returns {Promise}
 */
const refreshAndUpdateKeywords = async (
  rawKeyword: Keyword[],
  settings: SettingsType,
  domains?: DomainType[]
): Promise<KeywordType[]> => {
  const keywords: KeywordType[] = rawKeyword.map((el) =>
    el.get({ plain: true })
  );
  if (!rawKeyword || rawKeyword.length === 0) {
    return [];
  }
  const start = performance.now();
  const updatedKeywords: KeywordType[] = [];

  if (["scrapingant", "serpapi", "searchapi"].includes(settings.scraper_type)) {
    const refreshedResults = await refreshParallel(keywords, settings, domains);
    for (const keyword of rawKeyword) {
      const keywordPlain = keyword.get({ plain: true }) as KeywordType;
      const domainSettings = domains?.find(
        (d) => d.domain === keywordPlain.domain
      );
      const effectiveSettings = resolveEffectiveSettings(
        settings,
        domainSettings
      );
      const refreshedKeywordData = refreshedResults.find(
        (k) => k && k.ID === keyword.ID
      );
      if (refreshedKeywordData) {
        const updatedKeyword = await updateKeywordPosition(
          keyword,
          refreshedKeywordData,
          effectiveSettings
        );
        updatedKeywords.push(updatedKeyword);
      } else {
        const clearedKeyword = await clearKeywordUpdatingState(
          keyword,
          effectiveSettings,
          "Parallel scrape returned no data"
        );
        updatedKeywords.push(clearedKeyword);
      }
    }
  } else {
    for (const keyword of rawKeyword) {
      logger.debug("Starting sequential scrape", { keyword: keyword.keyword });
      const keywordPlain = keyword.get({ plain: true }) as KeywordType;
      const domainSettings = domains?.find(
        (d) => d.domain === keywordPlain.domain
      );
      const effectiveSettings = resolveEffectiveSettings(
        settings,
        domainSettings
      );
      const updatedKeyword = await refreshAndUpdateKeyword(
        keyword,
        effectiveSettings,
        domainSettings
      );
      updatedKeywords.push(updatedKeyword);
      if (
        keywords.length > 0 &&
        settings.scrape_delay &&
        settings.scrape_delay !== "0"
      ) {
        await sleep(parseInt(settings.scrape_delay, 10));
      }
    }
  }

  const end = performance.now();
  logger.info("Keyword refresh completed", {
    durationMs: Math.round(end - start),
    keywordCount: rawKeyword.length,
  });
  return updatedKeywords;
};

/**
 * Scrape Serp for given keyword and update the position in DB.
 * @param {Keyword} keyword - Keywords to scrape
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @param {DomainType} domainSettings - Optional domain-level settings override
 * @returns {Promise<KeywordType>}
 */
const refreshAndUpdateKeyword = async (
  keyword: Keyword,
  settings: SettingsType,
  domainSettings?: DomainType
): Promise<KeywordType> => {
  const currentKeyword = keyword.get({ plain: true });
  try {
    const refreshedKeywordData = await scrapeKeywordWithStrategy(
      currentKeyword,
      settings,
      domainSettings
    );
    if (!refreshedKeywordData) {
      return clearKeywordUpdatingState(
        keyword,
        settings,
        "Scraper returned no data"
      );
    }

    return updateKeywordPosition(keyword, refreshedKeywordData, settings);
  } catch (error) {
    return clearKeywordUpdatingState(keyword, settings, `${error}`);
  }
};

/**
 * Processes the scraped data for the given keyword and updates the keyword serp position in DB.
 * @param {Keyword} keywordRaw - Keywords to Update
 * @param {RefreshResult} updatedKeyword - scraped Data for that Keyword
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @returns {Promise<KeywordType>}
 */
export const updateKeywordPosition = async (
  keywordRaw: Keyword,
  updatedKeyword: RefreshResult,
  settings: SettingsType
): Promise<KeywordType> => {
  const keywordParsed = parseKeywords([keywordRaw.get({ plain: true })]);
  const keyword = keywordParsed[0];
  // const updatedKeyword = refreshed;
  let updated = keyword;

  if (updatedKeyword && keyword) {
    const newPos = updatedKeyword.position;
    const { history } = keyword;
    const theDate = new Date();
    const dateKey = `${theDate.getFullYear()}-${
      theDate.getMonth() + 1
    }-${theDate.getDate()}`;
    history[dateKey] = newPos;

    const updatedVal = {
      position: newPos,
      updating: false,
      url: updatedKeyword.url,
      lastResult: updatedKeyword.result,
      history,
      lastUpdated: updatedKeyword.error
        ? keyword.lastUpdated
        : theDate.toJSON(),
      lastUpdateError: updatedKeyword.error
        ? JSON.stringify({
            date: theDate.toJSON(),
            error: `${updatedKeyword.error}`,
            scraper: settings.scraper_type,
          })
        : "false",
    };

    // If failed, Add to Retry Queue Cron
    if (updatedKeyword.error && settings?.scrape_retry) {
      await retryScrape(keyword.ID);
    } else {
      await removeFromRetryQueue(keyword.ID);
    }

    // Update the Keyword Position in Database
    try {
      await keywordRaw.update({
        ...updatedVal,
        lastResult: Array.isArray(updatedKeyword.result)
          ? JSON.stringify(updatedKeyword.result)
          : updatedKeyword.result,
        history: JSON.stringify(history),
      });

      if (updatedKeyword.error) {
        logger.warn("Updating keyword completed with scraper error", {
          keyword: keyword.keyword,
          foundPosition: newPos,
          url: updatedKeyword.url || "",
          error: String(updatedKeyword.error),
          scraper: settings.scraper_type,
        });
      } else {
        logger.info("Keyword updated", {
          keyword: keyword.keyword,
          foundPosition: newPos,
          url: updatedKeyword.url || "",
        });
      }

      updated = {
        ...keyword,
        ...updatedVal,
        lastUpdateError: JSON.parse(updatedVal.lastUpdateError),
      };
    } catch (error) {
      logger.error(
        "Updating SERP for keyword failed",
        error instanceof Error ? error : new Error(String(error)),
        { keyword: keyword.keyword }
      );
    }
  }

  return updated;
};

/**
 * Scrape Google Keyword Search Result in Parallel.
 * @param {KeywordType[]} keywords - Keywords to scrape
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @param {DomainType[]} domains - Optional domain list for per-domain strategy overrides
 * @returns {Promise}
 */
const refreshParallel = async (
  keywords: KeywordType[],
  settings: SettingsType,
  domains?: DomainType[]
): Promise<RefreshResult[]> => {
  const promises: Promise<RefreshResult>[] = keywords.map((keyword) => {
    const domainSettings = domains?.find((d) => d.domain === keyword.domain);
    return scrapeKeywordWithStrategy(
      keyword,
      resolveEffectiveSettings(settings, domainSettings),
      domainSettings
    );
  });

  const settledResults = await Promise.allSettled(promises);
  const results: RefreshResult[] = [];

  for (const settledResult of settledResults) {
    if (settledResult.status === "fulfilled") {
      results.push(settledResult.value);
      continue;
    }

    logger.error(
      "Parallel scrape failed",
      settledResult.reason instanceof Error
        ? settledResult.reason
        : new Error(String(settledResult.reason))
    );
    results.push(false);
  }

  logger.debug("Parallel scrape run finished", {
    keywordCount: keywords.length,
  });
  return results;
};

export default refreshAndUpdateKeywords;
