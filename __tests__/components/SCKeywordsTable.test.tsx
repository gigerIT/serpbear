import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SCKeywordsTable from '../../components/keywords/SCKeywordsTable';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), pathname: '/domain/test' }),
}));

jest.mock('../../components/common/Icon', () => {
  function MockIcon(props: { type: string }) {
    return <span data-testid={`icon-${props.type}`} />;
  }

  return MockIcon;
});

jest.mock('../../components/keywords/SCKeyword', () => {
  function MockSCKeyword(props: any) {
    return (
      <div
        data-testid={`sc-keyword-row-${props.keywordData.uid}`}
        className={`keyword ${props.selected ? 'keyword--selected' : ''}`}
      >
        <button
          data-testid={`keyword-checkbox-${props.keywordData.uid}`}
          onClick={(event) => props.selectKeyword(props.keywordData.uid, event)}
        >
          {props.keywordData.keyword}
        </button>
      </div>
    );
  }

  return MockSCKeyword;
});

jest.mock('../../components/keywords/KeywordFilter', () => {
  function MockKeywordFilter(props: any) {
    return (
      <div>
        <button
          data-testid="sc-filter-alpha"
          onClick={() =>
            props.filterKeywords({ ...props.filterParams, search: 'alpha' })
          }
        >
          Filter
        </button>
        <button
          data-testid="sc-sort-visits-desc"
          onClick={() => props.updateSort('visits_desc')}
        >
          Sort
        </button>
      </div>
    );
  }

  return MockKeywordFilter;
});

jest.mock('../../services/keywords', () => ({
  useAddKeywords: () => ({ mutate: jest.fn() }),
  useFetchKeywords: () => ({ keywordsData: { keywords: [] } }),
}));

jest.mock('../../hooks/useWindowResize', () => jest.fn());
jest.mock('../../hooks/useIsMobile', () => jest.fn(() => [false]));

jest.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

jest.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemData }: any) => (
    <div data-testid="fixed-size-list">
      {Array.from({ length: itemCount }).map((_, index) =>
        children({ data: itemData, index, style: {} }),
      )}
    </div>
  ),
}));

const keywords = [
  {
    uid: 'alpha:us:desktop',
    keyword: 'alpha',
    country: 'us',
    device: 'desktop',
    position: 1,
    impressions: 20,
    clicks: 10,
    ctr: 2,
  },
  {
    uid: 'beta:us:desktop',
    keyword: 'beta',
    country: 'us',
    device: 'desktop',
    position: 2,
    impressions: 10,
    clicks: 30,
    ctr: 3,
  },
  {
    uid: 'alpha-two:us:desktop',
    keyword: 'alpha two',
    country: 'us',
    device: 'desktop',
    position: 3,
    impressions: 15,
    clicks: 20,
    ctr: 4,
  },
  {
    uid: 'gamma:us:desktop',
    keyword: 'gamma',
    country: 'us',
    device: 'desktop',
    position: 4,
    impressions: 8,
    clicks: 5,
    ctr: 1,
  },
] as any[];

const renderTable = (items = keywords) =>
  render(
    <SCKeywordsTable
      domain={null}
      keywords={items as any}
      isLoading={false}
      isConsoleIntegrated={true}
    />,
  );

describe('SCKeywordsTable', () => {
  it('selects shift ranges using the filtered visible list', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('sc-filter-alpha'));

    fireEvent.click(screen.getByTestId('keyword-checkbox-alpha:us:desktop'));
    fireEvent.click(
      screen.getByTestId('keyword-checkbox-alpha-two:us:desktop'),
      {
        shiftKey: true,
      },
    );

    expect(screen.getByTestId('sc-keyword-row-alpha:us:desktop')).toHaveClass(
      'keyword--selected',
    );
    expect(
      screen.getByTestId('sc-keyword-row-alpha-two:us:desktop'),
    ).toHaveClass('keyword--selected');
    expect(
      screen.queryByTestId('sc-keyword-row-beta:us:desktop'),
    ).not.toBeInTheDocument();
  });

  it('keeps select-all scoped to the visible rows', () => {
    const view = renderTable();

    fireEvent.click(screen.getByTestId('keyword-checkbox-alpha:us:desktop'));

    view.rerender(
      <SCKeywordsTable
        domain={null}
        keywords={
          keywords.filter((item) => item.uid !== 'alpha:us:desktop') as any
        }
        isLoading={false}
        isConsoleIntegrated={true}
      />,
    );

    expect(screen.getByTestId('sc-keywords-select-all')).not.toHaveClass(
      'bg-blue-700',
    );

    fireEvent.click(screen.getByTestId('sc-keywords-select-all'));

    expect(screen.getByTestId('sc-keywords-select-all')).toHaveClass(
      'bg-blue-700',
    );
    expect(
      screen.getByTestId('sc-keyword-row-alpha-two:us:desktop'),
    ).toHaveClass('keyword--selected');
    expect(screen.getByTestId('sc-keyword-row-beta:us:desktop')).toHaveClass(
      'keyword--selected',
    );
  });
});
