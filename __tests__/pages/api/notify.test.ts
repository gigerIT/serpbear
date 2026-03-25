import type { NextApiRequest, NextApiResponse } from "next";

const mockState = {
  sync: jest.fn(),
  verifyUser: jest.fn((req: NextApiRequest) => {
    if (req.headers.authorization === "Bearer test-api-key") {
      return "authorized";
    }

    if (req.headers["x-test-auth"] === "session") {
      return "authorized";
    }

    return "Not authorized";
  }),
  getAppSettings: jest.fn(),
  findAllDomains: jest.fn(),
};

jest.mock("../../../database/database", () => ({
  __esModule: true,
  default: {
    sync: mockState.sync,
  },
}));

jest.mock("../../../utils/verifyUser", () => ({
  __esModule: true,
  default: (req: NextApiRequest) => mockState.verifyUser(req),
}));

jest.mock("../../../pages/api/settings", () => ({
  getAppSettings: mockState.getAppSettings,
}));

jest.mock("../../../database/models/domain", () => ({
  __esModule: true,
  default: {
    findAll: mockState.findAllDomains,
  },
}));

jest.mock("../../../database/models/keyword", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
  },
}));

jest.mock("../../../utils/generateEmail", () => jest.fn());
jest.mock("../../../utils/parseKeywords", () => jest.fn(() => []));
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue(undefined),
  })),
}));

const handler = require("../../../pages/api/notify").default;

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

describe("/api/notify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.sync.mockResolvedValue(undefined);
    mockState.getAppSettings.mockResolvedValue({
      smtp_server: "smtp.example.com",
      smtp_port: "587",
      notification_email: "alerts@example.com",
    });
    mockState.findAllDomains.mockResolvedValue([]);
  });

  it("rejects unauthenticated requests before loading settings", async () => {
    const req = {
      method: "POST",
      headers: {},
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Not authorized" });
    expect(mockState.sync).not.toHaveBeenCalled();
    expect(mockState.getAppSettings).not.toHaveBeenCalled();
  });

  it("allows API-key authorized requests", async () => {
    const req = {
      method: "POST",
      headers: {
        authorization: "Bearer test-api-key",
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, error: null });
    expect(mockState.sync).toHaveBeenCalled();
    expect(mockState.getAppSettings).toHaveBeenCalled();
  });

  it("allows session-authorized requests", async () => {
    const req = {
      method: "POST",
      headers: {
        "x-test-auth": "session",
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, error: null });
    expect(mockState.sync).toHaveBeenCalled();
    expect(mockState.getAppSettings).toHaveBeenCalled();
  });
});
