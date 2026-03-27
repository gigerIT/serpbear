import type { NextApiRequest, NextApiResponse } from "next";

const mockState = {
  sync: jest.fn(),
  verifyUser: jest.fn(() => "authorized"),
  findOne: jest.fn(),
  decrypt: jest.fn((value: string) => `decrypted-${value}`),
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

jest.mock("cryptr", () =>
  jest.fn().mockImplementation(() => ({
    decrypt: (...args: any[]) => mockState.decrypt.apply(null, args),
  }))
);

const handler = require("../../../pages/api/domain").default;

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

describe("/api/domain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SECRET = "test-secret";
  });

  it("returns masked per-domain scraper settings", async () => {
    mockState.findOne.mockResolvedValue({
      get: () => ({
        ID: 1,
        domain: "example.com",
        slug: "example-com",
        notification: true,
        notification_interval: "daily",
        notification_emails: "",
        lastUpdated: "",
        added: "",
        subdomain_matching: "blog,*",
        search_console: JSON.stringify({
          client_email: "enc-email",
          private_key: "enc-key",
        }),
        scraper_settings: JSON.stringify({
          scraper_type: "serpapi",
          scraping_api: "enc-scraper-key",
        }),
      }),
    });

    const req = {
      method: "GET",
      query: { domain: "example.com" },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      domain: {
        scraper_settings: {
          scraper_type: "serpapi",
          has_api_key: true,
        },
        subdomain_matching: "blog,*",
      },
    });
  });
});
