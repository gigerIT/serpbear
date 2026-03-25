import countries from "../../utils/countries";
import { parseScraperResults } from "./parserHelpers";

interface SerpApiResult {
  title: string;
  link: string;
  position: number;
}

const serpapi: ScraperSettings = {
  id: "serpapi",
  name: "SerpApi.com",
  website: "serpapi.com",
  allowsCity: true,
  nativePagination: true,
  headers: (keyword, settings) => {
    const apiKey = settings.scraping_api || settings.scaping_api;
    return {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    };
  },
  scrapeURL: (keyword, settings) => {
    const country = keyword.country || "US";
    const countryName = countries[country][0];
    const apiKey = settings.scraping_api || settings.scaping_api || "";
    const params = new URLSearchParams();
    params.set("engine", "google");
    params.set("q", keyword.keyword);
    if (keyword.city && country) {
      params.set("location", `${keyword.city},${countryName}`);
    }
    if (keyword.device === "mobile") {
      params.set("device", "mobile");
    }
    params.set("gl", country);
    params.set("hl", countries[country][2]);
    params.set("api_key", apiKey);
    return `https://serpapi.com/search.json?${params.toString()}`;
  },
  resultObjectKey: "organic_results",
  serpExtractor: (content) => {
    const extractedResult = [];
    const results = parseScraperResults<SerpApiResult>(content, "SerpApi.com", [
      "organic_results",
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

export default serpapi;
