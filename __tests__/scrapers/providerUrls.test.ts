import scrapingrobot from "../../scrapers/services/scrapingrobot";
import serpapi from "../../scrapers/services/serpapi";
import valueserp from "../../scrapers/services/valueserp";
import searchapi from "../../scrapers/services/searchapi";

describe("scraper provider urls", () => {
  const countries = {
    US: ["United States", "Washington", "en", 2840],
    GB: ["United Kingdom", "London", "en", 2826],
  } as any;

  it("encodes ScrapingRobot google urls and forwards proxyCountry", () => {
    const url = scrapingrobot.scrapeURL!(
      {
        keyword: "coffee shops",
        country: "US",
        device: "mobile",
      } as any,
      { scraping_api: "token-123" } as any,
      countries,
      { start: 10, num: 10, page: 2 }
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("token")).toBe("token-123");
    expect(parsed.searchParams.get("proxyCountry")).toBe("US");
    expect(parsed.searchParams.get("mobile")).toBe("true");

    const googleURL = new URL(parsed.searchParams.get("url") || "");
    expect(googleURL.searchParams.get("q")).toBe("coffee shops");
    expect(googleURL.searchParams.get("start")).toBe("10");
  });

  it("builds SerpApi search.json urls with engine and api key", () => {
    const url = serpapi.scrapeURL!(
      {
        keyword: "pizza near me",
        country: "US",
        city: "Austin",
        device: "mobile",
      } as any,
      { scraping_api: "serp-key" } as any,
      countries
    );

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/search.json");
    expect(parsed.searchParams.get("engine")).toBe("google");
    expect(parsed.searchParams.get("api_key")).toBe("serp-key");
    expect(parsed.searchParams.get("device")).toBe("mobile");
    expect(parsed.searchParams.get("location")).toBe("Austin,United States");
  });

  it("builds ValueSerp urls without legacy num=100 assumptions", () => {
    const url = valueserp.scrapeURL!(
      {
        keyword: "best dentist",
        country: "US",
        city: "Boston",
        device: "desktop",
      } as any,
      { scraping_api: "value-key" } as any,
      countries,
      { start: 0, num: 10, page: 3 }
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("api_key")).toBe("value-key");
    expect(parsed.searchParams.get("page")).toBe("3");
    expect(parsed.searchParams.get("output")).toBe("json");
    expect(parsed.searchParams.get("location")).toBe("Boston,United States");
    expect(parsed.searchParams.get("num")).toBeNull();
  });

  it("builds SearchApi urls with hl and query api key", () => {
    const url = searchapi.scrapeURL!(
      {
        keyword: "plumber london",
        country: "GB",
        city: "London",
        device: "desktop",
      } as any,
      { scraping_api: "search-key" } as any,
      countries
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("api_key")).toBe("search-key");
    expect(parsed.searchParams.get("engine")).toBe("google");
    expect(parsed.searchParams.get("hl")).toBe("en");
    expect(parsed.searchParams.get("location")).toBe("London,United Kingdom");
  });
});
