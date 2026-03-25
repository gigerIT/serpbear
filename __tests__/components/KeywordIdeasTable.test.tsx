import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import KeywordIdeasTable from '../../components/ideas/KeywordIdeasTable';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), pathname: '/domain/test' }),
}));

jest.mock('../../components/common/Icon', () => {
  function MockIcon(props: { type: string }) {
    return <span data-testid={`icon-${props.type}`} />;
  }

  return MockIcon;
});

jest.mock('../../components/ideas/KeywordIdea', () => {
  function MockKeywordIdea(props: any) {
    return (
      <div
        data-testid={`idea-keyword-row-${props.keywordData.uid}`}
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

  return MockKeywordIdea;
});

jest.mock('../../components/ideas/IdeasFilter', () => {
  function MockIdeasFilter(props: any) {
    return (
      <div>
        <button
          data-testid="ideas-filter-alpha"
          onClick={() =>
            props.filterKeywords({ ...props.filterParams, search: 'alpha' })
          }
        >
          Filter
        </button>
        <button
          data-testid="ideas-sort-volume"
          onClick={() => props.updateSort('vol_desc')}
        >
          Sort
        </button>
      </div>
    );
  }

  return MockIdeasFilter;
});

jest.mock('../../components/ideas/IdeaDetails', () => {
  function MockIdeaDetails() {
    return <div data-testid="idea-details" />;
  }

  return MockIdeaDetails;
});

jest.mock('../../components/common/SelectField', () => {
  function MockSelectField() {
    return <div data-testid="select-field" />;
  }

  return MockSelectField;
});

jest.mock('../../services/keywords', () => ({
  useAddKeywords: () => ({ mutate: jest.fn() }),
}));

jest.mock('../../services/adwords', () => ({
  useMutateFavKeywordIdeas: () => ({ mutate: jest.fn(), isLoading: false }),
}));

jest.mock('../../services/domains', () => ({
  fetchDomains: jest.fn(),
}));

jest.mock('react-query', () => ({
  useQuery: () => ({ data: { domains: [] } }),
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
    uid: 'alpha-one',
    keyword: 'alpha one',
    country: 'us',
    monthlySearchVolumes: {},
    avgMonthlySearches: 100,
    competition: 'LOW',
    competitionIndex: 10,
    position: 1,
  },
  {
    uid: 'beta-one',
    keyword: 'beta one',
    country: 'us',
    monthlySearchVolumes: {},
    avgMonthlySearches: 300,
    competition: 'MEDIUM',
    competitionIndex: 50,
    position: 2,
  },
  {
    uid: 'alpha-two',
    keyword: 'alpha two',
    country: 'us',
    monthlySearchVolumes: {},
    avgMonthlySearches: 200,
    competition: 'HIGH',
    competitionIndex: 80,
    position: 3,
  },
  {
    uid: 'gamma-one',
    keyword: 'gamma one',
    country: 'us',
    monthlySearchVolumes: {},
    avgMonthlySearches: 50,
    competition: 'LOW',
    competitionIndex: 20,
    position: 4,
  },
] as any[];

const renderTable = (items = keywords) =>
  render(
    <KeywordIdeasTable
      domain={null}
      keywords={items as any}
      favorites={[] as any}
      noIdeasDatabase={false}
      isLoading={false}
      showFavorites={false}
      setShowFavorites={jest.fn()}
      isAdwordsIntegrated={true}
    />,
  );

describe('KeywordIdeasTable', () => {
  it('selects shift ranges using the filtered visible list', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('ideas-filter-alpha'));

    fireEvent.click(screen.getByTestId('keyword-checkbox-alpha-one'));
    fireEvent.click(screen.getByTestId('keyword-checkbox-alpha-two'), {
      shiftKey: true,
    });

    expect(screen.getByTestId('idea-keyword-row-alpha-one')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('idea-keyword-row-alpha-two')).toHaveClass(
      'keyword--selected',
    );
    expect(
      screen.queryByTestId('idea-keyword-row-beta-one'),
    ).not.toBeInTheDocument();
  });

  it('selects shift ranges using the current sort order', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('ideas-sort-volume'));

    fireEvent.click(screen.getByTestId('keyword-checkbox-beta-one'));
    fireEvent.click(screen.getByTestId('keyword-checkbox-alpha-one'), {
      shiftKey: true,
    });

    expect(screen.getByTestId('idea-keyword-row-beta-one')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('idea-keyword-row-alpha-two')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('idea-keyword-row-alpha-one')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('idea-keyword-row-gamma-one')).not.toHaveClass(
      'keyword--selected',
    );
  });
});
