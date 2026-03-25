import type { NextApiRequest, NextApiResponse } from "next";

const mockState = {
  sync: jest.fn(),
  verifyUser: jest.fn(() => "authorized"),
  getAppSettings: jest.fn(),
  keywordUpdate: jest.fn(),
  keywordFindAll: jest.fn(),
  domainFindAll: jest.fn(),
  refreshAndUpdateKeywords: jest.fn(),
  scrapeKeywordFromGoogle: jest.fn(),
  parseKeywords: jest.fn(),
};

jest.mock("../../../database/database", () => ({
  __esModule: true,
  default: {
    sync: mockState.sync,
  },
}));

jest.mock("sequelize", () => ({
  Op: {
    in: Symbol.for("sequelize.op.in"),
  },
}));

jest.mock("../../../utils/verifyUser", () => ({
  __esModule: true,
  default: (...args: any[]) => mockState.verifyUser.apply(null, args),
}));

jest.mock("../../../pages/api/settings", () => ({
  getAppSettings: (...args: any[]) =>
    mockState.getAppSettings.apply(null, args),
}));

jest.mock("../../../database/models/keyword", () => ({
  __esModule: true,
  default: {
    update: (...args: any[]) => mockState.keywordUpdate.apply(null, args),
    findAll: (...args: any[]) => mockState.keywordFindAll.apply(null, args),
  },
}));

jest.mock("../../../database/models/domain", () => ({
  __esModule: true,
  default: {
    findAll: (...args: any[]) => mockState.domainFindAll.apply(null, args),
  },
}));

jest.mock("../../../utils/refresh", () => ({
  __esModule: true,
  default: (...args: any[]) =>
    mockState.refreshAndUpdateKeywords.apply(null, args),
}));

jest.mock("../../../utils/scraper", () => ({
  scrapeKeywordFromGoogle: (...args: any[]) =>
    mockState.scrapeKeywordFromGoogle.apply(null, args),
}));

jest.mock("../../../utils/parseKeywords", () => ({
  __esModule: true,
  default: (...args: any[]) => mockState.parseKeywords.apply(null, args),
}));

const handler = require("../../../pages/api/refresh").default;

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

describe("/api/refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.sync.mockResolvedValue(undefined);
    mockState.getAppSettings.mockResolvedValue({
      scraper_type: "scrapingrobot",
    });
    mockState.keywordUpdate.mockResolvedValue([1]);
    mockState.domainFindAll.mockResolvedValue([
      { get: () => ({ domain: "example.com" }) },
    ]);
    mockState.parseKeywords.mockImplementation(
      (keywords: Array<{ ID: number; keyword: string }>) => keywords
    );
    mockState.refreshAndUpdateKeywords.mockResolvedValue([
      {
        ID: 6,
        keyword: "fahren mittelmeer",
        updating: false,
        lastUpdateError: false,
      },
    ]);
  });

  it("starts a single keyword refresh asynchronously with stale errors cleared", async () => {
    const keywordModel = {
      get: () => ({
        ID: 6,
        keyword: "fahren mittelmeer",
        updating: true,
        lastUpdateError: false,
      }),
    };
    mockState.keywordFindAll.mockResolvedValue([keywordModel]);

    const req = {
      method: "POST",
      query: { id: "6" },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.keywordUpdate).toHaveBeenCalledWith(
      { updating: true, lastUpdateError: "false" },
      expect.any(Object)
    );
    expect(mockState.refreshAndUpdateKeywords).toHaveBeenCalledWith(
      [keywordModel],
      { scraper_type: "scrapingrobot" },
      [{ domain: "example.com" }]
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      keywords: [
        {
          ID: 6,
          keyword: "fahren mittelmeer",
          updating: true,
          lastUpdateError: false,
        },
      ],
    });
  });

  it("keeps batch refreshes asynchronous", async () => {
    const keywordModelA = {
      get: () => ({
        ID: 6,
        keyword: "first keyword",
        updating: true,
        lastUpdateError: false,
      }),
    };
    const keywordModelB = {
      get: () => ({
        ID: 7,
        keyword: "second keyword",
        updating: true,
        lastUpdateError: false,
      }),
    };
    mockState.keywordFindAll.mockResolvedValue([keywordModelA, keywordModelB]);

    const req = {
      method: "POST",
      query: { id: "6,7" },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.refreshAndUpdateKeywords).toHaveBeenCalledWith(
      [keywordModelA, keywordModelB],
      { scraper_type: "scrapingrobot" },
      [{ domain: "example.com" }]
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      keywords: [
        {
          ID: 6,
          keyword: "first keyword",
          updating: true,
          lastUpdateError: false,
        },
        {
          ID: 7,
          keyword: "second keyword",
          updating: true,
          lastUpdateError: false,
        },
      ],
    });
  });
});
