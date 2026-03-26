import { act, renderHook, waitFor } from "@testing-library/react";
import mockRouter from "next-router-mock";
import toast from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "react-query";

import {
  useFetchDomain,
  useFetchDomains,
  useUpdateDomain,
} from "../../services/domains";
import { dummyDomain } from "../../__mocks__/data";

jest.mock("next/router", () => jest.requireActual("next-router-mock"));
jest.mock("react-hot-toast", () => jest.fn());

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const createWrapper = (queryClient = createTestQueryClient()) => {
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("DomainHooks", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("useFetchDomains should fetch the domains", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ domains: [dummyDomain] }),
    } as Response);

    const { result } = renderHook(() => useFetchDomains(mockRouter), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("useFetchDomain should refetch when the domain changes", async () => {
    const onSuccess = jest.fn();
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          domain: {
            ...dummyDomain,
            domain: "example.com",
            slug: "example-com",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          domain: {
            ...dummyDomain,
            domain: "second-example.com",
            slug: "second-example-com",
          },
        }),
      } as Response);

    const { rerender } = renderHook(
      ({ domainName }) => useFetchDomain(mockRouter, domainName, onSuccess),
      {
        initialProps: { domainName: "example.com" },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    rerender({ domainName: "second-example.com" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("domain=second-example.com"),
      { method: "GET" }
    );
  });

  it("useUpdateDomain should invalidate the updated single-domain query", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
    const onSuccess = jest.fn();
    const updatedDomain = {
      ...dummyDomain,
      scraper_settings: {
        scraper_type: "serpapi",
        has_api_key: true,
      },
    } as DomainType;

    queryClient.setQueryData(["domains", false], { domains: [dummyDomain] });
    queryClient.setQueryData(["domain", dummyDomain.domain], {
      domain: dummyDomain,
    });

    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ domain: updatedDomain }),
    } as Response);

    const { result } = renderHook(() => useUpdateDomain(onSuccess), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        domainSettings: {
          notification_interval: "daily",
          notification_emails: "",
          search_console: {
            property_type: "domain",
            url: "",
            client_email: "",
            private_key: "",
          },
          scraper_settings: {
            scraper_type: "serpapi",
            scraping_api: "new-key",
          },
        },
        domain: dummyDomain,
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(["domains"]);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith([
      "domain",
      dummyDomain.domain,
    ]);
    expect(queryClient.getQueryData(["domains", false])).toEqual({
      domains: [updatedDomain],
    });
    expect(queryClient.getQueryData(["domain", dummyDomain.domain])).toEqual({
      domain: updatedDomain,
    });
    expect(toast).toHaveBeenCalledWith("Settings Updated!", { icon: "✔️" });
  });
});
