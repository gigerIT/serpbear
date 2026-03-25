type SafeJsonParseOptions = {
  context?: string;
  logError?: boolean;
};

export const safeJsonParse = <T>(
  value: string,
  fallback: T,
  options: SafeJsonParseOptions = {}
): T => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    if (options.logError) {
      const context = options.context ? ` for ${options.context}` : "";
      console.error(`Failed to parse JSON${context}`, error);
    }
    return fallback;
  }
};

export default safeJsonParse;
