import { readFile } from "fs/promises";
import type { NextApiRequest, NextApiResponse } from "next";
import Cryptr from "cryptr";
import packageJson from "../../package.json";
import verifyUser from "../../utils/verifyUser";
import allScrapers from "../../scrapers/index";
import { clearAdwordsAccessTokenCache } from "../../utils/adwords";
import { atomicWriteFile } from "../../utils/atomicWrite";
import { retryQueueManager } from "../../utils/retryQueueManager";
import { logger } from "../../utils/logger";
import { safeJsonParse } from "../../utils/safeJsonParse";
import { withApiLogging } from "../../utils/apiLogging";

type SettingsGetResponse = {
  settings?: object | null;
  error?: string;
};

const settingsPath = `${process.cwd()}/data/settings.json`;

const buildDefaultSettings = (screenshotAPIKey: string): SettingsType => ({
  scraper_type: "none",
  scraping_api: "",
  scaping_api: "",
  notification_interval: "never",
  notification_email: "",
  notification_email_from: "",
  notification_email_from_name: "SerpBear",
  smtp_server: "",
  smtp_port: "",
  smtp_username: "",
  smtp_password: "",
  scrape_retry: false,
  screenshot_key: screenshotAPIKey,
  search_console: true,
  search_console_client_email: "",
  search_console_private_key: "",
  keywordsColumns: ["Best", "History", "Volume", "Search Console"],
  scrape_strategy: "basic",
  scrape_pagination_limit: 5,
  scrape_smart_full_fallback: false,
});

const trimStringProperties = <T extends Record<string, any>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" ? item.trim() : item,
    ])
  ) as T;
};

