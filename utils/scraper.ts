import axios, { AxiosResponse, CreateAxiosDefaults } from "axios";
import * as cheerio from "cheerio";
import HttpsProxyAgent from "https-proxy-agent";
import countries from "./countries";
import { retryQueueManager } from "./retryQueueManager";
import allScrapers from "../scrapers/index";

type SearchResult = {
  title: string;
  url: string;
  position: number;
};

type SERPObject = {
  position: number;
  url: string;
};

type ScrapePageResult = {
  results: SearchResult[];
  error?: string;
};

export type RefreshResult =
  | false
  | {
      ID: number;
      keyword: string;
      position: number;
      url: string;
      result: KeywordLastResult[];
      error?: boolean | string;
    };

const TOTAL_PAGES = 10;
const PAGE_SIZE = 10;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const MAX_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;

const getRetryDelay = (attempt: number, baseDelay: number = 1000): number => {
  const exponentialDelay = baseDelay * 2 ** attempt;
  const jitter = Math.random() * exponentialDelay * 0.1;
  return Math.min(exponentialDelay + jitter, MAX_REQUEST_TIMEOUT_MS);
};

const stringifyErrorDetails = (details: unknown): string => {
  if (!details) {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  if (details instanceof Error) {
    return details.message;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
};

const getErrorMessage = (error: any): string => {
  if (!error) {
    return "Unknown error";
  }

  const responseData = error.response?.data;
  const messageParts = [
    error.message,
    error.response?.status
      ? `HTTP ${error.response.status}${
          error.response?.statusText ? ` ${error.response.statusText}` : ""
        }`
      : "",
    responseData?.detail,
    responseData?.error,
    stringifyErrorDetails(responseData),
  ].filter(Boolean);

  if (messageParts.length > 0) {
    return [...new Set(messageParts)].join(" | ");
  }

  return stringifyErrorDetails(error) || "Unknown error";
};

const hasScraperError = (responseBody: any): boolean => {
  if (!responseBody || typeof responseBody !== "object") {
    return false;
  }

  const status = responseBody.status;

  return Boolean(
    (typeof status === "number" && (status < 200 || status >= 300)) ||
      responseBody.ok === false ||
      responseBody.request_info?.success === false
  );
};

const buildScraperError = (responseBody: any): string => {
  if (!responseBody || typeof responseBody !== "object") {
    return "Unknown scraper error";
  }

  const statusCode =
    responseBody.status ?? responseBody.request_info?.status_code ?? null;
  const details = [
    responseBody.request_info?.error,
    responseBody.error_message,
    responseBody.detail,
    responseBody.error,
    responseBody.request_info?.message,
    responseBody.body,
    responseBody.message,
  ]
    .map((value) => stringifyErrorDetails(value))
    .filter(Boolean);

  const suffix = details.length > 0 ? details.join(" | ") : "Request failed";
  return statusCode ? `[${statusCode}] ${suffix}` : suffix;
};

const resolveFetchTimeoutMs = (
  scraper: ScraperSettings | undefined,
  retryAttempt: number
): number => {
  if (typeof scraper?.timeoutMs === "number" && scraper.timeoutMs > 0) {
    return scraper.timeoutMs;
  }

  return Math.min(
    MAX_REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS + retryAttempt * 5000
  );
};

type ScraperResponsePayload = {
  body: any;
  responseStatus?: number;
  responseStatusText?: string;
  responseOk?: boolean;
};

const parseScraperResponse = async (
  response: AxiosResponse | Response,
  useProxy: boolean
): Promise<ScraperResponsePayload> => {
  if (useProxy) {
    const axiosResponse = response as AxiosResponse;
    return {
      body: axiosResponse.data,
      responseStatus: axiosResponse.status,
      responseStatusText: axiosResponse.statusText,
      responseOk:
        typeof axiosResponse.status === "number"
          ? axiosResponse.status >= 200 && axiosResponse.status < 300
          : undefined,
    };
  }

  const fetchResponse = response as Response;
  let body;

  try {
    body = await fetchResponse.json();
  } catch (error) {
    throw new Error(
      `Failed to parse scraper JSON response: ${getErrorMessage(error)}`
    );
  }

  return {
    body,
    responseStatus: fetchResponse.status,
    responseStatusText: fetchResponse.statusText,
    responseOk: fetchResponse.ok,
  };
};

const normalizeScraperBody = ({
  body,
  responseStatus,
  responseStatusText,
  responseOk,
}: ScraperResponsePayload): any => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  return {
    ...body,
    status: body.status ?? responseStatus,
    ok: body.ok ?? responseOk,
    statusText: body.statusText ?? responseStatusText,
  };
};

const getScrapeResultPayload = (
  responseBody: any,
  scraperObj?: ScraperSettings
): string => {
  if (!responseBody) {
    return "";
  }

  const scraperResult =
    scraperObj?.resultObjectKey && responseBody[scraperObj.resultObjectKey]
      ? responseBody[scraperObj.resultObjectKey]
      : "";

  return (
    responseBody.data ||
    responseBody.html ||
    responseBody.results ||
    responseBody.body ||
    scraperResult ||
    ""
  );
};

const sleepForRetry = async (attempt: number): Promise<void> => {
  const delay = getRetryDelay(attempt);
  await new Promise((resolve) => setTimeout(resolve, delay));
};

const logScrapeError = (
  context: string,
  details: {
    keyword: KeywordType;
    scraperType: string;
    scraperObj?: ScraperSettings;
    page?: number;
    pagination?: ScraperPagination;
    extra?: Record<string, unknown>;
  },
  error: unknown
): void => {
  const { keyword, scraperType, scraperObj, page, pagination, extra } = details;
  console.log(
    `[ERROR] ${context}: ${getErrorMessage(error)} | keyword="${
      keyword.keyword
    }" | domain="${keyword.domain}" | device="${
      keyword.device
    }" | scraperType="${scraperType || "unknown"}" | scraper="${
      scraperObj?.name || scraperObj?.id || "unknown"
    }"${typeof page === "number" ? ` | page=${page}` : ""}${
      pagination ? ` | start=${pagination.start} | num=${pagination.num}` : ""
    }${
      extra && Object.keys(extra).length > 0
        ? ` | extra=${stringifyErrorDetails(extra)}`
        : ""
    }`
  );
};

const logScrapeSuccess = (
  context: string,
  details: {
    keyword: KeywordType;
    position: number;
    url: string;
    strategy?: ScrapeStrategy;
  }
): void => {
  const { keyword, position, url, strategy } = details;
  console.log(
    `[SERP] ${context}: keyword="${keyword.keyword}" | domain="${
      keyword.domain
    }" | foundPosition=${position} | url="${url || ""}"${
      strategy ? ` | strategy=${strategy}` : ""
    }`
  );
};

/**
 * Creates a SERP Scraper client promise based on the app settings.
 * @param {KeywordType} keyword - the keyword to get the SERP for.
 * @param {SettingsType} settings - the App Settings that contains the scraper details
 * @param {ScraperSettings} scraper - optional specific scraper config
 * @param {ScraperPagination} pagination - optional pagination params
 * @returns {Promise}
 */
export const getScraperClient = (
  keyword: KeywordType,
  settings: SettingsType,
  scraper?: ScraperSettings,
  pagination?: ScraperPagination
): Promise<AxiosResponse | Response> | false => {
  let apiURL = "";
  let client: Promise<AxiosResponse | Response> | false = false;
  const headers: any = {
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
    Accept: "application/json; charset=utf8;",
  };

  const mobileAgent =
    "Mozilla/5.0 (Linux; Android 10; SM-G996U Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36";
  if (keyword && keyword.device === "mobile") {
    headers["User-Agent"] = mobileAgent;
  }

  if (scraper) {
    // Set Scraper Header
    const scrapeHeaders = scraper.headers
      ? scraper.headers(keyword, settings)
      : null;
    const scraperApiUrl = scraper.scrapeURL
      ? scraper.scrapeURL(keyword, settings, countries, pagination)
      : null;
    if (scrapeHeaders && Object.keys(scrapeHeaders).length > 0) {
      Object.keys(scrapeHeaders).forEach((headerItemKey: string) => {
        headers[headerItemKey] = scrapeHeaders[headerItemKey as keyof object];
      });
    }
    // Set Scraper API URL
    // If not URL is generated, stop right here.
    if (scraperApiUrl) {
      apiURL = scraperApiUrl;
    } else {
      return false;
    }
  }

  if (settings && settings.scraper_type === "proxy" && settings.proxy) {
    const axiosConfig: CreateAxiosDefaults = {};
    headers.Accept = "gzip,deflate,compress;";
    axiosConfig.headers = headers;
    const proxies = settings.proxy.split(/\r?\n|\r|\n/g);
    let proxyURL = "";
    if (proxies.length > 1) {
      proxyURL = proxies[Math.floor(Math.random() * proxies.length)];
    } else {
      const [firstProxy] = proxies;
      proxyURL = firstProxy;
    }

    axiosConfig.httpsAgent = new (HttpsProxyAgent as any)(proxyURL.trim());
    axiosConfig.proxy = false;
    const axiosClient = axios.create(axiosConfig);
    const p = pagination || { start: 0, num: PAGE_SIZE };
    client = axiosClient.get(
      `https://www.google.com/search?num=${p.num}&start=${
        p.start
      }&q=${encodeURI(keyword.keyword)}`
    );
  } else {
    const requestOptions = scraper?.requestOptions
      ? scraper.requestOptions(keyword, settings, countries, pagination)
      : {};
    client = fetch(apiURL, {
      method: "GET",
      ...requestOptions,
      headers: {
        ...headers,
        ...(requestOptions.headers || {}),
      },
    });
  }

  return client;
};

/**
 * Scrape a single page of Google Search results with absolute position offsets applied.
 */
const scrapeSinglePage = async (
  keyword: KeywordType,
  settings: SettingsType,
  scraperObj: ScraperSettings | undefined,
  pagination: ScraperPagination
): Promise<ScrapePageResult> => {
  const scraperType = settings?.scraper_type || "";
  const scraperClient = getScraperClient(
    keyword,
    settings,
    scraperObj,
    pagination
  );
  if (!scraperClient) {
    return {
      results: [],
      error: `Unable to create scraper client for scraperType="${
        scraperType || "unknown"
      }"`,
    };
  }
  try {
    const res =
      scraperType === "proxy" && settings.proxy
        ? await scraperClient
        : await scraperClient.then((result: any) => result.json());
    const scraperResult =
      scraperObj?.resultObjectKey && res[scraperObj.resultObjectKey]
        ? res[scraperObj.resultObjectKey]
        : "";
    const scrapeResult: string =
      res.data || res.html || res.results || scraperResult || "";
    if (res && scrapeResult) {
      const extracted = scraperObj?.serpExtractor
        ? scraperObj.serpExtractor(scrapeResult)
        : extractScrapedResult(scrapeResult, keyword.device);
      return {
        results: extracted.map((item, i) => ({
          ...item,
          position: pagination.start + i + 1,
        })),
      };
    }

    const emptyResponseError = `Scraper response did not include usable result content: ${stringifyErrorDetails(
      {
        hasData: Boolean((res as any)?.data),
        hasHtml: Boolean((res as any)?.html),
        hasResults: Boolean((res as any)?.results),
        detail: (res as any)?.detail,
        error: (res as any)?.error,
        resultObjectKey: scraperObj?.resultObjectKey || null,
      }
    )}`;
    logScrapeError(
      "Scraping page failed",
      {
        keyword,
        scraperType,
        scraperObj,
        page: pagination.page,
        pagination,
      },
      new Error(emptyResponseError)
    );
    return { results: [], error: emptyResponseError };
  } catch (error: any) {
    const message = getErrorMessage(error);
    logScrapeError(
      "Scraping page failed",
      {
        keyword,
        scraperType,
        scraperObj,
        page: pagination.page,
        pagination,
      },
      error
    );
    return { results: [], error: message };
  }
};

/**
 * Build a 100-position result array: scraped positions keep their data, unscraped positions are marked skipped.
 */
const buildFullResults = (
  scrapedResults: SearchResult[],
  totalPositions: number = TOTAL_PAGES * PAGE_SIZE
): KeywordLastResult[] => {
  const scrapedByPos = new Map(scrapedResults.map((r) => [r.position, r]));
  const full: KeywordLastResult[] = [];
  for (let i = 1; i <= totalPositions; i += 1) {
    const found = scrapedByPos.get(i);
    full.push(
      found
        ? { position: i, url: found.url, title: found.title }
        : { position: i, url: "", title: "", skipped: true }
    );
  }
  return full;
};

/**
 * Resolve effective scrape strategy from domain-level overrides or global settings.
 */
const resolveStrategy = (
  settings: SettingsType,
  domainSettings?: Partial<DomainType>
): {
  strategy: ScrapeStrategy;
  paginationLimit: number;
  smartFullFallback: boolean;
} => {
  const domainStrategy = domainSettings?.scrape_strategy;

  // If no domain-level strategy override is set, use global settings for everything.
  if (!domainStrategy) {
    return {
      strategy: (settings.scrape_strategy || "basic") as ScrapeStrategy,
      paginationLimit: settings.scrape_pagination_limit || 5,
      smartFullFallback: settings.scrape_smart_full_fallback || false,
    };
  }

  // Domain override is active — use domain values, fall back to global for unset fields.
  const strategy: ScrapeStrategy = domainStrategy as ScrapeStrategy;
  const paginationLimit: number =
    domainSettings?.scrape_pagination_limit ||
    settings.scrape_pagination_limit ||
    5;
  const smartFullFallback: boolean =
    domainSettings?.scrape_smart_full_fallback ??
    (settings.scrape_smart_full_fallback || false);
  return { strategy, paginationLimit, smartFullFallback };
};

/**
 * Scrape Google Search results using the configured scrape strategy (Basic, Custom, Smart).
 * Domain-level settings override global settings. Marks non-scraped positions as skipped.
 * @param {KeywordType} keyword - the keyword to scrape
 * @param {SettingsType} settings - global App Settings
 * @param {Partial<DomainType>} domainSettings - optional domain-level setting overrides
 * @returns {RefreshResult}
 */
export const scrapeKeywordWithStrategy = async (
  keyword: KeywordType,
  settings: SettingsType,
  domainSettings?: Partial<DomainType>
): Promise<RefreshResult> => {
  const scraperType = settings?.scraper_type || "";
  const scraperObj = allScrapers.find(
    (s: ScraperSettings) => s.id === scraperType
  );

  const errorResult: RefreshResult = {
    ID: keyword.ID,
    keyword: keyword.keyword,
    position: keyword.position,
    url: keyword.url,
    result: keyword.lastResult,
    error: "Unknown scrape error",
  };

  // Native-pagination scrapers (serpapi, searchapi) fetch 100 results in one request
  if (scraperObj?.nativePagination) {
    return scrapeKeywordFromGoogle(keyword, settings);
  }

  const { strategy, paginationLimit, smartFullFallback } = resolveStrategy(
    settings,
    domainSettings
  );
  let pagesToScrape: number[];

  if (strategy === "custom") {
    const limit = Math.max(1, Math.min(paginationLimit, TOTAL_PAGES));
    pagesToScrape = Array.from({ length: limit }, (_, i) => i + 1);
  } else if (strategy === "smart") {
    const lastPos = keyword.position;
    const lastPage = lastPos > 0 ? Math.ceil(lastPos / PAGE_SIZE) : 1;
    const neighbors = [lastPage - 1, lastPage, lastPage + 1].filter(
      (p) => p >= 1 && p <= TOTAL_PAGES
    );
    pagesToScrape = [...new Set(neighbors)];
  } else {
    pagesToScrape = [1]; // Basic: first page only
  }

  const allScrapedResults: SearchResult[] = [];
  const pageErrors: string[] = [];
  for (const pageNum of pagesToScrape) {
    const pagination: ScraperPagination = {
      start: (pageNum - 1) * PAGE_SIZE,
      num: PAGE_SIZE,
      page: pageNum,
    };
    const pageScrape = await scrapeSinglePage(
      keyword,
      settings,
      scraperObj,
      pagination
    );
    if (pageScrape.results.length > 0) {
      allScrapedResults.push(...pageScrape.results);
    } else if (pageScrape.error) {
      pageErrors.push(`page ${pageNum}: ${pageScrape.error}`);
    }
  }

  if (allScrapedResults.length === 0) {
    return {
      ...errorResult,
      error:
        pageErrors.join(" || ") ||
        `No results scraped for keyword "${keyword.keyword}"`,
    };
  }
  // Smart + full fallback: if domain not found on neighboring pages, scrape the rest
  if (strategy === "smart" && smartFullFallback) {
    const serpCheck = getSerp(keyword.domain, allScrapedResults);
    if (serpCheck.position === 0) {
      const alreadyScraped = new Set(pagesToScrape);
      const remainingPages = Array.from(
        { length: TOTAL_PAGES },
        (_, i) => i + 1
      ).filter((p) => !alreadyScraped.has(p));
      for (const pageNum of remainingPages) {
        const pagination: ScraperPagination = {
          start: (pageNum - 1) * PAGE_SIZE,
          num: PAGE_SIZE,
          page: pageNum,
        };
        const pageScrape = await scrapeSinglePage(
          keyword,
          settings,
          scraperObj,
          pagination
        );
        if (pageScrape.results.length > 0) {
          allScrapedResults.push(...pageScrape.results);
        } else if (pageScrape.error) {
          pageErrors.push(`page ${pageNum}: ${pageScrape.error}`);
        }
      }
    }
  }

  const finalSerp = getSerp(keyword.domain, allScrapedResults);
  const fullResults = buildFullResults(allScrapedResults);

  logScrapeSuccess("Keyword scraped", {
    keyword,
    position: finalSerp.position,
    url: finalSerp.url,
    strategy,
  });
  return {
    ID: keyword.ID,
    keyword: keyword.keyword,
    position: finalSerp.position,
    url: finalSerp.url,
    result: fullResults,
    error: false,
  };
};

/**
 * Scrape Google Search result from a single request (used by native-pagination scrapers and keyword preview).
 * For strategy-based multi-page scraping use scrapeKeywordWithStrategy().
 * @param {KeywordType} keyword - the keyword to search for in Google.
 * @param {SettingsType} settings - the App Settings
 * @returns {RefreshResult}
 */
export const scrapeKeywordFromGoogle = async (
  keyword: KeywordType,
  settings: SettingsType
): Promise<RefreshResult> => {
  let refreshedResults: RefreshResult = {
    ID: keyword.ID,
    keyword: keyword.keyword,
    position: keyword.position,
    url: keyword.url,
    result: keyword.lastResult,
    error: true,
  };
  const scraperType = settings?.scraper_type || "";
  const scraperObj = allScrapers.find(
    (scraper: ScraperSettings) => scraper.id === scraperType
  );
  const nativePagination: ScraperPagination = { start: 0, num: 100, page: 1 };
  const scraperClient = getScraperClient(
    keyword,
    settings,
    scraperObj,
    nativePagination
  );

  if (!scraperClient) {
    return false;
  }

  let scraperError: any = null;
  try {
    const res =
      scraperType === "proxy" && settings.proxy
        ? await scraperClient
        : await scraperClient.then((result: any) => result.json());
    const scraperResult =
      scraperObj?.resultObjectKey && res[scraperObj.resultObjectKey]
        ? res[scraperObj.resultObjectKey]
        : "";
    const scrapeResult: string =
      res.data || res.html || res.results || scraperResult || "";
    if (res && scrapeResult) {
      const extracted = scraperObj?.serpExtractor
        ? scraperObj.serpExtractor(scrapeResult)
        : extractScrapedResult(scrapeResult, keyword.device);
      await writeFile("result.txt", JSON.stringify(scrapeResult), {
        encoding: "utf-8",
      }).catch((err) => {
        console.log(err);
      });
      const serp = getSerp(keyword.domain, extracted);
      refreshedResults = {
        ID: keyword.ID,
        keyword: keyword.keyword,
        position: serp.position,
        url: serp.url,
        result: extracted,
        error: false,
      };
      logScrapeSuccess("Keyword scraped", {
        keyword,
        position: serp.position,
        url: serp.url,
      });
    } else {
      scraperError = res.detail || res.error || "Unknown Error";
      throw new Error(
        `Scraper response did not include usable result content: ${stringifyErrorDetails(
          {
            detail: res?.detail,
            error: res?.error,
            hasData: Boolean(res?.data),
            hasHtml: Boolean(res?.html),
            hasResults: Boolean(res?.results),
            resultObjectKey: scraperObj?.resultObjectKey || null,
          }
        )}`
      );
    }
  } catch (error: any) {
    refreshedResults.error = scraperError || "Unknown Error";
    if (
      settings.scraper_type === "proxy" &&
      error &&
      error.response &&
      error.response.statusText
    ) {
      refreshedResults.error = `[${error.response.status}] ${error.response.statusText}`;
    } else if (settings.scraper_type === "proxy" && error) {
      refreshedResults.error = getErrorMessage(error);
    }

    logScrapeError(
      "Scraping keyword failed",
      {
        keyword,
        scraperType,
        scraperObj,
        page: nativePagination.page,
        pagination: nativePagination,
        extra: {
          scraperError,
          resultObjectKey: scraperObj?.resultObjectKey || null,
        },
      },
      error
    );
  }

  return refreshedResults;
};

/**
 * Extracts the Google Search result as object array from the Google Search's HTML content
 * @param {string} content - scraped google search page html data.
 * @param {string} device - The device of the keyword.
 * @returns {SearchResult[]}
 */
export const extractScrapedResult = (
  content: string,
  device: string
): SearchResult[] => {
  const extractedResult = [];

  const $ = cheerio.load(content);
  const hasValidContent = [
    ...$("body").find("#search"),
    ...$("body").find("#rso"),
  ];
  if (hasValidContent.length === 0) {
    const msg =
      "[ERROR] Scraped search results do not adhere to expected format. Unable to parse results";
    console.log(msg);
    throw new Error(msg);
  }

  // Desktop: try #search > div > div + h3 (classic layout)
  const hasNumberOfResult = $("body").find("#search  > div > div");
  const searchResultItems = hasNumberOfResult.find("h3");
  let lastPosition = 0;

  for (let i = 0; i < searchResultItems.length; i += 1) {
    if (searchResultItems[i]) {
      const title = $(searchResultItems[i]).html();
      const url = $(searchResultItems[i]).closest("a").attr("href");
      if (title && url) {
        lastPosition += 1;
        extractedResult.push({ title, url, position: lastPosition });
      }
    }
  }

  // Desktop fallback: #rso with [role="heading"] (newer Google layout — no h3, no #search)
  if (extractedResult.length === 0) {
    const rsoHeadings = $("body").find('#rso [role="heading"]');
    for (let i = 0; i < rsoHeadings.length; i += 1) {
      const heading = $(rsoHeadings[i]);
      const title = heading.text();
      const url = heading.closest("a").attr("href");
      if (title && url && url.startsWith("http")) {
        lastPosition += 1;
        extractedResult.push({ title, url, position: lastPosition });
      }
    }
  }

  // Mobile Scraper
  if (extractedResult.length === 0 && device === "mobile") {
    const items = $("body").find("#rso > div");
    console.log(
      "Scraped search results contain ",
      items.length,
      " mobile results."
    );
    for (let i = 0; i < items.length; i += 1) {
      const item = $(items[i]);
      const linkDom = item.find('a[role="presentation"]');
      if (linkDom) {
        const url = linkDom.attr("href");
        const titleDom = linkDom.find('[role="link"]');
        const title = titleDom ? titleDom.text() : "";
        if (title && url) {
          lastPosition += 1;
          extractedResult.push({ title, url, position: lastPosition });
        }
      }
    }
  }
  // console.log('Scraped search results count: ', extractedResult.length);

  return extractedResult;
};

/**
 * Find in the domain's position from the extracted search result.
 * @param {string} domainURL - URL Name to look for.
 * @param {SearchResult[]} result - The search result array extracted from the Google Search result.
 * @returns {SERPObject}
 */
export const getSerp = (
  domainURL: string,
  result: SearchResult[]
): SERPObject => {
  if (result.length === 0 || !domainURL) {
    return { position: 0, url: "" };
  }
  const URLToFind = new URL(
    domainURL.includes("https://") ? domainURL : `https://${domainURL}`
  );
  const isURL = URLToFind.pathname !== "/";
  const stripWww = (hostname: string) => hostname.replace(/^www\./, "");
  const foundItem = result.find((item) => {
    if (!item.url) {
      return false;
    }
    const itemURL = new URL(
      item.url.includes("https://") ? item.url : `https://${item.url}`
    );
    if (
      isURL &&
      `${stripWww(URLToFind.hostname)}${URLToFind.pathname}/` ===
        stripWww(itemURL.hostname) + itemURL.pathname
    ) {
      return true;
    }
    return stripWww(URLToFind.hostname) === stripWww(itemURL.hostname);
  });
  return {
    position: foundItem ? foundItem.position : 0,
    url: foundItem && foundItem.url ? foundItem.url : "",
  };
};

/**
 * When a Refresh request is failed, automatically add the keyword id to a failed_queue.json file
 * so that the retry cron tries to scrape it every hour until the scrape is successful.
 * @param {string} keywordID - The keywordID of the failed Keyword Scrape.
 * @returns {void}
 */
export const retryScrape = async (keywordID: number): Promise<void> => {
  if (!keywordID && !Number.isInteger(keywordID)) {
    return;
  }
  let currentQueue: number[] = [];

  const filePath = `${process.cwd()}/data/failed_queue.json`;
  const currentQueueRaw = await readFile(filePath, { encoding: "utf-8" }).catch(
    (err) => {
      console.log(err);
      return "[]";
    }
  );
  currentQueue = currentQueueRaw ? JSON.parse(currentQueueRaw) : [];

  if (!currentQueue.includes(keywordID)) {
    currentQueue.push(Math.abs(keywordID));
  }

  await writeFile(filePath, JSON.stringify(currentQueue), {
    encoding: "utf-8",
  }).catch((err) => {
    console.log(err);
    return "[]";
  });
};

/**
 * When a Refresh request is completed, remove it from the failed retry queue.
 * @param {string} keywordID - The keywordID of the failed Keyword Scrape.
 * @returns {void}
 */
export const removeFromRetryQueue = async (
  keywordID: number
): Promise<void> => {
  if (!keywordID && !Number.isInteger(keywordID)) {
    return;
  }
  let currentQueue: number[] = [];

  const filePath = `${process.cwd()}/data/failed_queue.json`;
  const currentQueueRaw = await readFile(filePath, { encoding: "utf-8" }).catch(
    (err) => {
      console.log(err);
      return "[]";
    }
  );
  currentQueue = currentQueueRaw ? JSON.parse(currentQueueRaw) : [];
  currentQueue = currentQueue.filter((item) => item !== Math.abs(keywordID));

  await writeFile(filePath, JSON.stringify(currentQueue), {
    encoding: "utf-8",
  }).catch((err) => {
    console.log(err);
    return "[]";
  });
};
