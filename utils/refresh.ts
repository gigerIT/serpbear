import { performance } from "perf_hooks";
import { setTimeout as sleep } from "timers/promises";
import {
  RefreshResult,
  removeFromRetryQueue,
  retryScrape,
  scrapeKeywordWithStrategy,
} from "./scraper";
import parseKeywords from "./parseKeywords";
import Keyword from "../database/models/keyword";

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
    console.log(
      "[ERROR] Clearing keyword updating state failed",
      currentKeyword.keyword,
      updateError
    );
  }

  try {
    if (error && settings?.scrape_retry) {
      await retryScrape(currentKeyword.ID);
    } else {
      await removeFromRetryQueue(currentKeyword.ID);
    }
  } catch (queueError) {
    console.log(
      "[ERROR] Updating retry queue failed",
      currentKeyword.keyword,
      queueError
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
      const refreshedKeywordData = refreshedResults.find(
        (k) => k && k.ID === keyword.ID
      );
      if (refreshedKeywordData) {
        const updatedKeyword = await updateKeywordPosition(
          keyword,
          refreshedKeywordData,
          settings
        );
        updatedKeywords.push(updatedKeyword);
      } else {
        const clearedKeyword = await clearKeywordUpdatingState(
          keyword,
          settings,
          "Parallel scrape returned no data"
        );
        updatedKeywords.push(clearedKeyword);
      }
    }
  } else {
    for (const keyword of rawKeyword) {
      console.log("START SCRAPE: ", keyword.keyword);
      const keywordPlain = keyword.get({ plain: true }) as KeywordType;
      const domainSettings = domains?.find(
        (d) => d.domain === keywordPlain.domain
      );
      const updatedKeyword = await refreshAndUpdateKeyword(
        keyword,
        settings,
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
  console.log(`time taken: ${end - start}ms`);
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
        console.log(
          `[ERROR] Updating the Keyword failed: ${
            keyword.keyword
          } | foundPosition=${newPos} | url="${
            updatedKeyword.url || ""
          }" | error="${updatedKeyword.error}" | scraper="${
            settings.scraper_type
          }"`
        );
      } else {
        console.log(
          `[SUCCESS] Updating the Keyword: ${
            keyword.keyword
          } | foundPosition=${newPos} | url="${updatedKeyword.url || ""}"`
        );
      }

      updated = {
        ...keyword,
        ...updatedVal,
        lastUpdateError: JSON.parse(updatedVal.lastUpdateError),
      };
    } catch (error) {
      console.log("[ERROR] Updating SERP for Keyword", keyword.keyword, error);
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
    return scrapeKeywordWithStrategy(keyword, settings, domainSettings);
  });

  const settledResults = await Promise.allSettled(promises);
  const results: RefreshResult[] = [];

  for (const settledResult of settledResults) {
    if (settledResult.status === "fulfilled") {
      results.push(settledResult.value);
      continue;
    }

    console.log(settledResult.reason);
    results.push(false);
  }

  console.log("ALL DONE!!!");
  return results;
};

export default refreshAndUpdateKeywords;
