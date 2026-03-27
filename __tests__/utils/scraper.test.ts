jest.mock("cheerio", () => ({
  load: jest.fn(),
}));

jest.mock("../../scrapers/index", () => [
  {
    id: "testscraper",
    name: "Test Scraper",
    website: "example.com",
    resultObjectKey: "results",
    scrapeURL: (
      _keyword: any,
      _settings: any,
      _countries: any,
      pagination: any
    ) => `https://example.com/scrape?page=${pagination?.page ?? 1}`,
    serpExtractor: (content: any) => content,
  },
  {
    id: "payloadscraper",
    name: "Payload Scraper",
    website: "example.com",
    resultObjectKey: "payload",
    scrapeURL: (
      _keyword: any,
      _settings: any,
      _countries: any,
      pagination: any
    ) => `https://example.com/payload?page=${pagination?.page ?? 1}`,
    serpExtractor: (content: any) => content,
  },
]);

import {
  normalizeGoogleHref,
  scrapeKeywordFromGoogle,
  scrapeKeywordWithStrategy,
} from "../../utils/scraper";

describe("normalizeGoogleHref", () => {
  it("unwraps Google redirect urls", () => {
    expect(
      normalizeGoogleHref(
        "/url?q=https%3A%2F%2Fexample.com%2Flanding&sa=U&ved=0"
      )
    ).toBe("https://example.com/landing");
    expect(
      normalizeGoogleHref(
        "/interstitial?url=https://example.com/from-interstitial"
      )
    ).toBe("https://example.com/from-interstitial");
  });

  it("normalizes protocol-relative and relative paths", () => {
    expect(normalizeGoogleHref("//example.com/path")).toBe(
      "https://example.com/path"
    );
    expect(normalizeGoogleHref("/maps/place/test")).toBe(
      "https://www.google.com/maps/place/test"
    );
  });
});

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

  it("always scrapes page one in smart strategy mode", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("page=1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            results: [
              {
                title: "Top Result",
                url: "https://example.com/top-result",
                position: 1,
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          results: [
            {
              title: `Page Result ${url}`,
              url: "https://elsewhere.com/result",
              position: 1,
            },
          ],
        }),
      });
    });

    const result = await scrapeKeywordWithStrategy(
      {
        ...keyword,
        position: 25,
      },
      {
        ...settings,
        scrape_strategy: "smart",
      }
    );

    expect(result).not.toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1"),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=3"),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=4"),
      expect.any(Object)
    );

    if (result) {
      expect(result.position).toBe(1);
      expect(result.url).toBe("https://example.com/top-result");
    }
  });

  it("prefers the scraper-specific payload over generic response fields", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: [
          {
            title: "Wrong Result",
            url: "https://elsewhere.com",
            position: 1,
          },
        ],
        payload: [
          {
            title: "Expected Result",
            url: "https://example.com",
            position: 1,
          },
        ],
      }),
    });

    const result = await scrapeKeywordFromGoogle(
      keyword,
      {
        ...settings,
        scraper_type: "payloadscraper",
      },
      0
    );

    expect(result).not.toBe(false);
    if (result) {
      expect(result.position).toBe(1);
      expect(result.url).toBe("https://example.com");
      expect(result.error).toBe(false);
    }
  });

  it("returns an error when most smart-strategy pages fail and the domain is still missing", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("page=2")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            results: [
              {
                title: "Nearby Result",
                url: "https://elsewhere.com/page-two",
                position: 1,
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          request_info: {
            success: false,
            status_code: 503,
            message: `Unavailable for ${url}`,
          },
        }),
      });
    });

    const scrapePromise = scrapeKeywordWithStrategy(
      {
        ...keyword,
        position: 25,
      },
      {
        ...settings,
        scrape_strategy: "smart",
      }
    );
    await Promise.resolve();
    await jest.runAllTimersAsync();
    const result = await scrapePromise;

    expect(result).not.toBe(false);
    if (result) {
      expect(result.position).toBe(25);
      expect(result.error).toBe(
        "3/4 scraped pages failed; unable to determine a reliable position"
      );
    }
  });
});
