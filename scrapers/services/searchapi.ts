import countries from "../../utils/countries";
import { parseScraperResults } from "./parserHelpers";

interface SearchApiResult {
  title: string;
  link: string;
  position: number;
}

const searchapi: ScraperSettings = {
  id: "searchapi",
  name: "SearchApi.io",
  website: "searchapi.io",
  allowsCity: true,
  nativePagination: true,
  headers: (keyword, settings) => {
    const apiKey = settings.scraping_api || settings.scaping_api;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  },
  scrapeURL: (keyword, settings, countryData) => {
    const country = keyword.country || "US";
    const countryName = countries[country][0];
    const apiKey = settings.scraping_api || settings.scaping_api || "";
    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("engine", "google");
    params.set("q", keyword.keyword);
    if (keyword.city && countryName) {
      params.set("location", `${keyword.city},${countryName}`);
    }
    if (keyword.device === "mobile") {
      params.set("device", "mobile");
    }
    params.set("gl", country);
    params.set("hl", countryData[country][2]);
    return `https://www.searchapi.io/api/v1/search?${params.toString()}`;
  },
  resultObjectKey: "organic_results",
  serpExtractor: (content) => {
    const extractedResult = [];
    const results = parseScraperResults<SearchApiResult>(
      content,
      "SearchApi.io",
      ["organic_results"]
    );

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

export default searchapi;
