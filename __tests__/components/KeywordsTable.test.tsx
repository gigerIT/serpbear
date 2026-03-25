import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import KeywordsTable from '../../components/keywords/KeywordsTable';

jest.mock('../../components/common/Icon', () => {
  function MockIcon(props: { type: string }) {
    return <span data-testid={`icon-${props.type}`} />;
  }

  return MockIcon;
});

jest.mock('../../components/keywords/Keyword', () => {
  function MockKeyword(props: any) {
    return (
      <div
        data-testid={`keyword-row-${props.keywordData.ID}`}
        className={`keyword ${props.selected ? 'keyword--selected' : ''}`}
      >
        <button
          data-testid={`keyword-checkbox-${props.keywordData.ID}`}
          onClick={(event) => props.selectKeyword(props.keywordData.ID, event)}
        >
          {props.keywordData.keyword}
        </button>
      </div>
    );
  }

  return MockKeyword;
});

jest.mock('../../components/keywords/KeywordDetails', () => {
  function MockKeywordDetails() {
    return <div data-testid="keyword-details" />;
  }

  return MockKeywordDetails;
});

jest.mock('../../components/common/Modal', () => {
  function MockModal({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  return MockModal;
});

jest.mock('../../components/keywords/KeywordTagManager', () => {
  function MockKeywordTagManager() {
    return <div data-testid="tag-manager" />;
  }

  return MockKeywordTagManager;
});

jest.mock('../../components/keywords/AddTags', () => {
  function MockAddTags() {
    return <div data-testid="add-tags" />;
  }

  return MockAddTags;
});

jest.mock('../../services/keywords', () => ({
  useDeleteKeywords: () => ({ mutate: jest.fn() }),
  useFavKeywords: () => ({ mutate: jest.fn() }),
  useRefreshKeywords: () => ({ mutate: jest.fn() }),
}));

jest.mock('../../services/settings', () => ({
  useUpdateSettings: () => ({ mutate: jest.fn(), isLoading: false }),
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

const settings = {
  ID: 1,
  user_id: 1,
  createdAt: '',
  updatedAt: '',
  generalNotifications: true,
  summaryEmails: true,
  alertEmails: true,
  autoRefresh: true,
  defaultChartPeriod: '7',
  theme: 'light',
  timeZone: 'UTC',
  dateFormat: 'MM/dd/yyyy',
  keywordsColumns: ['Best', 'History', 'Volume', 'Search Console'],
} as any;

const keyword = (
  ID: number,
  name: string,
  position: number,
  updatedAt: string,
): any => ({
  ID,
  keyword: name,
  device: 'desktop',
  position,
  country: 'us',
  tags: [],
  history: {},
  lastUpdated: updatedAt,
  domain: 'example.com',
  volume: 100,
  url: 'https://example.com',
  sticky: false,
  city: '',
  updating: false,
  lastUpdateError: false,
  archived: false,
  scData: {
    position: {
      threeDays: 0,
      sevenDays: 0,
      thirtyDays: 0,
      avgThreeDays: 0,
      avgSevenDays: 0,
      avgThirtyDays: 0,
    },
    impressions: {
      threeDays: 0,
      sevenDays: 0,
      thirtyDays: 0,
      avgThreeDays: 0,
      avgSevenDays: 0,
      avgThirtyDays: 0,
    },
    visits: {
      threeDays: 0,
      sevenDays: 0,
      thirtyDays: 0,
      avgThreeDays: 0,
      avgSevenDays: 0,
      avgThirtyDays: 0,
    },
    ctr: {
      threeDays: '0%',
      sevenDays: '0%',
      thirtyDays: '0%',
      avgThreeDays: '0%',
      avgSevenDays: '0%',
      avgThirtyDays: '0%',
    },
  },
});

const baseKeywords = [
  keyword(1, 'alpha one', 1, '2026-01-05T00:00:00.000Z'),
  keyword(2, 'beta one', 2, '2026-01-04T00:00:00.000Z'),
  keyword(3, 'alpha two', 3, '2026-01-03T00:00:00.000Z'),
  keyword(4, 'delta one', 4, '2026-01-02T00:00:00.000Z'),
  keyword(5, 'alpha three', 5, '2026-01-01T00:00:00.000Z'),
];

const renderTable = (keywords: any[]) =>
  render(
    <KeywordsTable
      domain={null}
      keywords={keywords}
      isLoading={false}
      showAddModal={false}
      setShowAddModal={jest.fn()}
      isConsoleIntegrated={false}
      settings={settings}
    />,
  );

describe('KeywordsTable', () => {
  it('selects shift ranges using the filtered visible list', () => {
    renderTable(baseKeywords);

    fireEvent.change(screen.getByTestId('filter_input'), {
      target: { value: 'alpha' },
    });

    fireEvent.click(screen.getByTestId('keyword-checkbox-1'));
    fireEvent.click(screen.getByTestId('keyword-checkbox-5'), {
      shiftKey: true,
    });

    expect(screen.getByTestId('keyword-row-1')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-3')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-5')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.queryByTestId('keyword-row-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('keyword-row-4')).not.toBeInTheDocument();
  });

  it('selects shift ranges using the current sort order', () => {
    renderTable(baseKeywords);

    fireEvent.click(screen.getByTestId('sort_button'));
    fireEvent.click(screen.getByText('Alphabetically(Z-A)'));

    fireEvent.click(screen.getByTestId('keyword-checkbox-5'));
    fireEvent.click(screen.getByTestId('keyword-checkbox-2'), {
      shiftKey: true,
    });

    expect(screen.getByTestId('keyword-row-5')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-3')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-2')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-4')).not.toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-1')).not.toHaveClass(
      'keyword--selected',
    );
  });

  it('falls back to a normal toggle when the old anchor is no longer visible', () => {
    const view = renderTable(baseKeywords);

    fireEvent.click(screen.getByTestId('keyword-checkbox-1'));

    view.rerender(
      <KeywordsTable
        domain={null}
        keywords={baseKeywords.filter((item) => item.ID !== 1)}
        isLoading={false}
        showAddModal={false}
        setShowAddModal={jest.fn()}
        isConsoleIntegrated={false}
        settings={settings}
      />,
    );

    fireEvent.click(screen.getByTestId('keyword-checkbox-3'), {
      shiftKey: true,
    });

    expect(screen.getByTestId('keyword-row-3')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-2')).not.toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-4')).not.toHaveClass(
      'keyword--selected',
    );
  });

  it('treats shift-click as a normal toggle when nothing is selected', () => {
    renderTable(baseKeywords);

    fireEvent.click(screen.getByTestId('keyword-checkbox-3'), {
      shiftKey: true,
    });

    expect(screen.getByTestId('keyword-row-3')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-2')).not.toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-4')).not.toHaveClass(
      'keyword--selected',
    );
  });

  it('keeps the select-all state scoped to the visible rows', () => {
    const view = renderTable(baseKeywords);

    fireEvent.click(screen.getByTestId('keyword-checkbox-1'));

    view.rerender(
      <KeywordsTable
        domain={null}
        keywords={baseKeywords.filter((item) => item.ID !== 1)}
        isLoading={false}
        showAddModal={false}
        setShowAddModal={jest.fn()}
        isConsoleIntegrated={false}
        settings={settings}
      />,
    );

    expect(screen.getByTestId('keywords-select-all')).not.toHaveClass(
      'bg-blue-700',
    );

    fireEvent.click(screen.getByTestId('keywords-select-all'));

    expect(screen.getByTestId('keywords-select-all')).toHaveClass(
      'bg-blue-700',
    );
    expect(screen.getByTestId('keyword-row-2')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-3')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-4')).toHaveClass(
      'keyword--selected',
    );
    expect(screen.getByTestId('keyword-row-5')).toHaveClass(
      'keyword--selected',
    );
  });
});
