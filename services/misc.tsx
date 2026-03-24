import { useQuery } from "react-query";

const GITHUB_REPO = "gigerIT/serpbear";

export async function fetchChangelog() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases`,
    { method: "GET" }
  );
  return res.json();
}

export function useFetchChangelog() {
  return useQuery("changelog", () => fetchChangelog(), {
    cacheTime: 60 * 60 * 1000,
  });
}
