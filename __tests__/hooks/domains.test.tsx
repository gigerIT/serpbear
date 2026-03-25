import { renderHook, waitFor } from "@testing-library/react";
import mockRouter from "next-router-mock";

import { useFetchDomains } from "../../services/domains";
import { createWrapper } from "../../__mocks__/utils";
import { dummyDomain } from "../../__mocks__/data";

jest.mock("next/router", () => jest.requireActual("next-router-mock"));

describe("DomainHooks", () => {
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

  it("useFetchDomains should fetch the Domains", async () => {
    const { result } = renderHook(() => useFetchDomains(mockRouter), {
      wrapper: createWrapper(),
    });
    // const result = { current: { isSuccess: false, data: '' } };
    await waitFor(() => {
      return expect(result.current.isLoading).toBe(false);
    });
  });
});
