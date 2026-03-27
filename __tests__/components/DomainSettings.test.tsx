import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import DomainSettings from "../../components/domains/DomainSettings";
import {
  useDeleteDomain,
  useFetchDomain,
  useUpdateDomain,
} from "../../services/domains";

jest.mock("../../services/domains");
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock("../../components/common/Icon", () => {
  const MockIcon = () => <span />;
  MockIcon.displayName = "MockIcon";
  return MockIcon;
});
jest.mock("../../components/common/Modal", () => {
  const MockModal = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  MockModal.displayName = "MockModal";
  return MockModal;
});
jest.mock("../../components/common/InputField", () => {
  const MockInputField = ({ label, value, onChange, placeholder }: any) => (
    <label>
      {label}
      <input
        data-testid={`input-${label}`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
  MockInputField.displayName = "MockInputField";
  return MockInputField;
});
jest.mock("../../components/common/ToggleField", () => {
  const MockToggleField = () => <input />;
  MockToggleField.displayName = "MockToggleField";
  return MockToggleField;
});
jest.mock("../../components/common/SecretField", () => {
  const MockSecretField = ({ label, value, onChange, placeholder }: any) => {
    return (
      <label>
        {label}
        <input
          data-testid={`secret-${label}`}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  };
  MockSecretField.displayName = "MockSecretField";
  return MockSecretField;
});
jest.mock("../../components/common/SelectField", () => {
  const MockSelectField = ({ label, options, selected, updateField }: any) => {
    return (
      <label>
        {label}
        <select
          data-testid={`select-${label}`}
          value={selected?.[0] || ""}
          onChange={(event) => updateField([event.target.value])}
        >
          {options.map((option: { label: string; value: string }) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  };
  MockSelectField.displayName = "MockSelectField";
  return MockSelectField;
});

const useFetchDomainMock = useFetchDomain as jest.Mock;
const useUpdateDomainMock = useUpdateDomain as jest.Mock;
const useDeleteDomainMock = useDeleteDomain as jest.Mock;

const baseDomain: DomainType = {
  ID: 1,
  domain: "example.com",
  slug: "example-com",
  notification: true,
  notification_interval: "daily",
  notification_emails: "",
  lastUpdated: "",
  added: "",
  search_console: JSON.stringify({}),
  scraper_settings: {
    scraper_type: "serpapi",
    has_api_key: true,
  },
};

describe("DomainSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUpdateDomainMock.mockReturnValue({
      mutate: jest.fn(),
      error: null,
      isLoading: false,
    });
    useDeleteDomainMock.mockReturnValue({ mutate: jest.fn() });
  });

  it("clears the scraper override state after refetching a global scraper setting", async () => {
    const fetchedDomain: DomainType = {
      ...baseDomain,
      scraper_settings: null,
    };

    useFetchDomainMock.mockImplementation(
      (_router: unknown, _domainName: string, onSuccess: Function) => {
        const hasSyncedRef = React.useRef(false);

        React.useEffect(() => {
          if (!hasSyncedRef.current) {
            hasSyncedRef.current = true;
            onSuccess(fetchedDomain);
          }
        }, [onSuccess]);

        return { data: { domain: fetchedDomain }, isLoading: false };
      }
    );

    render(
      <DomainSettings
        domain={baseDomain}
        closeModal={jest.fn()}
        availableScrapers={[{ label: "SerpApi", value: "serpapi" }]}
      />
    );

    fireEvent.click(screen.getByText("Scraping"));

    await waitFor(() => {
      expect(screen.getByTestId("select-Scraper Override")).toHaveValue("");
    });
  });

  it("shows the saved API key state after refetching masked domain scraper settings", async () => {
    const fetchedDomain: DomainType = {
      ...baseDomain,
      scraper_settings: {
        scraper_type: "serpapi",
        has_api_key: true,
      },
    };

    useFetchDomainMock.mockImplementation(
      (_router: unknown, _domainName: string, onSuccess: Function) => {
        const hasSyncedRef = React.useRef(false);

        React.useEffect(() => {
          if (!hasSyncedRef.current) {
            hasSyncedRef.current = true;
            onSuccess(fetchedDomain);
          }
        }, [onSuccess]);

        return { data: { domain: fetchedDomain }, isLoading: false };
      }
    );

    render(
      <DomainSettings
        domain={{ ...baseDomain, scraper_settings: null }}
        closeModal={jest.fn()}
        availableScrapers={[{ label: "SerpApi", value: "serpapi" }]}
      />
    );

    fireEvent.click(screen.getByText("Scraping"));

    await waitFor(() => {
      expect(screen.getByText("Clear saved API key")).toBeInTheDocument();
    });
  });

  it("includes subdomain matching in the update payload", async () => {
    const mutate = jest.fn();
    useFetchDomainMock.mockImplementation(() => ({
      data: { domain: baseDomain },
      isLoading: false,
    }));
    useUpdateDomainMock.mockReturnValue({
      mutate,
      error: null,
      isLoading: false,
    });

    render(
      <DomainSettings
        domain={baseDomain}
        closeModal={jest.fn()}
        availableScrapers={[{ label: "SerpApi", value: "serpapi" }]}
      />
    );

    fireEvent.click(screen.getByText("Scraping"));
    fireEvent.change(screen.getByTestId("input-Subdomain Matching"), {
      target: { value: "blog,*" },
    });
    fireEvent.click(screen.getByText("Update Settings"));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        domainSettings: expect.objectContaining({
          subdomain_matching: "blog,*",
        }),
      })
    );
  });
});
