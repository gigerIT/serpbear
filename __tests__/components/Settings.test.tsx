import { fireEvent, render, screen } from "@testing-library/react";
import Settings, { defaultSettings } from "../../components/settings/Settings";
import { useFetchSettings, useUpdateSettings } from "../../services/settings";

jest.mock("../../services/settings");
jest.mock("../../hooks/useOnKey", () => jest.fn());
jest.mock("../../components/common/Icon", () => () => <span />);
jest.mock("react-hot-toast", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));
jest.mock("../../components/settings/NotificationSettings", () => () => (
  <div />
));
jest.mock("../../components/settings/IntegrationSettings", () => () => <div />);
jest.mock("../../components/settings/ScraperSettings", () => {
  return function MockScraperSettings({ settings, updateSettings }: any) {
    return (
      <input
        placeholder="API Key/Token"
        value={settings.scraping_api || settings.scaping_api || ""}
        onChange={(event) => updateSettings("scaping_api", event.target.value)}
      />
    );
  };
});

const useFetchSettingsMock = useFetchSettings as jest.Mock;
const useUpdateSettingsMock = useUpdateSettings as jest.Mock;

describe("Settings component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps scraper api aliases in sync when saving updated settings", () => {
    const mutate = jest.fn();
    let fetchedSettings: SettingsType = {
      ...defaultSettings,
      notification_interval: "never",
      scraper_type: "scrapingrobot",
      scraping_api: "old-key",
      scaping_api: "old-key",
    };
    let fetchResponse = {
      data: { settings: fetchedSettings },
      isLoading: false,
    };

    useFetchSettingsMock.mockImplementation(() => fetchResponse);
    useUpdateSettingsMock.mockReturnValue({
      mutate,
      isLoading: false,
    });

    const { rerender } = render(<Settings closeSettings={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("API Key/Token"), {
      target: { value: "new-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update settings/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        scraping_api: "new-key",
        scaping_api: "new-key",
      })
    );

    fetchedSettings = {
      ...fetchedSettings,
      scraping_api: "new-key",
      scaping_api: "new-key",
    };
    fetchResponse = {
      data: { settings: fetchedSettings },
      isLoading: false,
    };

    rerender(<Settings closeSettings={jest.fn()} />);

    expect(screen.getByPlaceholderText("API Key/Token")).toHaveValue("new-key");
  });
});
