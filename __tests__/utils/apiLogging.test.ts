import type { NextApiRequest, NextApiResponse } from "next";
import { withApiLogging } from "../../utils/apiLogging";

jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

type MockResponse = {
  statusCode: number;
  headersSent?: boolean;
  setHeader: jest.Mock;
  status: (code: number) => MockResponse;
  json: (payload: Record<string, unknown>) => MockResponse;
};

const createResponse = (): MockResponse => ({
  statusCode: 200,
  headersSent: false,
  setHeader: jest.fn(),
  status(code: number) {
    this.statusCode = code;
    return this;
  },
  json() {
    this.headersSent = true;
    return this;
  },
});

describe("withApiLogging", () => {
  it("adds an X-Request-Id header and preserves handler responses", async () => {
    const wrapped = withApiLogging(
      async (_req, res) => {
        res.status(204).json({ ok: true });
      },
      { name: "test" }
    );

    const req = {
      method: "GET",
      url: "/api/test",
    } as NextApiRequest;
    const res = createResponse();

    await wrapped(req, res as unknown as NextApiResponse);

    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      expect.any(String)
    );
    expect(res.statusCode).toBe(204);
  });

  it("returns a 500 response when the wrapped handler throws", async () => {
    const wrapped = withApiLogging(async () => {
      throw new Error("boom");
    });

    const req = {
      method: "GET",
      url: "/api/test",
    } as NextApiRequest;
    const res = createResponse();

    await wrapped(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(500);
  });
});
