import getServerAppURL from "../../utils/getServerAppURL";

describe("getServerAppURL", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers APP_URL and trims trailing slashes", () => {
    process.env.APP_URL = "https://app.example.com///";
    process.env.NEXT_PUBLIC_APP_URL = "https://public.example.com";

    expect(getServerAppURL()).toBe("https://app.example.com");
  });

  it("falls back to NEXT_PUBLIC_APP_URL when APP_URL is missing", () => {
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://public.example.com/";

    expect(getServerAppURL()).toBe("https://public.example.com");
  });

  it("returns an empty string when no server app URL is configured", () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getServerAppURL()).toBe("");
  });
});
