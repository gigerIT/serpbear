const scrapingRobot: ScraperSettings = {
  id: "scrapingrobot",
  name: "Scraping Robot",
  website: "scrapingrobot.com",
  scrapeURL: (keyword, settings, countryData, pagination) => {
    const country = keyword.country || "US";
    const device = keyword.device === "mobile" ? "&mobile=true" : "";
    const lang = countryData[country][2];
    const p = pagination || { start: 0, num: 10 };
    const apiKey = settings.scraping_api || settings.scaping_api || "";
    const googleURL = new URL("https://www.google.com/search");
    googleURL.searchParams.set("udm", "web");
    googleURL.searchParams.set("q", keyword.keyword);
    googleURL.searchParams.set("gl", country);
    googleURL.searchParams.set("hl", lang);
    googleURL.searchParams.set("start", String(p.start));
    googleURL.searchParams.set("num", String(p.num));
    return `https://api.scrapingrobot.com/?token=${apiKey}&proxyCountry=${country}&render=false${device}&url=${encodeURIComponent(
      googleURL.toString()
    )}`;
  },
  resultObjectKey: "result",
};

export default scrapingRobot;
