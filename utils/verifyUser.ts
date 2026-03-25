import type { NextApiRequest, NextApiResponse } from "next";
import Cookies from "cookies";
import jwt from "jsonwebtoken";

const getNormalizedRoute = (req: NextApiRequest): string => {
  const path = typeof req.url === "string" ? req.url.replace(/\?.*/, "") : "";
  return req.method && path ? `${req.method}:${path}` : "";
};

const verifyApiKey = (authorizationHeader: string | undefined): boolean => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return false;
  }

  const apiKey = authorizationHeader.slice("Bearer ".length);
  return Boolean(process.env.APIKEY) && apiKey === process.env.APIKEY;
};

/**
 * Psuedo Middleware: Verifies the user by their cookie value or their API Key
 * When accessing with API key only certain routes are accessible.
 * @param {NextApiRequest} req - The Next Request
 * @param {NextApiResponse} res - The Next Response.
 * @returns {string}
 */
const verifyUser = (req: NextApiRequest, res: NextApiResponse): string => {
  const cookies = new Cookies(req, res);
  const token = cookies && cookies.get("token");

  const allowedApiRoutes = [
    "GET:/api/keyword",
    "GET:/api/keywords",
    "POST:/api/keywords",
    "GET:/api/domains",
    "POST:/api/refresh",
    "POST:/api/cron",
    "POST:/api/notify",
    "POST:/api/searchconsole",
    "GET:/api/searchconsole",
    "GET:/api/insight",
  ];
  const normalizedRoute = getNormalizedRoute(req);
  const verifiedAPI = verifyApiKey(req.headers.authorization);
  const accessingAllowedRoute = allowedApiRoutes.includes(normalizedRoute);

  let authorized: string = "";
  if (token && process.env.SECRET) {
    try {
      jwt.verify(token, process.env.SECRET);
      authorized = "authorized";
    } catch {
      authorized =
        verifiedAPI && accessingAllowedRoute ? "authorized" : "Not authorized";
    }
  } else if (verifiedAPI && accessingAllowedRoute) {
    authorized = "authorized";
  } else {
    if (!token) {
      authorized = "Not authorized";
    }
    if (token && !process.env.SECRET) {
      authorized = "Token has not been Setup.";
    }
    if (verifiedAPI && !accessingAllowedRoute) {
      authorized = "This Route cannot be accessed with API.";
    }
    if (req.headers.authorization && !verifiedAPI) {
      authorized = "Invalid API Key Provided.";
    }
  }

  return authorized;
};

export default verifyUser;
