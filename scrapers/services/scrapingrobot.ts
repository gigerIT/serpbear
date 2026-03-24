const scrapingRobot: ScraperSettings = {
  id: "scrapingrobot",
  name: "Scraping Robot",
  website: "scrapingrobot.com",
  scrapeURL: (_keyword, settings) => {
    return `https://api.scrapingrobot.com/?token=${settings.scaping_api}`;
  },
  requestOptions: (keyword, _settings, countryData, pagination) => {
    const country = keyword.country || "US";
    const lang = countryData[country][2];
    const p = pagination || { start: 0, num: 10 };
    const searchParams = new URLSearchParams({
      num: `${p.num}`,
      start: `${p.start}`,
      hl: lang,
      gl: country,
      q: keyword.keyword,
    });
    const payload: Record<string, string | boolean> = {
      url: `https://www.google.com/search?${searchParams.toString()}`,
      module: "HtmlRequestScraper",
      proxyCountry: country,
      render: false,
    };

    if (keyword.device === "mobile") {
      payload.mobile = true;
    }

    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
  },
  resultObjectKey: "result",
};

export default scrapingRobot;
