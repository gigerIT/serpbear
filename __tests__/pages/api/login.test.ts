import type { NextApiRequest, NextApiResponse } from "next";

const mockState = {
  sign: jest.fn(() => "signed-token"),
  cookieSet: jest.fn(),
};

jest.mock("jsonwebtoken", () => ({
  sign: (...args: any[]) => (mockState.sign as any)(...args),
}));

jest.mock("cookies", () =>
  jest.fn().mockImplementation(() => ({
    set: mockState.cookieSet,
  }))
);

const handler = require("../../../pages/api/login").default;

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

describe("/api/login", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      USER: "admin",
      PASSWORD: "super-secret",
      SECRET: "jwt-secret",
      SESSION_DURATION: "2",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("sets an expiring secure session cookie when credentials are valid", async () => {
    const req = {
      method: "POST",
      body: {
        username: "admin",
        password: "super-secret",
      },
      headers: {
        host: "internal:3000",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "serp.example.com",
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.sign).toHaveBeenCalledWith(
      { user: "admin" },
      "jwt-secret",
      { expiresIn: "2h" }
    );
    expect(mockState.cookieSet).toHaveBeenCalledWith(
      "token",
      "signed-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 7200000,
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, error: null });
  });
});
