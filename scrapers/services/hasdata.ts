import countries from "../../utils/countries";
import { parseScraperResults } from "./parserHelpers";

interface HasDataResult {
  title: string;
  link: string;
  position: number;
}

const hasdata: ScraperSettings = {
  id: "hasdata",
  name: "HasData",
  website: "hasdata.com",
  allowsCity: true,
  headers: (keyword, settings) => {
    const apiKey = settings.scraping_api || settings.scaping_api;
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    };
  },
  scrapeURL: (keyword, _settings, _countryData, pagination) => {
    const country = keyword.country || "US";
    const countryName = countries[country][0];
    const p = pagination || { start: 0, num: 10 };
    const params = new URLSearchParams();
    params.set("q", keyword.keyword);
    params.set("gl", country.toLowerCase());
    params.set("deviceType", keyword.device || "desktop");
    params.set("num", String(p.num));
    params.set("start", String(p.start));
    if (keyword.city && countryName) {
      params.set("location", `${keyword.city},${countryName}`);
    }
    return `https://api.hasdata.com/scrape/google/serp?${params.toString()}`;
  },
  resultObjectKey: "organicResults",
  serpExtractor: (content) => {
    const extractedResult = [];
    const results = parseScraperResults<HasDataResult>(content, "HasData", [
      "organicResults",
    ]);

    for (const { link, title, position } of results) {
      if (title && link) {
        extractedResult.push({
          title,
          url: link,
          position,
        });
      }
    }
    return extractedResult;
  },
};

export default hasdata;
