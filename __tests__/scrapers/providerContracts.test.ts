import scrapingant from "../../scrapers/services/scrapingant";
import serpapi from "../../scrapers/services/serpapi";
import searchapi from "../../scrapers/services/searchapi";
import hasdata from "../../scrapers/services/hasdata";
import serply from "../../scrapers/services/serply";
import crazyserp from "../../scrapers/services/crazyserp";

describe("scraper provider contracts", () => {
  const countries = {
    US: ["United States", "Washington", "en", 2840],
  } as any;

  it("uses scraping_api fallback across authenticated headers", () => {
    expect(
      serpapi.headers!(
        { device: "desktop" } as any,
        {
          scaping_api: "legacy-key",
        } as any
      )
    ).toMatchObject({ "X-API-Key": "legacy-key" });

    expect(
      searchapi.headers!(
        { device: "desktop" } as any,
        {
          scaping_api: "legacy-key",
        } as any
      )
    ).toMatchObject({ Authorization: "Bearer legacy-key" });

    expect(
      hasdata.headers!(
        { device: "desktop" } as any,
        {
          scaping_api: "legacy-key",
        } as any
      )
    ).toMatchObject({ "x-api-key": "legacy-key" });

    expect(
      crazyserp.headers!(
        { device: "desktop" } as any,
        {
          scaping_api: "legacy-key",
        } as any
      )
    ).toMatchObject({ Authorization: "Bearer legacy-key" });
  });

  it("uses safe defaults for providers that depend on optional country", () => {
    const serplyHeaders = serply.headers!(
      { device: "mobile" } as any,
      { scraping_api: "serply-key" } as any
    );
    expect(serplyHeaders).toMatchObject({
      "X-Api-Key": "serply-key",
      "X-Proxy-Location": "US",
      "X-User-Agent": "mobile",
    });

    const scrapingAntUrl = scrapingant.scrapeURL!(
      { keyword: "pizza", device: "desktop" } as any,
      { scraping_api: "ant-key" } as any,
      countries,
      { start: 0, num: 10, page: 1 }
    );
    const parsed = new URL(scrapingAntUrl);
    expect(parsed.searchParams.get("x-api-key")).toBe("ant-key");
    expect(parsed.searchParams.get("proxy_country")).toBe("US");
  });

  it("filters incomplete extractor results instead of returning malformed items", () => {
    expect(
      serpapi.serpExtractor!({
        organic_results: [
          { title: "valid", link: "https://valid.com", position: 1 },
          { title: "missing link", position: 2 },
          { link: "https://missing-title.com", position: 3 },
        ],
      } as any)
    ).toEqual([{ title: "valid", url: "https://valid.com", position: 1 }]);

    expect(
      serply.serpExtractor!({
        result: [
          { title: "valid", link: "https://valid.com", realPosition: 4 },
          { title: "missing link", realPosition: 5 },
        ],
      } as any)
    ).toEqual([{ title: "valid", url: "https://valid.com", position: 4 }]);
  });
});
