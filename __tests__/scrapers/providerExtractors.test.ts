import serpapi from "../../scrapers/services/serpapi";
import valueserp from "../../scrapers/services/valueserp";
import searchapi from "../../scrapers/services/searchapi";
import serper from "../../scrapers/services/serper";
import hasdata from "../../scrapers/services/hasdata";
import serply from "../../scrapers/services/serply";
import spaceserp from "../../scrapers/services/spaceserp";
import crazyserp from "../../scrapers/services/crazyserp";

describe("scraper provider extractors", () => {
  it("supports object payload fallbacks for array results", () => {
    expect(
      serpapi.serpExtractor!({
        organic_results: [{ title: "A", link: "https://a.com", position: 1 }],
      } as any)
    ).toEqual([{ title: "A", url: "https://a.com", position: 1 }]);

    expect(
      serper.serpExtractor!({
        organic: [{ title: "B", link: "https://b.com", position: 2 }],
      } as any)
    ).toEqual([{ title: "B", url: "https://b.com", position: 2 }]);

    expect(
      serply.serpExtractor!({
        result: [{ title: "C", link: "https://c.com", realPosition: 3 }],
      } as any)
    ).toEqual([{ title: "C", url: "https://c.com", position: 3 }]);
  });

  it("supports remaining provider fallback keys", () => {
    expect(
      valueserp.serpExtractor!({
        organic_results: [{ title: "D", link: "https://d.com", position: 4 }],
      } as any)
    ).toEqual([{ title: "D", url: "https://d.com", position: 4 }]);

    expect(
      searchapi.serpExtractor!({
        organic_results: [{ title: "E", link: "https://e.com", position: 5 }],
      } as any)
    ).toEqual([{ title: "E", url: "https://e.com", position: 5 }]);

    expect(
      hasdata.serpExtractor!({
        organicResults: [{ title: "F", link: "https://f.com", position: 6 }],
      } as any)
    ).toEqual([{ title: "F", url: "https://f.com", position: 6 }]);

    expect(
      spaceserp.serpExtractor!({
        organic_results: [{ title: "G", link: "https://g.com", position: 7 }],
      } as any)
    ).toEqual([{ title: "G", url: "https://g.com", position: 7 }]);

    expect(
      crazyserp.serpExtractor!({
        organic: [{ title: "H", url: "https://h.com", position: 8 }],
      } as any)
    ).toEqual([{ title: "H", url: "https://h.com", position: 8 }]);
  });

  it("throws stable errors for malformed JSON", () => {
    expect(() => serpapi.serpExtractor!("{" as any)).toThrow(
      /Invalid JSON response for SerpApi.com/
    );
    expect(() => crazyserp.serpExtractor!("{" as any)).toThrow(
      /Invalid JSON response for CrazySERP/
    );
  });
});
