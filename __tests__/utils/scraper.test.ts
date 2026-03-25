jest.mock("cheerio", () => ({
  load: jest.fn(),
}));

jest.mock("../../scrapers/index", () => [
  {
    id: "testscraper",
    name: "Test Scraper",
    website: "example.com",
    resultObjectKey: "results",
    scrapeURL: () => "https://example.com/scrape",
    serpExtractor: (content: any) => content,
  },
]);

import { scrapeKeywordFromGoogle } from "../../utils/scraper";

describe("scraper hardening", () => {
  const originalFetch = global.fetch;

  const keyword = {
    ID: 1,
    keyword: "test keyword",
    domain: "example.com",
    device: "desktop",
    country: "US",
    position: 0,
    url: "",
    lastResult: [],
    history: {},
    sticky: false,
    volume: 0,
    updating: false,
    lastUpdateError: false,
    lastUpdated: "",
    added: "",
    tags: [],
  } as KeywordType;

  const settings = {
    scraper_type: "testscraper",
    scaping_api: "test-key",
    notification_interval: "daily",
    notification_email: "",
    notification_email_from: "",
    notification_email_from_name: "",
    smtp_server: "",
    smtp_port: "",
    search_console: false,
    search_console_client_email: "",
    search_console_private_key: "",
    keywordsColumns: [],
  } as SettingsType;

  beforeAll(() => {
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("extracts request_info status and message from scraper failures", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        request_info: {
          success: false,
          status_code: 429,
          message: "Rate limit exceeded",
        },
      }),
    });

    const result = await scrapeKeywordFromGoogle(keyword, settings, 0);

    expect(result).not.toBe(false);
    if (result) {
      expect(result.error).toContain("429");
      expect(result.error).toContain("Rate limit exceeded");
    }
  });

  it("retries once and succeeds on the second response", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          request_info: {
            success: false,
            status_code: 503,
            message: "Temporary upstream failure",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          results: [
            {
              title: "Example Result",
              url: "https://example.com",
              position: 1,
            },
          ],
        }),
      });

    const scrapePromise = scrapeKeywordFromGoogle(keyword, settings, 1);
    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();
    const result = await scrapePromise;

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).not.toBe(false);
    if (result) {
      expect(result.error).toBe(false);
      expect(result.position).toBe(1);
      expect(result.url).toBe("https://example.com");
    }
  });

  it("returns a stable parse error when the response json is invalid", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        throw new Error("Unexpected token < in JSON");
      },
    });

    const result = await scrapeKeywordFromGoogle(keyword, settings, 0);

    expect(result).not.toBe(false);
    if (result) {
      expect(result.error).toContain("Failed to parse scraper JSON response");
    }
  });
});
