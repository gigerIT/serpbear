import jwt from "jsonwebtoken";

const mockState = {
  getToken: jest.fn(),
};

jest.mock("cookies", () =>
  jest.fn().mockImplementation(() => ({
    get: (name: string) => mockState.getToken(name),
  }))
);

const verifyUser = require("../../utils/verifyUser").default;

describe("verifyUser", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SECRET: "jwt-secret",
      APIKEY: "test-api-key",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects expired JWT session cookies", () => {
    const expiredToken = jwt.sign({ user: "admin" }, "jwt-secret", {
      expiresIn: -1,
    });
    mockState.getToken.mockReturnValue(expiredToken);

    const result = verifyUser(
      {
        headers: {},
        method: "GET",
        url: "/api/domains",
      },
      {}
    );

    expect(result).toBe("Not authorized");
  });

  it("accepts API key auth only for allowed routes with a Bearer token", () => {
    mockState.getToken.mockReturnValue(undefined);

    const result = verifyUser(
      {
        headers: {
          authorization: "Bearer test-api-key",
        },
        method: "POST",
        url: "/api/refresh?id=all&domain=example.com",
      },
      {}
    );

    expect(result).toBe("authorized");
  });

  it("rejects malformed API key auth headers", () => {
    mockState.getToken.mockReturnValue(undefined);

    const result = verifyUser(
      {
        headers: {
          authorization: "test-api-key",
        },
        method: "POST",
        url: "/api/refresh",
      },
      {}
    );

    expect(result).toBe("Invalid API Key Provided.");
  });

  it("falls back to API key auth when the JWT cookie is invalid", () => {
    mockState.getToken.mockReturnValue("invalid-token");

    const result = verifyUser(
      {
        headers: {
          authorization: "Bearer test-api-key",
        },
        method: "POST",
        url: "/api/cron?manual=true",
      },
      {}
    );

    expect(result).toBe("authorized");
  });
});
