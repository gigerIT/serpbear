import countries from "../../utils/countries";

interface ValueSerpResult {
  title: string;
  link: string;
  position: number;
  domain: string;
}

const valueSerp: ScraperSettings = {
  id: "valueserp",
  name: "Value Serp",
  website: "valueserp.com",
  allowsCity: true,
  timeoutMs: 35000,
  scrapeURL: (keyword, settings, countryData, pagination) => {
    const country = keyword.country || "US";
    const countryName = countries[country][0];
    const apiKey = settings.scraping_api || settings.scaping_api || "";
    const lang = countryData[country][2];
    const p = pagination || { start: 0, num: 10, page: 1 };
    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("q", keyword.keyword);
    params.set("output", "json");
    if (keyword.city) {
      params.set("location", `${keyword.city},${countryName}`);
    }
    if (keyword.device === "mobile") {
      params.set("device", "mobile");
    }
    params.set("gl", country.toLowerCase());
    params.set("hl", lang);
    params.set("page", String(p.page));
    return `https://api.valueserp.com/search?${params.toString()}`;
  },
  resultObjectKey: "organic_results",
  serpExtractor: (content) => {
    const extractedResult = [];
    const results: ValueSerpResult[] =
      typeof content === "string"
        ? JSON.parse(content)
        : (content as ValueSerpResult[]);
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

export default valueSerp;
