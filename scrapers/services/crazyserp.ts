import countries from "../../utils/countries";

const googleDomains: Record<string, string> = {
  GB: "www.google.co.uk",
  CA: "www.google.ca",
  DE: "www.google.de",
  FR: "www.google.fr",
  ES: "www.google.es",
  IT: "www.google.it",
  NL: "www.google.nl",
};

interface CrazySerpResult {
  position: number;
  url: string;
  title: string;
  description: string;
  is_video: boolean;
}

const crazyserp: ScraperSettings = {
  id: "crazyserp",
  name: "CrazySERP",
  website: "crazyserp.com",
  allowsCity: true,
  nativePagination: true,
  headers: (keyword, settings) => {
    const apiKey = settings.scraping_api || settings.scaping_api;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  },
  scrapeURL: (keyword, _settings, countryData, pagination) => {
    const country = keyword.country || "US";
    const lang = countryData[country][2];
    const countryName = countries[country][0];
    const location = keyword.city
      ? `${keyword.city},${countryName}`
      : countryName;
    const googleDomain = googleDomains[country] || "www.google.com";
    const p = pagination || { start: 0, num: 10, page: 1 };
    const params = new URLSearchParams();
    params.set("q", keyword.keyword);
    params.set("page", String(p.num));
    params.set("pageOffset", String(p.start));
    params.set("location", location);
    params.set("googleDomain", googleDomain);
    params.set("gl", country.toLowerCase());
    params.set("hl", lang);
    params.set("safe", "off");
    params.set("filter", "1");
    params.set("nfpr", "0");
    params.set("device", keyword.device || "desktop");
    return `https://crazyserp.com/api/search?${params.toString()}`;
  },
  resultObjectKey: "parsed_data",
  serpExtractor: (content) => {
    const extractedResult = [];
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const results: CrazySerpResult[] = parsed.organic || parsed;

    for (const { url, title, position } of results) {
      if (title && url) {
        extractedResult.push({
          title,
          url,
          position,
        });
      }
    }
    return extractedResult;
  },
};

export default crazyserp;
