import { fireEvent, render, screen } from '@testing-library/react';
import AdWordsSettings from '../../components/settings/AdWordsSettings';
import {
  useMutateKeywordsVolume,
  useStartAdwordsAuth,
  useTestAdwordsIntegration,
} from '../../services/adwords';

jest.mock('../../services/adwords');

const useStartAdwordsAuthFunc = useStartAdwordsAuth as jest.Mock<any>;
const useTestAdwordsIntegrationFunc = useTestAdwordsIntegration as jest.Mock<any>;
const useMutateKeywordsVolumeFunc = useMutateKeywordsVolume as jest.Mock<any>;

describe('AdWordsSettings Component', () => {
  beforeEach(() => {
    useStartAdwordsAuthFunc.mockImplementation(() => ({
      mutate: jest.fn(),
      isLoading: false,
    }));
    useTestAdwordsIntegrationFunc.mockImplementation(() => ({
      mutate: jest.fn(),
      isLoading: false,
    }));
    useMutateKeywordsVolumeFunc.mockImplementation(() => ({
      mutate: jest.fn(),
      isLoading: false,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts the dedicated Google Ads auth flow with the current client credentials', async () => {
    const startAuth = jest.fn();
    useStartAdwordsAuthFunc.mockImplementation(() => ({
      mutate: startAuth,
      isLoading: false,
    }));

    render(
      <AdWordsSettings
        settings={
          {
            adwords_client_id: 'client-id',
            adwords_client_secret: 'client-secret',
            adwords_refresh_token: '',
            adwords_developer_token: '',
            adwords_account_id: '',
          } as SettingsType
        }
        settingsError={null}
        updateSettings={jest.fn()}
        closeSettings={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /authenticate integration/i }),
    );

    expect(startAuth).toHaveBeenCalledWith({
      client_id: 'client-id',
      client_secret: 'client-secret',
    });
  });
});
