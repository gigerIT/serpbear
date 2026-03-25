import { fireEvent, render, screen } from "@testing-library/react";
import Keyword from "../../components/keywords/Keyword";
import { dummyKeywords } from "../../__mocks__/data";

const keywordProps = {
  keywordData: dummyKeywords[0],
  selected: false,
  index: 0,
  showSCData: false,
  scDataType: "",
  style: {},
  maxTitleColumnWidth: 300,
  refreshkeyword: jest.fn(),
  favoriteKeyword: jest.fn(),
  removeKeyword: jest.fn(),
  selectKeyword: jest.fn(),
  manageTags: jest.fn(),
  showKeywordDetails: jest.fn(),
};
jest.mock("react-chartjs-2", () => ({
  Line: () => null,
}));
describe("Keyword Component", () => {
  it("renders without crashing", async () => {
    render(<Keyword {...keywordProps} />);
    expect(await screen.findByText("compress image")).toBeInTheDocument();
  });
  it("Should Render Position Correctly", async () => {
    render(<Keyword {...keywordProps} />);
    const positionElement = document.querySelector(".keyword_position");
    expect(positionElement?.childNodes[0].nodeValue).toBe("19");
  });
  it("Should Display Position Change arrow", async () => {
    render(<Keyword {...keywordProps} />);
    const positionElement = document.querySelector(".keyword_position i");
    expect(positionElement?.textContent).toBe("▲ 1");
  });
  it("Should Display the SERP Page URL", async () => {
    render(<Keyword {...keywordProps} />);
    const positionElement = document.querySelector(".keyword_url");
    expect(positionElement?.textContent).toBe("/");
  });
  it("Should Display the Keyword Options on dots Click", async () => {
    const { container } = render(<Keyword {...keywordProps} />);
    const button = container.querySelector(".keyword_dots");
    if (button) fireEvent.click(button);
    expect(document.querySelector(".keyword_options")).toBeVisible();
  });
  it("hides stale update errors while the keyword is refreshing", () => {
    render(
      <Keyword
        {...keywordProps}
        keywordData={{
          ...dummyKeywords[0],
          updating: true,
          lastUpdateError: {
            date: "2026-03-25T10:00:00.000Z",
            error: "scrapingrobot: true",
            scraper: "scrapingrobot",
          },
        }}
      />
    );

    expect(
      screen.queryByTitle("Updating Keyword Position")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Error Updating Keyword position/i)
    ).not.toBeInTheDocument();
  });
  // it('Should favorite Keywords', async () => {
  //    render(<Keyword {...keywordProps} />);
  //    const button = document.querySelector('.keyword .keyword_dots');
  //    if (button) fireEvent(button, new MouseEvent('click', { bubbles: true }));
  //    const option = document.querySelector('.keyword .keyword_options li:nth-child(1) a');
  //    if (option) fireEvent(option, new MouseEvent('click', { bubbles: true }));
  //    const { favoriteKeyword } = keywordFunctions;
  //    expect(favoriteKeyword).toHaveBeenCalled();
  // });
});
