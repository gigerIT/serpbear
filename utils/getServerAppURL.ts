const normalizeAppURL = (value: string): string =>
  value.trim().replace(/\/+$/, "");

export const getServerAppURL = (): string => {
  const configuredURL =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  return configuredURL ? normalizeAppURL(configuredURL) : "";
};

export default getServerAppURL;
