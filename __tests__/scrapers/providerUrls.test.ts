import scrapingrobot from "../../scrapers/services/scrapingrobot";
import serpapi from "../../scrapers/services/serpapi";
import valueserp from "../../scrapers/services/valueserp";
import searchapi from "../../scrapers/services/searchapi";
import serper from "../../scrapers/services/serper";
import hasdata from "../../scrapers/services/hasdata";
import serply from "../../scrapers/services/serply";
import spaceserp from "../../scrapers/services/spaceserp";
import crazyserp from "../../scrapers/services/crazyserp";

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

  it("builds Serper urls with page and apiKey params", () => {
    const url = serper.scrapeURL!(
      {
        keyword: "roof repair",
        country: "US",
        city: "Chicago",
        device: "desktop",
      } as any,
      { scraping_api: "serper-key" } as any,
      countries,
      { start: 10, num: 10, page: 2 }
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("apiKey")).toBe("serper-key");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("location")).toBe("Chicago,United States");
  });

  it("builds HasData urls against api.hasdata.com", () => {
    const url = hasdata.scrapeURL!(
      {
        keyword: "garage door repair",
        country: "US",
        city: "Denver",
        device: "mobile",
      } as any,
      { scraping_api: "hasdata-key" } as any,
      countries,
      { start: 20, num: 10, page: 3 }
    );

    const parsed = new URL(url);
    expect(parsed.host).toBe("api.hasdata.com");
    expect(parsed.searchParams.get("start")).toBe("20");
    expect(parsed.searchParams.get("deviceType")).toBe("mobile");
  });

  it("builds Serply urls with standard query params", () => {
    const url = serply.scrapeURL!(
      {
        keyword: "hvac repair",
        country: "GB",
        device: "desktop",
      } as any,
      { scraping_api: "serply-key" } as any,
      countries,
      { start: 30, num: 10, page: 4 }
    );

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v1/search");
    expect(parsed.searchParams.get("q")).toBe("hvac repair");
    expect(parsed.searchParams.get("start")).toBe("30");
    expect(parsed.searchParams.get("hl")).toBe("GB");
  });

  it("builds SpaceSerp urls using compatible api key lookup", () => {
    const url = spaceserp.scrapeURL!(
      {
        keyword: "emergency plumber",
        country: "GB",
        city: "Leeds",
        device: "mobile",
      } as any,
      { scraping_api: "space-key" } as any,
      countries,
      { start: 0, num: 10, page: 1 }
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("apiKey")).toBe("space-key");
    expect(parsed.searchParams.get("pageNo")).toBe("1");
    expect(parsed.searchParams.get("device")).toBe("mobile");
  });

  it("builds CrazySERP urls using pageOffset params", () => {
    const url = crazyserp.scrapeURL!(
      {
        keyword: "locksmith",
        country: "US",
        city: "Miami",
        device: "desktop",
      } as any,
      { scraping_api: "crazy-key" } as any,
      countries,
      { start: 40, num: 10, page: 5 }
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("page")).toBe("10");
    expect(parsed.searchParams.get("pageOffset")).toBe("40");
    expect(parsed.searchParams.get("location")).toBe("Miami,United States");
  });
});
