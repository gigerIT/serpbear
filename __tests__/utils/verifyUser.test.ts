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
});
