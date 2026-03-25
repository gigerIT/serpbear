export const isValidDomain = (domain: string): boolean => {
  if (typeof domain !== "string") return false;
  if (!domain.includes(".")) return false;
  let value = domain;
  const validHostnameChars = /^[a-zA-Z0-9-.]{1,253}\.?$/g;
  if (!validHostnameChars.test(value)) {
    return false;
  }

  if (value.endsWith(".")) {
    value = value.slice(0, value.length - 1);
  }

  if (value.length > 253) {
    return false;
  }

  const labels = value.split(".");

  const isValid = labels.every((label) => {
    const validLabelChars = /^([a-zA-Z0-9-]+)$/g;

    const validLabel =
      validLabelChars.test(label) &&
      label.length < 64 &&
      !label.startsWith("-") &&
      !label.endsWith("-");

    return validLabel;
  });

  return isValid;
};

export const isValidUrl = (str: string) => {
  let url;

  try {
    url = new URL(str);
  } catch (e) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
};

export const normalizeDomainInput = (value: string): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmedValue);

  try {
    const parsedUrl = new URL(
      hasScheme ? trimmedValue : `https://${trimmedValue}`
    );
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    const normalizedHost = parsedUrl.hostname.toLowerCase();
    if (!isValidDomain(normalizedHost)) {
      return null;
    }

    const normalizedPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, "");
    return normalizedPath
      ? `${normalizedHost}/${normalizedPath}`
      : normalizedHost;
  } catch {
    return null;
  }
};