const readStoredSettings = async (): Promise<Partial<SettingsType> | null> => {
  try {
    const settingsRaw = await readFile(settingsPath, { encoding: "utf-8" });
    return safeJsonParse<Partial<SettingsType>>(
      settingsRaw,
      {},
      {
        context: "settings.json",
        logError: true,
      }
    );
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const getProvidedScraperApiKey = (settings: Partial<SettingsType>): string => {
  if (typeof settings.scraping_api === "string") {
    return settings.scraping_api;
  }

  if (typeof settings.scaping_api === "string") {
    return settings.scaping_api;
  }

  return "";
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = verifyUser(req, res);
  if (authorized !== "authorized") {
    return res.status(401).json({ error: authorized });
  }
  if (req.method === "GET") {
    return getSettings(req, res);
  }
  if (req.method === "PUT") {
    return updateSettings(req, res);
  }
  return res.status(405).json({ error: "Method not allowed" });
}

const getSettings = async (
  req: NextApiRequest,
  res: NextApiResponse<SettingsGetResponse>
) => {
  const settings = await getAppSettings();
  if (settings) {
    const version = packageJson.version;
    return res.status(200).json({ settings: { ...settings, version } });
  }
  return res.status(500).json({ error: "Error Loading Settings!" });
};

const updateSettings = async (
  req: NextApiRequest,
  res: NextApiResponse<SettingsGetResponse>
) => {
  const { settings } = req.body || {};
  if (!settings) {
    return res.status(400).json({ error: "Settings Data not Provided!" });
  }

  if (!process.env.SECRET) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const normalizedSettings = trimStringProperties(settings);
    const cryptr = new Cryptr(process.env.SECRET);
    const existingSettings = (await readStoredSettings()) || {};

    const previousClientID = existingSettings.adwords_client_id
      ? cryptr.decrypt(existingSettings.adwords_client_id)
      : "";
    const previousClientSecret = existingSettings.adwords_client_secret
      ? cryptr.decrypt(existingSettings.adwords_client_secret)
      : "";
    const nextClientID = normalizedSettings.adwords_client_id
      ? normalizedSettings.adwords_client_id.trim()
      : "";
    const nextClientSecret = normalizedSettings.adwords_client_secret
      ? normalizedSettings.adwords_client_secret.trim()
      : "";
    const adwordsCredentialsUnchanged =
      previousClientID === nextClientID &&
      previousClientSecret === nextClientSecret;
    const adwordsCredentialsChanged =
      Boolean(
        previousClientID ||
          previousClientSecret ||
          nextClientID ||
          nextClientSecret
      ) && !adwordsCredentialsUnchanged;

    const scraperApiKey = getProvidedScraperApiKey(normalizedSettings);
    const scaping_api = scraperApiKey
      ? cryptr.encrypt(scraperApiKey.trim())
      : "";
    const smtp_password = normalizedSettings.smtp_password
      ? cryptr.encrypt(normalizedSettings.smtp_password.trim())
      : "";
    const search_console_client_email =
      normalizedSettings.search_console_client_email
        ? cryptr.encrypt(normalizedSettings.search_console_client_email.trim())
        : "";
    const search_console_private_key =
      normalizedSettings.search_console_private_key
        ? cryptr.encrypt(normalizedSettings.search_console_private_key.trim())
        : "";
    const adwords_client_id = nextClientID ? cryptr.encrypt(nextClientID) : "";
    const adwords_client_secret = nextClientSecret
      ? cryptr.encrypt(nextClientSecret)
      : "";
    const adwords_developer_token = normalizedSettings.adwords_developer_token
      ? cryptr.encrypt(normalizedSettings.adwords_developer_token.trim())
      : "";
    const adwords_account_id = normalizedSettings.adwords_account_id
      ? cryptr.encrypt(normalizedSettings.adwords_account_id.trim())
      : "";
    const adwords_refresh_token = adwordsCredentialsUnchanged
      ? existingSettings.adwords_refresh_token ||
        normalizedSettings.adwords_refresh_token ||
        ""
      : normalizedSettings.adwords_refresh_token || "";

    const securedSettings = {
      ...normalizedSettings,
      scraping_api: scaping_api,
      scaping_api,
      smtp_password,
      search_console_client_email,
      search_console_private_key,
      adwords_client_id,
      adwords_client_secret,
      adwords_refresh_token,
      adwords_developer_token,
      adwords_account_id,
    };

    await atomicWriteFile(
      settingsPath,
      JSON.stringify(securedSettings),
      "utf-8"
    );
    if (adwordsCredentialsChanged) {
      clearAdwordsAccessTokenCache();
    }
    return res.status(200).json({ settings: normalizedSettings });
  } catch (error) {
    logger.error(
      "Updating app settings failed",
      error instanceof Error ? error : new Error(String(error))
    );
    return res.status(500).json({ error: "Error Updating Settings!" });
  }
};

export const getAppSettings = async (): Promise<SettingsType> => {
  const screenshotAPIKey = process.env.SCREENSHOT_API || "69408-serpbear";
  const defaultSettings = buildDefaultSettings(screenshotAPIKey);

  let failedQueue: string[] = [];

  try {
    failedQueue =
      ((await retryQueueManager.getQueue()) as unknown as string[]) || [];
  } catch (error) {
    logger.warn("Reading failed queue failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const storedSettingsRaw = await readStoredSettings();
    const storedSettings = storedSettingsRaw || {};

    if (storedSettingsRaw === null) {
      await atomicWriteFile(
        settingsPath,
        JSON.stringify(defaultSettings),
        "utf-8"
      );
      await retryQueueManager.clearQueue();
    }

    const settings: SettingsType = {
      ...defaultSettings,
      ...storedSettings,
    };
    let decryptedSettings = settings;

    if (!process.env.SECRET) {
      return {
        ...settings,
        scraping_api: "",
        scaping_api: "",
        smtp_password: "",
        search_console_client_email: "",
        search_console_private_key: "",
        adwords_client_id: "",
        adwords_client_secret: "",
        adwords_developer_token: "",
        adwords_account_id: "",
        available_scrapers: allScrapers.map((scraper) => ({
          label: scraper.name,
          value: scraper.id,
          allowsCity: !!scraper.allowsCity,
        })),
        failed_queue: failedQueue,
        screenshot_key: screenshotAPIKey,
        search_console_integrated: false,
      };
    }

    try {
      const cryptr = new Cryptr(process.env.SECRET);
      const encryptedScraperApi = settings.scraping_api || settings.scaping_api;
      const scaping_api = encryptedScraperApi
        ? cryptr.decrypt(encryptedScraperApi)
        : "";
      const smtp_password = settings.smtp_password
        ? cryptr.decrypt(settings.smtp_password)
        : "";
      const search_console_client_email = settings.search_console_client_email
        ? cryptr.decrypt(settings.search_console_client_email)
        : "";
      const search_console_private_key = settings.search_console_private_key
        ? cryptr.decrypt(settings.search_console_private_key)
        : "";
      const adwords_client_id = settings.adwords_client_id
        ? cryptr.decrypt(settings.adwords_client_id)
        : "";
      const adwords_client_secret = settings.adwords_client_secret
        ? cryptr.decrypt(settings.adwords_client_secret)
        : "";
      const adwords_developer_token = settings.adwords_developer_token
        ? cryptr.decrypt(settings.adwords_developer_token)
        : "";
      const adwords_account_id = settings.adwords_account_id
        ? cryptr.decrypt(settings.adwords_account_id)
        : "";

      decryptedSettings = {
        ...settings,
        scraping_api: scaping_api,
        scaping_api,
        smtp_password,
        search_console_client_email,
        search_console_private_key,
        search_console_integrated:
          !!(
            process.env.SEARCH_CONSOLE_PRIVATE_KEY &&
            process.env.SEARCH_CONSOLE_CLIENT_EMAIL
          ) || !!(search_console_client_email && search_console_private_key),
        available_scrapers: allScrapers.map((scraper) => ({
          label: scraper.name,
          value: scraper.id,
          allowsCity: !!scraper.allowsCity,
        })),
        failed_queue: failedQueue,
        screenshot_key: screenshotAPIKey,
        adwords_client_id,
        adwords_client_secret,
        adwords_developer_token,
        adwords_account_id,
        scrape_strategy: settings.scrape_strategy || "basic",
        scrape_pagination_limit: settings.scrape_pagination_limit || 5,
        scrape_smart_full_fallback:
          settings.scrape_smart_full_fallback || false,
      };
    } catch (error) {
      logger.warn("Decrypting settings values failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      decryptedSettings = {
        ...settings,
        scraping_api: "",
        scaping_api: "",
        smtp_password: "",
        search_console_client_email: "",
        search_console_private_key: "",
        adwords_client_id: "",
        adwords_client_secret: "",
        adwords_developer_token: "",
        adwords_account_id: "",
        available_scrapers: allScrapers.map((scraper) => ({
          label: scraper.name,
          value: scraper.id,
          allowsCity: !!scraper.allowsCity,
        })),
        failed_queue: failedQueue,
        screenshot_key: screenshotAPIKey,
      };
    }

    return decryptedSettings;
  } catch (error) {
    logger.error(
      "Getting app settings failed",
      error instanceof Error ? error : new Error(String(error))
    );
    await atomicWriteFile(
      settingsPath,
      JSON.stringify(defaultSettings),
      "utf-8"
    );
    await retryQueueManager.clearQueue();
    const otherSettings = {
      available_scrapers: allScrapers.map((scraper) => ({
        label: scraper.name,
        value: scraper.id,
        allowsCity: !!scraper.allowsCity,
      })),
      failed_queue: [],
    };
    return { ...defaultSettings, scaping_api: "", ...otherSettings };
  }
};

export default withApiLogging(handler, { name: "settings" });
