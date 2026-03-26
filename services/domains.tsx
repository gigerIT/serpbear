import { useRouter, NextRouter } from "next/router";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "react-query";

type UpdatePayload = {
  domainSettings: DomainSettings;
  domain: DomainType;
};

const syncUpdatedDomainCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  updatedDomain: DomainType
) => {
  const domainListQueries = queryClient.getQueriesData<{
    domains: DomainType[];
  }>({
    queryKey: ["domains"],
  });

  domainListQueries.forEach(([key, data]) => {
    if (!data?.domains) {
      return;
    }

    queryClient.setQueryData(key, {
      ...data,
      domains: data.domains.map((domain) =>
        domain.ID === updatedDomain.ID
          ? { ...domain, ...updatedDomain }
          : domain
      ),
    });
  });

  queryClient.setQueryData(["domain", updatedDomain.domain], {
    domain: updatedDomain,
  });
};

export async function fetchDomains(
  router: NextRouter,
  withStats: boolean
): Promise<{ domains: DomainType[] }> {
  const res = await fetch(
    `${window.location.origin}/api/domains${
      withStats ? "?withstats=true" : ""
    }`,
    { method: "GET" }
  );
  if (res.status >= 400 && res.status < 600) {
    if (res.status === 401) {
      console.log("Unauthorized!!");
      router.push("/login");
    }
    throw new Error("Bad response from server");
  }
  return res.json();
}

export async function fetchDomain(
  router: NextRouter,
  domainName: string
): Promise<{ domain: DomainType }> {
  if (!domainName) {
    throw new Error("No Domain Name Provided!");
  }
  const encodedDomain = encodeURIComponent(domainName);
  const res = await fetch(
    `${window.location.origin}/api/domain?domain=${encodedDomain}`,
    { method: "GET" }
  );
  if (res.status >= 400 && res.status < 600) {
    if (res.status === 401) {
      console.log("Unauthorized!!");
      router.push("/login");
    }
    throw new Error("Bad response from server");
  }
  return res.json();
}

export async function fetchDomainScreenshot(
  domain: string,
  screenshot_key: string,
  forceFetch = false
): Promise<string | false> {
  const domainThumbsRaw = localStorage.getItem("domainThumbs");
  const domThumbs = domainThumbsRaw ? JSON.parse(domainThumbsRaw) : {};
  if (!domThumbs[domain] || forceFetch) {
    try {
      const screenshotURL = `https://image.thum.io/get/auth/${screenshot_key}/maxAge/96/width/200/https://${domain}`;
      const domainImageRes = await fetch(screenshotURL);
      const domainImageBlob =
        domainImageRes.status === 200 ? await domainImageRes.blob() : false;
      if (domainImageBlob) {
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = resolve;
          reader.onerror = reject;
          reader.readAsDataURL(domainImageBlob);
        });
        const imageBase: string =
          reader.result && typeof reader.result === "string"
            ? reader.result
            : "";
        localStorage.setItem(
          "domainThumbs",
          JSON.stringify({ ...domThumbs, [domain]: imageBase })
        );
        return imageBase;
      }
      return false;
    } catch (error) {
      return false;
    }
  } else if (domThumbs[domain]) {
    return domThumbs[domain];
  }

  return false;
}

export function useFetchDomains(
  router: NextRouter,
  withStats: boolean = false
) {
  return useQuery(["domains", withStats], () =>
    fetchDomains(router, withStats)
  );
}

export function useFetchDomain(
  router: NextRouter,
  domainName: string,
  onSuccess: Function
) {
  return useQuery(
    ["domain", domainName],
    () => fetchDomain(router, domainName),
    {
      enabled: !!domainName,
      onSuccess: async (data) => {
        console.log("Domain Loaded!!!", data.domain);
        onSuccess(data.domain);
      },
    }
  );
}

export function useAddDomain(onSuccess: Function) {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation(
    async (domains: string[]) => {
      const headers = new Headers({
        "Content-Type": "application/json",
        Accept: "application/json",
      });
      const fetchOpts = {
        method: "POST",
        headers,
        body: JSON.stringify({ domains }),
      };
      const res = await fetch(
        `${window.location.origin}/api/domains`,
        fetchOpts
      );
      if (res.status >= 400 && res.status < 600) {
        throw new Error("Bad response from server");
      }
      return res.json();
    },
    {
      onSuccess: async (data) => {
        console.log("Domain Added!!!", data);
        const newDomain: DomainType[] = data.domains;
        const singleDomain = newDomain.length === 1;
        toast(
          `${
            singleDomain ? newDomain[0].domain : `${newDomain.length} domains`
          } Added Successfully!`,
          { icon: "✔️" }
        );
        onSuccess(false);
        if (singleDomain) {
          router.push(`/domain/${newDomain[0].slug}`);
        }
        queryClient.invalidateQueries(["domains"]);
      },
      onError: () => {
        console.log("Error Adding New Domain!!!");
        toast("Error Adding New Domain");
      },
    }
  );
}

export function useUpdateDomain(onSuccess: Function) {
  const queryClient = useQueryClient();
  return useMutation(
    async ({ domainSettings, domain }: UpdatePayload) => {
      const headers = new Headers({
        "Content-Type": "application/json",
        Accept: "application/json",
      });
      const fetchOpts = {
        method: "PUT",
        headers,
        body: JSON.stringify(domainSettings),
      };
      const res = await fetch(
        `${window.location.origin}/api/domains?domain=${encodeURIComponent(
          domain.domain
        )}`,
        fetchOpts
      );
      const responseObj = await res.json();
      if (res.status >= 400 && res.status < 600) {
        throw new Error(responseObj?.error || "Bad response from server");
      }
      return responseObj;
    },
    {
      onSuccess: async (data, variables) => {
        console.log("Settings Updated!!!");
        toast("Settings Updated!", { icon: "✔️" });
        if (data?.domain) {
          syncUpdatedDomainCaches(queryClient, data.domain);
        }
        onSuccess();
        queryClient.invalidateQueries(["domains"]);
        queryClient.invalidateQueries(["domain", variables.domain.domain]);
      },
      onError: (error) => {
        console.log("Error Updating Domain Settings!!!", error);
        toast("Error Updating Domain Settings", { icon: "⚠️" });
      },
    }
  );
}

export function useDeleteDomain(onSuccess: Function) {
  const queryClient = useQueryClient();
  return useMutation(
    async (domain: DomainType) => {
      const res = await fetch(
        `${window.location.origin}/api/domains?domain=${encodeURIComponent(
          domain.domain
        )}`,
        { method: "DELETE" }
      );
      if (res.status >= 400 && res.status < 600) {
        throw new Error("Bad response from server");
      }
      return res.json();
    },
    {
      onSuccess: async () => {
        toast("Domain Removed Successfully!", { icon: "✔️" });
        onSuccess();
        queryClient.invalidateQueries(["domains"]);
      },
      onError: () => {
        console.log("Error Removing Domain!!!");
        toast("Error Removing Domain", { icon: "⚠️" });
      },
    }
  );
}
