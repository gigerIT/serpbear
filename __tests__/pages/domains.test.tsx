import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import * as ReactQuery from "react-query";
import { dummyDomain } from "../../__mocks__/data";
import Domains from "../../pages/domains";

jest.mock("next/router", () => jest.requireActual("next-router-mock"));
jest.spyOn(ReactQuery, "useQuery").mockImplementation(
  jest.fn().mockReturnValue({
    data: { domains: [dummyDomain] },
    isLoading: false,
    isSuccess: true,
  })
);

describe("Domains Page", () => {
  const queryClient = new QueryClient();

  beforeEach(() => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ domains: [dummyDomain] }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Renders without crashing", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Domains />
      </QueryClientProvider>
    );
    expect(screen.getByTestId("domains")).toBeInTheDocument();
  });
  it("Renders the Domain Component", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Domains />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(container.querySelector(".domItem")).toBeInTheDocument();
    });
  });
  it("Should Display Add Domain Modal on relveant Button Click.", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Domains />
      </QueryClientProvider>
    );
    const button = screen.getByTestId("addDomainButton");
    if (button) fireEvent.click(button);
    expect(screen.getByTestId("adddomain_modal")).toBeVisible();
  });
  it("Should Display the version number in Footer.", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Domains />
      </QueryClientProvider>
    );
    expect(screen.getByText("SerpBear v0.0.0")).toBeVisible();
  });
});
