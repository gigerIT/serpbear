const Cryptr = require("cryptr");
const { promises } = require("fs");
const { Cron } = require("croner");
require("dotenv").config({ path: "./.env.local" });

const dataDirectory = `${process.cwd()}/data`;
const settingsPath = `${dataDirectory}/settings.json`;
const failedQueuePath = `${dataDirectory}/failed_queue.json`;

const defaultSettings = {
  scraper_type: "none",
  notification_interval: "never",
  notification_email: "",
  smtp_server: "",
  smtp_port: "",
  smtp_username: "",
  smtp_password: "",
};

const normalizeBaseURL = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const getInternalBaseURL = () => {
  const serverPort = process.env.PORT || 3000;
  return normalizeBaseURL(`http://localhost:${serverPort}`);
};

const ensureDataDirectory = async () => {
  await promises.mkdir(dataDirectory, { recursive: true }).catch(() => {});
};

const writeJSONFile = async (filePath, value) => {
  await ensureDataDirectory();
  await promises
    .writeFile(filePath, JSON.stringify(value), { encoding: "utf-8" })
    .catch(() => {});
};

const recoverCorruptJSONFile = async (filePath, fallbackValue) => {
  const backupPath = `${filePath}.${Date.now()}.corrupt`;
  console.log(
    `[WARN] Corrupt JSON detected in ${filePath}. Backing up to ${backupPath}`
  );
  await promises.rename(filePath, backupPath).catch(() => {});
  await writeJSONFile(filePath, fallbackValue);
};

const readJSONFile = async (filePath, fallbackValue, options = {}) => {
  const { recoverCorrupt = false } = options;

  try {
    const rawValue = await promises.readFile(filePath, { encoding: "utf-8" });
    if (!rawValue) {
      return fallbackValue;
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      if (recoverCorrupt) {
        await recoverCorruptJSONFile(filePath, fallbackValue);
      }
      return fallbackValue;
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    console.log(`ERROR Reading JSON File ${filePath}..`, error);
    return fallbackValue;
  }
};

const getAppSettings = async () => {
  const settings = await readJSONFile(settingsPath, defaultSettings, {
    recoverCorrupt: true,
  });

  if (settings === null) {
    await writeJSONFile(settingsPath, defaultSettings);
    return defaultSettings;
  }

  let decryptedSettings = settings;

  try {
    const cryptr = new Cryptr(process.env.SECRET);
    const encryptedScraperApi = settings.scraping_api || settings.scaping_api;
    const scaping_api = encryptedScraperApi
      ? cryptr.decrypt(encryptedScraperApi)
      : "";
    const smtp_password = settings.smtp_password
      ? cryptr.decrypt(settings.smtp_password)
      : "";
    decryptedSettings = {
      ...settings,
      scraping_api: scaping_api,
      scaping_api,
      smtp_password,
    };
  } catch (error) {
    console.log("Error Decrypting Settings API Keys!");
  }

  return decryptedSettings;
};

const getFailedQueue = async () => {
  const queue = await readJSONFile(failedQueuePath, [], {
    recoverCorrupt: true,
  });

  if (queue === null) {
    await writeJSONFile(failedQueuePath, []);
    return [];
  }

  if (!Array.isArray(queue)) {
    await writeJSONFile(failedQueuePath, []);
    return [];
  }

  return queue.filter(
    (keywordID) => Number.isInteger(keywordID) && keywordID > 0
  );
};

const makeCronRequest = (endpoint) => {
  const fetchOpts = {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.APIKEY}` },
  };

  return fetch(`${getInternalBaseURL()}${endpoint}`, fetchOpts)
    .then((res) => res.json())
    .catch((error) => {
      console.log(`ERROR Making Cron Request for ${endpoint}..`);
      console.log(error);
    });
};

const generateCronTime = (interval) => {
  let cronTime = false;
  if (interval === "hourly") {
    cronTime = "0 0 */1 * * *";
  }
  if (interval === "daily") {
    cronTime = "0 0 0 * * *";
  }
  if (interval === "other_day") {
    cronTime = "0 0 2-30/2 * *";
  }
  if (interval === "daily_morning") {
    cronTime = "0 0 3 * * *";
  }
  if (interval === "weekly") {
    cronTime = "0 0 * * 1";
  }
  if (interval === "monthly") {
    cronTime = "0 0 1 * *"; // Run every first day of the month at 00:00(midnight)
  }

  return cronTime;
};

const runAppCronJobs = () => {
  getAppSettings().then((settings) => {
    // RUN SERP Scraping CRON (EveryDay at Midnight) 0 0 0 * *
    const scrape_interval = settings.scrape_interval || "daily";
    if (scrape_interval !== "never") {
      const scrapeCronTime = generateCronTime(scrape_interval);
      new Cron(
        scrapeCronTime,
        () => {
          // console.log('### Running Keyword Position Cron Job!');
          makeCronRequest("/api/cron");
        },
        { scheduled: true }
      );
    }

    // RUN Email Notification CRON
    const notif_interval =
      !settings.notification_interval ||
      settings.notification_interval === "never"
        ? false
        : settings.notification_interval;
    if (notif_interval) {
      const cronTime = generateCronTime(
        notif_interval === "daily" ? "daily_morning" : notif_interval
      );
      if (cronTime) {
        new Cron(
          cronTime,
          () => {
            // console.log('### Sending Notification Email...');
            makeCronRequest("/api/notify").then((data) => console.log(data));
          },
          { scheduled: true }
        );
      }
    }
  });

  // Run Failed scraping CRON (Every Hour)
  const failedCronTime = generateCronTime("hourly");
  new Cron(
    failedCronTime,
    async () => {
      // console.log('### Retrying Failed Scrapes...');

      const keywordsToRetry = await getFailedQueue();
      if (keywordsToRetry.length > 0) {
        makeCronRequest(`/api/refresh?id=${keywordsToRetry.join(",")}`).then(
          (refreshedData) => console.log(refreshedData)
        );
      }
    },
    { scheduled: true }
  );

  // Run Google Search Console Scraper Daily
  if (
    process.env.SEARCH_CONSOLE_PRIVATE_KEY &&
    process.env.SEARCH_CONSOLE_CLIENT_EMAIL
  ) {
    const searchConsoleCRONTime = generateCronTime("daily");
    new Cron(
      searchConsoleCRONTime,
      () => {
        makeCronRequest("/api/searchconsole").then((data) => console.log(data));
      },
      { scheduled: true }
    );
  }
};

if (require.main === module) {
  runAppCronJobs();
}

module.exports = {
  getAppSettings,
  getFailedQueue,
  getInternalBaseURL,
  makeCronRequest,
  runAppCronJobs,
};
