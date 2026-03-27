import { useRouter } from "next/router";
import { useState } from "react";
import Icon from "../common/Icon";
import Modal from "../common/Modal";
import {
  useDeleteDomain,
  useFetchDomain,
  useUpdateDomain,
} from "../../services/domains";
import InputField from "../common/InputField";
import SecretField from "../common/SecretField";
import SelectField, { SelectionOption } from "../common/SelectField";
import ToggleField from "../common/ToggleField";

type DomainSettingsProps = {
  domain: DomainType | false;
  closeModal: Function;
  availableScrapers?: SettingsType["available_scrapers"];
  systemScraperType?: string;
};

type DomainSettingsError = {
  type: string;
  msg: string;
};

const defaultSearchConsoleSettings: DomainSearchConsole = {
  property_type: "domain",
  url: "",
  client_email: "",
  private_key: "",
};

const parseSearchConsoleSettings = (
  raw: DomainType["search_console"]
): DomainSearchConsole => {
  if (!raw) {
    return { ...defaultSearchConsoleSettings };
  }

  try {
    return {
      ...defaultSearchConsoleSettings,
      ...JSON.parse(raw),
    };
  } catch (_error) {
    return { ...defaultSearchConsoleSettings };
  }
};

const DomainSettings = ({
  domain,
  closeModal,
  availableScrapers = [],
  systemScraperType = "",
}: DomainSettingsProps) => {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<
    "notification" | "searchconsole" | "scraping"
  >("notification");
  const [showRemoveDomain, setShowRemoveDomain] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<DomainSettingsError>({
    type: "",
    msg: "",
  });
  const [domainSettings, setDomainSettings] = useState<DomainSettings>(() => ({
    notification_interval:
      domain && domain.notification_interval
        ? domain.notification_interval
        : "never",
    notification_emails:
      domain && domain.notification_emails ? domain.notification_emails : "",
    search_console: parseSearchConsoleSettings(
      domain && domain.search_console ? domain.search_console : undefined
    ),
    scraper_settings: {
      scraper_type: (domain && domain.scraper_settings?.scraper_type) || null,
      has_api_key: domain && domain.scraper_settings?.has_api_key === true,
      scraping_api: "",
    },
    scrape_strategy:
      (domain && (domain.scrape_strategy as ScrapeStrategy | "" | undefined)) ||
      "",
    scrape_pagination_limit: (domain && domain.scrape_pagination_limit) || 0,
    scrape_smart_full_fallback:
      (domain && domain.scrape_smart_full_fallback) || false,
    subdomain_matching: (domain && domain.subdomain_matching) || "",
  }));

  const {
    mutate: updateMutate,
    error: domainUpdateError,
    isLoading: isUpdating,
  } = useUpdateDomain(() => closeModal(false));
  const { mutate: deleteMutate } = useDeleteDomain(() => {
    closeModal(false);
    router.push("/domains");
  });

  // Get the Full Domain Data along with the Search Console API Data.
  useFetchDomain(
    router,
    domain && domain.domain ? domain.domain : "",
    (domainObj: DomainType) => {
      const currentSearchConsoleSettings = parseSearchConsoleSettings(
        domainObj.search_console
      );
      setDomainSettings((currentSettings) => ({
        ...currentSettings,
        search_console:
          currentSearchConsoleSettings || currentSettings.search_console,
        scraper_settings: {
          scraper_type: domainObj.scraper_settings?.scraper_type || null,
          has_api_key: domainObj.scraper_settings?.has_api_key === true,
          scraping_api: currentSettings.scraper_settings?.scraping_api || "",
        },
        subdomain_matching:
          typeof domainObj.subdomain_matching === "string"
            ? domainObj.subdomain_matching
            : currentSettings.subdomain_matching || "",
      }));
    }
  );

  const hasScraperOverride = Boolean(
    domainSettings.scraper_settings?.scraper_type
  );
  const hasStoredScraperKey =
    domainSettings.scraper_settings?.has_api_key === true;
  const scraperKeyInput = domainSettings.scraper_settings?.scraping_api || "";

  const buildDomainSettingsPayload = (): DomainSettings => {
    const payload: DomainSettings = {
      ...domainSettings,
      search_console: domainSettings.search_console,
      scrape_strategy: domainSettings.scrape_strategy || "",
      scrape_pagination_limit: domainSettings.scrape_pagination_limit || 0,
      scrape_smart_full_fallback: !!domainSettings.scrape_smart_full_fallback,
      subdomain_matching: domainSettings.subdomain_matching || "",
    };

    const scraperSettings = domainSettings.scraper_settings;

    if (!scraperSettings || !scraperSettings.scraper_type) {
      payload.scraper_settings = null;
      return payload;
    }

    const nextScraperSettings: DomainScraperSettings = {
      scraper_type: scraperSettings.scraper_type,
    };
    const trimmedKey = (scraperSettings.scraping_api || "").trim();

    if (trimmedKey) {
      nextScraperSettings.scraping_api = trimmedKey;
    }

    if (!trimmedKey && scraperSettings.clear_api_key) {
      nextScraperSettings.clear_api_key = true;
    }

    payload.scraper_settings = nextScraperSettings;

    return payload;
  };

  const handleScraperSelect = (updated: string[]) => {
    const scraperType = updated[0] || null;

    setDomainSettings((currentSettings) => {
      const currentScraperSettings = currentSettings.scraper_settings || {
        scraper_type: null,
        has_api_key: false,
        scraping_api: "",
      };
      const keepExisting = currentScraperSettings.scraper_type === scraperType;

      return {
        ...currentSettings,
        scraper_settings: scraperType
          ? {
              scraper_type: scraperType,
              scraping_api: keepExisting
                ? currentScraperSettings.scraping_api || ""
                : "",
              has_api_key: keepExisting
                ? currentScraperSettings.has_api_key === true
                : false,
              clear_api_key: false,
            }
          : null,
      };
    });
  };

  const handleScraperKeyChange = (value: string) => {
    setDomainSettings((currentSettings) => ({
      ...currentSettings,
      scraper_settings: {
        ...(currentSettings.scraper_settings as DomainScraperSettings),
        scraping_api: value,
        clear_api_key: false,
      },
    }));
  };

  const updateDomain = () => {
    let error: DomainSettingsError | null = null;
    if (domainSettings.notification_emails) {
      const notification_emails = domainSettings.notification_emails.split(",");
      const invalidEmails = notification_emails.find(
        (x) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,15})+$/.test(x) === false
      );
      console.log("invalidEmails: ", invalidEmails);
      if (invalidEmails) {
        error = { type: "email", msg: "Invalid Email" };
      }
    }
    if (domainSettings.scraper_settings?.scraper_type) {
      if (!scraperKeyInput.trim() && !hasStoredScraperKey) {
        error = {
          type: "scraper",
          msg: "API key is required for the selected scraper.",
        };
      }
    }
    if (error && error.type) {
      console.log("Error!!!!!");
      setSettingsError(error);
      setTimeout(() => {
        setSettingsError({ type: "", msg: "" });
      }, 3000);
    } else if (domain) {
      updateMutate({ domainSettings: buildDomainSettingsPayload(), domain });
    }
  };

  const tabStyle = `inline-block px-4 py-2 rounded-md mr-3 cursor-pointer text-sm select-none z-10
                     text-gray-600 border border-b-0 relative top-[1px] rounded-b-none`;
  const strategyOptions: SelectionOption[] = [
    { label: "Use Global Setting", value: "" },
    { label: "Basic (First page only — 10 results)", value: "basic" },
    { label: "Custom (Set number of pages)", value: "custom" },
    { label: "Smart (Based on last known position)", value: "smart" },
  ];
  const scraperOptions: SelectionOption[] = [
    { label: "Use Global Scraper", value: "" },
    ...availableScrapers.map((scraper) => ({
      label: scraper.label,
      value: scraper.value,
    })),
  ];
  const paginationLimitOptions: SelectionOption[] = Array.from(
    { length: 10 },
    (_, i) => ({
      label: `${i + 1} Page${i > 0 ? "s" : ""}`,
      value: String(i + 1),
    })
  );
  return (
    <div>
      <Modal
        closeModal={() => closeModal(false)}
        title={"Domain Settings"}
        width="[500px]"
        verticalCenter={currentTab === "searchconsole"}
      >
        <div data-testid="domain_settings" className=" text-sm">
          <div
            className=" mt-3 mb-5 border  border-slate-200 px-2 py-4 pb-0
               relative left-[-20px] w-[calc(100%+40px)] border-l-0 border-r-0 bg-[#f8f9ff]"
          >
            <ul>
              <li
                className={`${tabStyle} ${
                  currentTab === "notification"
                    ? " bg-white text-blue-600 border-slate-200"
                    : "border-transparent"
                } `}
                onClick={() => setCurrentTab("notification")}
              >
                <Icon type="email" /> Notification
              </li>
              <li
                className={`${tabStyle} ${
                  currentTab === "searchconsole"
                    ? " bg-white text-blue-600 border-slate-200"
                    : "border-transparent"
                }`}
                onClick={() => setCurrentTab("searchconsole")}
              >
                <Icon type="google" /> Search Console
              </li>
              <li
                className={`${tabStyle} ${
                  currentTab === "scraping"
                    ? " bg-white text-blue-600 border-slate-200"
                    : "border-transparent"
                }`}
                onClick={() => setCurrentTab("scraping")}
              >
                <Icon type="refresh" /> Scraping
              </li>
            </ul>
          </div>

          <div>
            {currentTab === "notification" && (
              <div className="mb-4 flex justify-between items-center w-full">
                <InputField
                  label="Notification Emails"
                  onChange={(emails: string) =>
                    setDomainSettings({
                      ...domainSettings,
                      notification_emails: emails,
                    })
                  }
                  value={domainSettings.notification_emails || ""}
                  placeholder="Your Emails"
                />
              </div>
            )}
            {currentTab === "searchconsole" && (
              <>
                <div className="mb-4 flex justify-between items-center w-full">
                  <label className="mb-2 font-semibold inline-block text-sm text-gray-700 capitalize">
                    Property Type
                  </label>
                  <SelectField
                    options={[
                      { label: "Domain", value: "domain" },
                      { label: "URL", value: "url" },
                    ]}
                    selected={[
                      domainSettings.search_console?.property_type || "domain",
                    ]}
                    defaultLabel="Select Search Console Property Type"
                    updateField={(updated: ["domain" | "url"]) =>
                      setDomainSettings({
                        ...domainSettings,
                        search_console: {
                          ...(domainSettings.search_console as DomainSearchConsole),
                          property_type: updated[0] || "domain",
                        },
                      })
                    }
                    multiple={false}
                    rounded={"rounded"}
                  />
                </div>
                {domainSettings?.search_console?.property_type === "url" && (
                  <div className="mb-4 flex justify-between items-center w-full">
                    <InputField
                      label="Property URL (Required)"
                      onChange={(url: string) =>
                        setDomainSettings({
                          ...domainSettings,
                          search_console: {
                            ...(domainSettings.search_console as DomainSearchConsole),
                            url,
                          },
                        })
                      }
                      value={domainSettings?.search_console?.url || ""}
                      placeholder="Search Console Property URL. eg: https://mywebsite.com/"
                    />
                  </div>
                )}
                <div className="mb-4 flex justify-between items-center w-full">
                  <InputField
                    label="Search Console Client Email"
                    onChange={(client_email: string) =>
                      setDomainSettings({
                        ...domainSettings,
                        search_console: {
                          ...(domainSettings.search_console as DomainSearchConsole),
                          client_email,
                        },
                      })
                    }
                    value={domainSettings?.search_console?.client_email || ""}
                    placeholder="myapp@appspot.gserviceaccount.com"
                  />
                </div>
                <div className="mb-4 flex flex-col justify-between items-center w-full">
                  <label className="mb-2 font-semibold block text-sm text-gray-700 capitalize w-full">
                    Search Console Private Key
                  </label>
                  <textarea
                    className={`w-full p-2 border border-gray-200 rounded mb-3 text-xs 
                              focus:outline-none h-[100px] focus:border-blue-200`}
                    value={domainSettings?.search_console?.private_key || ""}
                    placeholder={
                      "-----BEGIN PRIVATE KEY-----/ssssaswdkihad...."
                    }
                    onChange={(event) =>
                      setDomainSettings({
                        ...domainSettings,
                        search_console: {
                          ...(domainSettings.search_console as DomainSearchConsole),
                          private_key: event.target.value,
                        },
                      })
                    }
                  />
                </div>
              </>
            )}
            {currentTab === "scraping" && (
              <div className="mb-4">
                <div className="mb-4">
                  <InputField
                    label="Subdomain Matching"
                    onChange={(value: string) =>
                      setDomainSettings({
                        ...domainSettings,
                        subdomain_matching: value,
                      })
                    }
                    value={domainSettings.subdomain_matching || ""}
                    placeholder="amp, blog, *"
                  />
                </div>
                <div className="mb-5">
                  <SelectField
                    label="Scraper Override"
                    options={scraperOptions}
                    selected={[
                      domainSettings.scraper_settings?.scraper_type || "",
                    ]}
                    defaultLabel="Use Global Scraper"
                    updateField={handleScraperSelect}
                    multiple={false}
                    rounded={"rounded"}
                    minWidth={220}
                  />
                  {systemScraperType && (
                    <small className="text-gray-500 pt-2 block">
                      Global scraper: {systemScraperType}
                    </small>
                  )}
                </div>
                {hasScraperOverride && (
                  <div className="mb-5">
                    <SecretField
                      label="Scraper API Key Override"
                      value={scraperKeyInput}
                      onChange={handleScraperKeyChange}
                      placeholder={
                        hasStoredScraperKey
                          ? "API key stored (leave blank to keep existing)"
                          : "Enter API key"
                      }
                      hasError={settingsError?.type === "scraper"}
                    />
                    {hasStoredScraperKey && !scraperKeyInput && (
                      <p className="mt-2 text-xs text-gray-500">
                        An API key is already stored for this domain.
                      </p>
                    )}
                    {hasStoredScraperKey && (
                      <button
                        className="mt-2 text-xs text-red-500 font-semibold"
                        onClick={() =>
                          setDomainSettings((currentSettings) => ({
                            ...currentSettings,
                            scraper_settings: {
                              ...(currentSettings.scraper_settings as DomainScraperSettings),
                              scraping_api: "",
                              has_api_key: false,
                              clear_api_key: true,
                            },
                          }))
                        }
                      >
                        Clear saved API key
                      </button>
                    )}
                  </div>
                )}
                <div className="mb-5">
                  <SelectField
                    label="Scrape Strategy Override"
                    options={strategyOptions}
                    selected={[domainSettings.scrape_strategy || ""]}
                    defaultLabel="Use Global Setting"
                    updateField={(updated: string[]) => {
                      setDomainSettings({
                        ...domainSettings,
                        scrape_strategy: (updated[0] || "") as
                          | ScrapeStrategy
                          | "",
                      });
                    }}
                    multiple={false}
                    rounded={"rounded"}
                    minWidth={220}
                  />
                </div>
                {domainSettings.scrape_strategy === "custom" && (
                  <div className="mb-5">
                    <SelectField
                      label="Number of Pages to Scrape"
                      options={paginationLimitOptions}
                      selected={[
                        String(domainSettings.scrape_pagination_limit || 5),
                      ]}
                      defaultLabel="Select Page Count"
                      updateField={(updated: string[]) => {
                        setDomainSettings({
                          ...domainSettings,
                          scrape_pagination_limit: parseInt(
                            updated[0] || "5",
                            10
                          ),
                        });
                      }}
                      multiple={false}
                      rounded={"rounded"}
                      minWidth={220}
                    />
                    <small className="text-gray-500 pt-2 block">
                      Each page returns up to 10 results.
                    </small>
                  </div>
                )}
                {domainSettings.scrape_strategy === "smart" && (
                  <div className="mb-5">
                    <ToggleField
                      label="Full Fallback: Scrape all pages if not found on nearby pages"
                      value={!!domainSettings.scrape_smart_full_fallback}
                      onChange={(val: boolean) => {
                        setDomainSettings({
                          ...domainSettings,
                          scrape_smart_full_fallback: val,
                        });
                      }}
                    />
                    <small className="text-gray-500 pt-2 block">
                      When enabled, all 10 pages are scraped if the keyword is
                      missing from its nearby pages.
                    </small>
                  </div>
                )}
              </div>
            )}
          </div>
          {!isUpdating && (domainUpdateError as Error)?.message && (
            <div className="w-full mt-4 p-3 text-sm bg-red-50 text-red-700">
              {(domainUpdateError as Error).message}
            </div>
          )}
          {!isUpdating && settingsError?.msg && (
            <div className="w-full mt-4 p-3 text-sm bg-red-50 text-red-700">
              {settingsError.msg}
            </div>
          )}
        </div>

        <div className="flex justify-between border-t-[1px] border-gray-100 mt-8 pt-4 pb-0">
          <button
            className="text-sm font-semibold text-red-500"
            onClick={() => setShowRemoveDomain(true)}
          >
            <Icon type="trash" /> Remove Domain
          </button>
          <button
            className={`text-sm font-semibold py-2 px-5 rounded cursor-pointer bg-blue-700 text-white ${
              isUpdating ? "cursor-not-allowed" : ""
            }`}
            onClick={() => !isUpdating && updateDomain()}
          >
            {isUpdating && <Icon type="loading" />} Update Settings
          </button>
        </div>
      </Modal>
      {showRemoveDomain && domain && (
        <Modal
          closeModal={() => setShowRemoveDomain(false)}
          title={`Remove Domain ${domain.domain}`}
        >
          <div className="text-sm">
            <p>
              Are you sure you want to remove this Domain? Removing this domain
              will remove all its keywords.
            </p>
            <div className="mt-6 text-right font-semibold">
              <button
                className=" py-1 px-5 rounded cursor-pointer bg-indigo-50 text-slate-500 mr-3"
                onClick={() => setShowRemoveDomain(false)}
              >
                Cancel
              </button>
              <button
                className=" py-1 px-5 rounded cursor-pointer bg-red-400 text-white"
                onClick={() => deleteMutate(domain)}
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DomainSettings;
