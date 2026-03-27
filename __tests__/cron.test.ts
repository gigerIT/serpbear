const mockState = {
  cronHandlers: [] as Array<() => Promise<unknown> | unknown>,
  readFile: jest.fn(),
  writeFile: jest.fn(),
  rename: jest.fn(),
  mkdir: jest.fn(),
};

jest.mock("fs", () => ({
  promises: {
    readFile: (...args: any[]) => mockState.readFile.apply(null, args),
    writeFile: (...args: any[]) => mockState.writeFile.apply(null, args),
    rename: (...args: any[]) => mockState.rename.apply(null, args),
    mkdir: (...args: any[]) => mockState.mkdir.apply(null, args),
  },
}));

jest.mock("cryptr", () =>
  jest.fn().mockImplementation(() => ({
    decrypt: (value: string) => `decrypted-${value}`,
  }))
);

jest.mock("croner", () => ({
  Cron: jest
    .fn()
    .mockImplementation(
      (_schedule: string, handler: () => Promise<unknown> | unknown) => {
        mockState.cronHandlers.push(handler);
        return {};
      }
    ),
}));

describe("cron worker", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockState.cronHandlers = [];
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env = {
      ...originalEnv,
      APIKEY: "cron-key",
      NEXT_PUBLIC_APP_URL: "https://public.example.com:5000",
      PORT: "3000",
    };
    delete process.env.SEARCH_CONSOLE_PRIVATE_KEY;
    delete process.env.SEARCH_CONSOLE_CLIENT_EMAIL;
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);
    mockState.readFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("settings.json")) {
        return Promise.resolve(
          JSON.stringify({
            scrape_interval: "daily",
            notification_interval: "daily",
          })
        );
      }

      if (filePath.endsWith("failed_queue.json")) {
        return Promise.resolve(JSON.stringify([1, 2]));
      }

      return Promise.reject(new Error(`Unexpected file read: ${filePath}`));
    });
    mockState.writeFile.mockResolvedValue(undefined);
    mockState.rename.mockResolvedValue(undefined);
    mockState.mkdir.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("backs up and restores corrupt settings instead of silently resetting", async () => {
    mockState.readFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("settings.json")) {
        return Promise.resolve("not-json");
      }

      return Promise.resolve(JSON.stringify([]));
    });

    const { getAppSettings } = require("../cron");

    const settings = await getAppSettings();

    expect(settings).toMatchObject({
      scraper_type: "none",
      notification_interval: "never",
    });
    expect(mockState.rename).toHaveBeenCalledWith(
      expect.stringContaining("data/settings.json"),
      expect.stringMatching(/data\/settings\.json\.\d+\.corrupt$/)
    );
    const settingsWriteCall = mockState.writeFile.mock.calls.find(
      ([filePath]: [string]) => filePath.includes("data/settings.json")
    );
    expect(settingsWriteCall).toBeDefined();
    expect(JSON.parse(settingsWriteCall?.[1] || "{}")).toMatchObject({
      scraper_type: settings.scraper_type,
      notification_interval: settings.notification_interval,
    });
    expect(settingsWriteCall?.[2]).toEqual({ encoding: "utf-8" });
  });

  it("uses the internal app URL for cron API calls", async () => {
    const { runAppCronJobs } = require("../cron");

    runAppCronJobs();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockState.cronHandlers).toHaveLength(3);

    for (const handler of mockState.cronHandlers) {
      await handler();
    }

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/cron",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer cron-key" },
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/notify",
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/refresh?id=1,2",
      expect.any(Object)
    );
    const calledURLs = (global.fetch as jest.Mock).mock.calls.map(
      ([url]: [string]) => url
    );
    expect(
      calledURLs.some((url) => url.includes("public.example.com:5000"))
    ).toBe(false);
  });
});
