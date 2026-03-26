import type { NextApiRequest, NextApiResponse } from "next";
import packageJson from "../../../package.json";

const mockState = {
  readFile: jest.fn(),
  atomicWriteFile: jest.fn(),
  clearAdwordsAccessTokenCache: jest.fn(),
  retryQueueGetQueue: jest.fn(),
  retryQueueClearQueue: jest.fn(),
  decrypt: jest.fn((value: string) => {
    if (value === "enc-old-id") {
      return "old-id";
    }
    if (value === "enc-old-secret") {
      return "old-secret";
    }
    return `decrypted-${value}`;
  }),
  encrypt: jest.fn((value: string) => `encrypted-${value}`),
};

jest.mock("fs/promises", () => ({
  readFile: mockState.readFile,
}));

jest.mock("../../../utils/atomicWrite", () => ({
  atomicWriteFile: (...args: any[]) =>
    mockState.atomicWriteFile.apply(null, args),
}));

jest.mock("cryptr", () =>
  jest.fn().mockImplementation(() => ({
    decrypt: mockState.decrypt,
    encrypt: mockState.encrypt,
  }))
);

jest.mock("../../..//scrapers/index", () => []);

jest.mock("../../../utils/verifyUser", () => ({
  __esModule: true,
  default: jest.fn(() => "authorized"),
}));

jest.mock("../../../utils/adwords", () => ({
  clearAdwordsAccessTokenCache: mockState.clearAdwordsAccessTokenCache,
}));

jest.mock("../../../utils/retryQueueManager", () => ({
  retryQueueManager: {
    getQueue: (...args: any[]) =>
      mockState.retryQueueGetQueue.apply(null, args),
    clearQueue: (...args: any[]) =>
      mockState.retryQueueClearQueue.apply(null, args),
  },
}));

jest.mock("../../../utils/apiLogging", () => ({
  withApiLogging: (handler: any) => handler,
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const handler = require("../../../pages/api/settings").default;

type MockResponse = {
  statusCode: number;
  body: Record<string, any> | undefined;
  status: (code: number) => MockResponse;
  json: (payload: Record<string, any>) => MockResponse;
};

const createResponse = () => {
  const res: MockResponse = {
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
  };

  return res;
};

describe("/api/settings", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockState.readFile.mockReset();
    mockState.atomicWriteFile.mockReset();
    mockState.retryQueueGetQueue.mockReset();
    mockState.retryQueueClearQueue.mockReset();
    mockState.clearAdwordsAccessTokenCache.mockReset();
    mockState.decrypt.mockReset();
    mockState.encrypt.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.SECRET = "test-secret";
    mockState.decrypt.mockImplementation((value: string) => {
      if (value === "enc-old-id") {
        return "old-id";
      }
      if (value === "enc-old-secret") {
        return "old-secret";
      }
      return `decrypted-${value}`;
    });
    mockState.encrypt.mockImplementation(
      (value: string) => `encrypted-${value}`
    );
    mockState.readFile.mockResolvedValue(
      JSON.stringify({
        adwords_client_id: "enc-old-id",
        adwords_client_secret: "enc-old-secret",
        adwords_refresh_token: "enc-refresh-token",
      })
    );
    mockState.atomicWriteFile.mockResolvedValue(undefined);
    mockState.retryQueueGetQueue.mockResolvedValue([]);
    mockState.retryQueueClearQueue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns the app version from package.json on GET", async () => {
    const req = {
      method: "GET",
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      settings: { version: packageJson.version },
    });
  });

  it("returns a decrypted scraping_api value on GET when the stored field uses the legacy key", async () => {
    mockState.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          scaping_api: "enc-scraper-key",
        })
      )
      .mockResolvedValueOnce(JSON.stringify([]));

    const req = {
      method: "GET",
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      settings: {
        scaping_api: "decrypted-enc-scraper-key",
        scraping_api: "decrypted-enc-scraper-key",
      },
    });
  });

  it("preserves the refresh token when Google Ads client credentials do not change", async () => {
    const req = {
      method: "PUT",
      body: {
        settings: {
          adwords_client_id: "old-id",
          adwords_client_secret: "old-secret",
        },
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    const writePayload = JSON.parse(mockState.atomicWriteFile.mock.calls[0][1]);
    expect(writePayload.adwords_refresh_token).toBe("enc-refresh-token");
    expect(mockState.clearAdwordsAccessTokenCache).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("clears the refresh token when Google Ads client credentials change", async () => {
    const req = {
      method: "PUT",
      body: {
        settings: {
          adwords_client_id: "new-id",
          adwords_client_secret: "old-secret",
        },
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    const writePayload = JSON.parse(mockState.atomicWriteFile.mock.calls[0][1]);
    expect(writePayload.adwords_refresh_token).toBe("");
    expect(mockState.clearAdwordsAccessTokenCache).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("accepts scraping_api input and persists both scraper api key fields", async () => {
    const req = {
      method: "PUT",
      body: {
        settings: {
          scraping_api: "new-scraper-key",
        },
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    const writePayload = JSON.parse(mockState.atomicWriteFile.mock.calls[0][1]);
    expect(writePayload.scaping_api).toBe("encrypted-new-scraper-key");
    expect(writePayload.scraping_api).toBe("encrypted-new-scraper-key");
    expect(res.statusCode).toBe(200);
  });

  it("prefers the changed scraper api key when legacy and canonical fields disagree", async () => {
    mockState.readFile.mockResolvedValueOnce(
      JSON.stringify({
        scraping_api: "encrypted-old-scraper-key",
      })
    );
    mockState.decrypt.mockImplementation((value: string) => {
      if (value === "encrypted-old-scraper-key") {
        return "old-scraper-key";
      }
      if (value === "enc-old-id") {
        return "old-id";
      }
      if (value === "enc-old-secret") {
        return "old-secret";
      }
      return `decrypted-${value}`;
    });

    const req = {
      method: "PUT",
      body: {
        settings: {
          scraping_api: "old-scraper-key",
          scaping_api: "new-scraper-key",
        },
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    const writePayload = JSON.parse(mockState.atomicWriteFile.mock.calls[0][1]);
    expect(writePayload.scaping_api).toBe("encrypted-new-scraper-key");
    expect(writePayload.scraping_api).toBe("encrypted-new-scraper-key");
    expect(res.statusCode).toBe(200);
  });

  it("returns 400 when settings payload is missing on PUT", async () => {
    const req = {
      method: "PUT",
      body: {},
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Settings Data not Provided!" });
  });

  it("returns 500 when SECRET is missing on PUT", async () => {
    delete process.env.SECRET;

    const req = {
      method: "PUT",
      body: {
        settings: {
          scraping_api: "new-scraper-key",
        },
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Server configuration error" });
  });

  it("falls back safely when settings json is malformed", async () => {
    mockState.readFile.mockResolvedValueOnce("not-json");

    const req = {
      method: "GET",
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      settings: {
        scraper_type: "none",
        failed_queue: [],
      },
    });
  });

  it("bootstraps defaults when settings file is missing", async () => {
    mockState.readFile.mockRejectedValue({ code: "ENOENT" });

    const req = {
      method: "GET",
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.atomicWriteFile).toHaveBeenCalled();
    expect(mockState.retryQueueClearQueue).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("returns settings even when reading the failed queue fails", async () => {
    mockState.retryQueueGetQueue.mockRejectedValue(new Error("queue boom"));

    const req = {
      method: "GET",
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      settings: {
        failed_queue: [],
      },
    });
  });
});
