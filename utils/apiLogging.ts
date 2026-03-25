import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { logger } from "./logger";

type ApiLoggingOptions = {
  name?: string;
};

type ExtendedApiRequest = NextApiRequest & {
  requestId?: string;
};

export const withApiLogging = (
  handler: NextApiHandler,
  options: ApiLoggingOptions = {}
): NextApiHandler => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    (req as ExtendedApiRequest).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    logger.info(
      `${req.method} ${req.url}${options.name ? ` [${options.name}]` : ""}`
    );

    try {
      await handler(req, res);
      logger.info(
        `${req.method} ${req.url}${
          options.name ? ` [${options.name}]` : ""
        } - ${res.statusCode} (${Date.now() - startTime}ms)`
      );
    } catch (error) {
      logger.error(
        `${req.method} ${req.url}${
          options.name ? ` [${options.name}]` : ""
        } - Exception`,
        error instanceof Error ? error : new Error(String(error)),
        { requestId }
      );

      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
};

export default withApiLogging;
