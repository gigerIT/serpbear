import { parseScraperResults } from "./parserHelpers";

interface SerplyResult {
  title: string;
  link: string;
  realPosition: number;
}
const scraperCountries = [
  "US",
  "CA",
  "IE",
  "GB",
  "FR",
  "DE",
  "SE",
  "IN",
  "JP",
  "KR",
  "SG",
  "AU",
  "BR",
];

const serply: ScraperSettings = {
  id: "serply",
  name: "Serply",
  website: "serply.io",
  headers: (keyword, settings) => {
    const requestedCountry = (keyword.country || "US").toUpperCase();
    const country = scraperCountries.includes(requestedCountry)
      ? requestedCountry
      : "US";
    const apiKey = settings.scraping_api || settings.scaping_api;
    return {
      "Content-Type": "application/json",
      "X-User-Agent": keyword.device === "mobile" ? "mobile" : "desktop",
      "X-Api-Key": apiKey,
      "X-Proxy-Location": country,
    };
  },
  scrapeURL: (keyword, _settings, _countries, pagination) => {
    const requestedCountry = (keyword.country || "US").toUpperCase();
    const country = scraperCountries.includes(requestedCountry)
      ? requestedCountry
      : "US";
    const p = pagination || { start: 0, num: 10 };
    const params = new URLSearchParams({
      q: keyword.keyword,
      num: String(p.num),
      start: String(p.start),
      hl: country,
    });
    return `https://api.serply.io/v1/search?${params.toString()}`;
  },
  resultObjectKey: "result",
  serpExtractor: (content) => {
    const extractedResult = [];
    const results = parseScraperResults<SerplyResult>(content, "Serply", [
      "result",
    ]);
    for (const result of results) {
      if (result.title && result.link) {
        extractedResult.push({
          title: result.title,
          url: result.link,
          position: result.realPosition,
        });
      }
    }
    return extractedResult;
  },
};

export default serply;
