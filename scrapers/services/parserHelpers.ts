export const parseScraperResults = <T>(
  content: unknown,
  providerName: string,
  fallbackKeys: string[] = []
): T[] => {
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }

      if (parsed && typeof parsed === "object") {
        for (const key of fallbackKeys) {
          const candidate = (parsed as Record<string, unknown>)[key];
          if (Array.isArray(candidate)) {
            return candidate as T[];
          }
        }
      }

      return [];
    } catch (error) {
      throw new Error(
        `Invalid JSON response for ${providerName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (Array.isArray(content)) {
    return content as T[];
  }

  if (content && typeof content === "object") {
    for (const key of fallbackKeys) {
      const candidate = (content as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }

  return [];
};
