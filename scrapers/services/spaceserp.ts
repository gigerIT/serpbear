import countries from "../../utils/countries";
import { parseScraperResults } from "./parserHelpers";

interface SpaceSerpResult {
  title: string;
  link: string;
  domain: string;
  position: number;
}

const spaceSerp: ScraperSettings = {
  id: "spaceSerp",
  name: "Space Serp",
  website: "spaceserp.com",
  allowsCity: true,
  scrapeURL: (keyword, settings, countryData, pagination) => {
    const country = keyword.country || "US";
    const countryName = countries[country][0];
    const apiKey = settings.scraping_api || settings.scaping_api || "";
    const location = keyword.city
      ? `&location=${encodeURIComponent(`${keyword.city},${countryName}`)}`
      : "";
    const device = keyword.device === "mobile" ? "&device=mobile" : "";
    const lang = countryData[country][2];
    const p = pagination || { start: 0, num: 10, page: 1 };
    return `https://api.spaceserp.com/google/search?apiKey=${apiKey}&q=${encodeURIComponent(
      keyword.keyword
    )}&pageSize=${p.num}&pageNo=${
      p.page
    }&gl=${country}&hl=${lang}${location}${device}&resultBlocks=`;
  },
  resultObjectKey: "organic_results",
  serpExtractor: (content) => {
    const extractedResult = [];
    const results = parseScraperResults<SpaceSerpResult>(
      content,
      "Space Serp",
      ["organic_results"]
    );
    for (const result of results) {
      if (result.title && result.link) {
        extractedResult.push({
          title: result.title,
          url: result.link,
          position: result.position,
        });
      }
    }
    return extractedResult;
  },
};

export default spaceSerp;
