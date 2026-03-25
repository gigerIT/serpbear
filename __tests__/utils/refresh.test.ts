jest.mock("../..//database/models/keyword", () => ({}));

const mockState = {
  scrapeKeywordWithStrategy: jest.fn(),
  retryScrape: jest.fn(),
  removeFromRetryQueue: jest.fn(),
};

jest.mock("../../utils/scraper", () => ({
  scrapeKeywordWithStrategy: (...args: any[]) =>
    mockState.scrapeKeywordWithStrategy.apply(null, args),
  retryScrape: (...args: any[]) => mockState.retryScrape.apply(null, args),
  removeFromRetryQueue: (...args: any[]) =>
    mockState.removeFromRetryQueue.apply(null, args),
}));

import refreshAndUpdateKeywords from "../../utils/refresh";

describe("refresh hardening", () => {
  const settings = {
    scraper_type: "serpapi",
    scrape_retry: true,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears updating state when sequential scraping returns no data", async () => {
    const keywordModel = {
      ID: 11,
      get: jest.fn().mockReturnValue({
        ID: 11,
        keyword: "missing keyword",
        domain: "example.com",
        device: "desktop",
        country: "US",
        lastUpdated: "",
        added: "",
        position: 0,
        volume: 0,
        sticky: false,
        history: "{}",
        lastResult: "[]",
        url: "",
        tags: "[]",
        updating: true,
        lastUpdateError: "false",
      }),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockState.scrapeKeywordWithStrategy.mockResolvedValue(false);

    const result = await refreshAndUpdateKeywords([keywordModel], {
      ...settings,
      scraper_type: "other",
    } as any);

    expect(keywordModel.update).toHaveBeenCalledWith(
      expect.objectContaining({ updating: false })
    );
    expect(mockState.retryScrape).toHaveBeenCalledWith(11);
    expect(result[0].updating).toBe(false);
    expect(result[0].lastUpdateError).toEqual(
      expect.objectContaining({ error: "Scraper returned no data" })
    );
  });

  it("clears updating state when a parallel scrape rejects", async () => {
    const keywordA = {
      ID: 21,
      get: jest.fn().mockReturnValue({
        ID: 21,
        keyword: "first",
        domain: "a.com",
        device: "desktop",
        country: "US",
        lastUpdated: "",
        added: "",
        position: 0,
        volume: 0,
        sticky: false,
        history: "{}",
        lastResult: "[]",
        url: "",
        tags: "[]",
        updating: true,
        lastUpdateError: "false",
      }),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const keywordB = {
      ID: 22,
      get: jest.fn().mockReturnValue({
        ID: 22,
        keyword: "second",
        domain: "b.com",
        device: "desktop",
        country: "US",
        lastUpdated: "",
        added: "",
        position: 0,
        volume: 0,
        sticky: false,
        history: "{}",
        lastResult: "[]",
        url: "",
        tags: "[]",
        updating: true,
        lastUpdateError: "false",
      }),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockState.scrapeKeywordWithStrategy
      .mockResolvedValueOnce({
        ID: 21,
        keyword: "first",
        position: 1,
        url: "https://a.com",
        result: [],
        error: false,
      })
      .mockRejectedValueOnce(new Error("network boom"));

    const results = await refreshAndUpdateKeywords(
      [keywordA, keywordB],
      settings
    );

    expect(keywordB.update).toHaveBeenCalledWith(
      expect.objectContaining({ updating: false })
    );
    expect(mockState.retryScrape).toHaveBeenCalledWith(22);
    expect(results).toHaveLength(2);
    expect(results[1].updating).toBe(false);
    expect(results[1].lastUpdateError).toEqual(
      expect.objectContaining({ error: "Parallel scrape returned no data" })
    );
  });
});
