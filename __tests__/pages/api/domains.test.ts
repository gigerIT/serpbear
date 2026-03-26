import type { NextApiRequest, NextApiResponse } from "next";

const mockState = {
  sync: jest.fn(),
  verifyUser: jest.fn(() => "authorized"),
  findOne: jest.fn(),
  checkSearchConsole: jest.fn(),
  encrypt: jest.fn((value: string) => `encrypted-${value}`),
  decrypt: jest.fn((value: string) => `decrypted-${value}`),
  save: jest.fn(),
};

jest.mock("../../../database/database", () => ({
  __esModule: true,
  default: { sync: (...args: any[]) => mockState.sync.apply(null, args) },
}));

jest.mock("../../../utils/verifyUser", () => ({
  __esModule: true,
  default: (...args: any[]) => mockState.verifyUser.apply(null, args),
}));

jest.mock("../../../database/models/domain", () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => mockState.findOne.apply(null, args),
  },
}));

jest.mock("../../../database/models/keyword", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../../../utils/searchConsole", () => ({
  checkSerchConsoleIntegration: (...args: any[]) =>
    mockState.checkSearchConsole.apply(null, args),
  removeLocalSCData: jest.fn(),
}));

jest.mock("../../../utils/scraper", () => ({
  removeFromRetryQueue: jest.fn(),
}));

jest.mock("cryptr", () =>
  jest.fn().mockImplementation(() => ({
    encrypt: (...args: any[]) => mockState.encrypt.apply(null, args),
    decrypt: (...args: any[]) => mockState.decrypt.apply(null, args),
  }))
);

const handler = require("../../../pages/api/domains").default;

type MockResponse = {
  statusCode: number;
  body: Record<string, any> | undefined;
  status: (code: number) => MockResponse;
  json: (payload: Record<string, any>) => MockResponse;
};

const createResponse = (): MockResponse => ({
  statusCode: 200,
  body: undefined,
  status(code: number) {
    this.statusCode = code;
    return this;
  },
  json(payload: Record<string, any>) {
    this.body = payload;
    return this;
  },
});

describe("/api/domains", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SECRET = "test-secret";
    mockState.checkSearchConsole.mockResolvedValue({ isValid: true });
    mockState.save.mockResolvedValue(undefined);
  });

  it("persists per-domain scraper overrides and masks the response", async () => {
    const domainModel = {
      get: jest.fn().mockImplementation((key?: string) => {
        if (key === "scraper_settings") {
          return JSON.stringify({
            scraper_type: "serpapi",
            scraping_api: "existing-key",
          });
        }

        return {
          ID: 1,
          domain: "example.com",
          slug: "example-com",
          notification: true,
          notification_interval: "daily",
          notification_emails: "",
          lastUpdated: "",
          added: "",
          search_console: JSON.stringify({}),
          scraper_settings: JSON.stringify({
            scraper_type: "serpapi",
            scraping_api: "encrypted-new-key",
          }),
        };
      }),
      set: jest.fn(),
      save: (...args: any[]) => mockState.save.apply(null, args),
    };
    mockState.findOne.mockResolvedValue(domainModel);

    const req = {
      method: "PUT",
      query: { domain: "example.com" },
      body: {
        notification_interval: "daily",
        notification_emails: "",
        search_console: {},
        scraper_settings: {
          scraper_type: "serpapi",
          scraping_api: "new-key",
        },
        scrape_strategy: "",
        scrape_pagination_limit: 0,
        scrape_smart_full_fallback: false,
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(domainModel.set).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_settings: JSON.stringify({
          scraper_type: "serpapi",
          scraping_api: "encrypted-new-key",
        }),
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      domain: {
        scraper_settings: {
          scraper_type: "serpapi",
          has_api_key: true,
        },
      },
    });
  });

  it("clears per-domain scraper overrides when switching back to global", async () => {
    const domainModel = {
      get: jest.fn().mockImplementation((key?: string) => {
        if (key === "scraper_settings") {
          return JSON.stringify({
            scraper_type: "serpapi",
            scraping_api: "existing-key",
          });
        }

        return {
          ID: 1,
          domain: "example.com",
          slug: "example-com",
          notification: true,
          notification_interval: "daily",
          notification_emails: "",
          lastUpdated: "",
          added: "",
          search_console: JSON.stringify({}),
          scraper_settings: null,
        };
      }),
      set: jest.fn(),
      save: (...args: any[]) => mockState.save.apply(null, args),
    };
    mockState.findOne.mockResolvedValue(domainModel);

    const req = {
      method: "PUT",
      query: { domain: "example.com" },
      body: {
        notification_interval: "daily",
        notification_emails: "",
        search_console: {},
        scraper_settings: null,
        scrape_strategy: "",
        scrape_pagination_limit: 0,
        scrape_smart_full_fallback: false,
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(domainModel.set).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_settings: null,
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      domain: {
        scraper_settings: null,
      },
    });
  });
});
