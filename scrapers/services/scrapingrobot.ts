const scrapingRobot:ScraperSettings = {
   id: 'scrapingrobot',
   name: 'Scraping Robot',
   website: 'scrapingrobot.com',
   scrapeURL: (keyword, settings, countryData, pagination) => {
      return `https://api.scrapingrobot.com/?token=${settings.scaping_api}`;
   },
   requestMethod: () => 'POST',
   requestBody: (keyword, _settings, countryData, pagination) => {
      const country = keyword.country || 'US';
      const lang = countryData[country][2];
      const p = pagination || { start: 0, num: 10 };
      const url = encodeURI(`https://www.google.com/search?num=${p.num}&start=${p.start}&hl=${lang}&gl=${country}&q=${keyword.keyword}`);

      return JSON.stringify({
         url,
         module: 'HtmlChromeScraper',
         proxyCountry: country,
         render: false,
         mobile: keyword.device === 'mobile',
      });
   },
   resultObjectKey: 'result',
};

export default scrapingRobot;
