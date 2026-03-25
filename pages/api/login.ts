import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import Cookies from "cookies";
import { isSecureRequest } from "../../utils/getGoogleAdsRedirectURL";

type loginResponse = {
  success?: boolean;
  error?: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    return loginUser(req, res);
  }
  return res.status(405).json({ success: false, error: "Method not allowed" });
}

const safeCompare = (left: string, right: string): boolean => {
  const maxLength = 256;
  const leftBuffer = new Uint8Array(
    Buffer.from(left.padEnd(maxLength, "\0").slice(0, maxLength))
  );
  const rightBuffer = new Uint8Array(
    Buffer.from(right.padEnd(maxLength, "\0").slice(0, maxLength))
  );
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const loginUser = async (
  req: NextApiRequest,
  res: NextApiResponse<loginResponse>
) => {
  if (!req.body.username || !req.body.password) {
    return res.status(401).json({ error: "Username Password Missing" });
  }
  const userName = process.env.USER_NAME
    ? process.env.USER_NAME
    : process.env.USER;

  if (!userName || !process.env.PASSWORD || !process.env.SECRET) {
    return res.status(500).json({
      success: false,
      error: "Server configuration error",
    });
  }

  if (
    safeCompare(req.body.username, userName) &&
    safeCompare(req.body.password, process.env.PASSWORD)
  ) {
    const sessDuration = process.env.SESSION_DURATION;
    const sessionDurationHours = Math.max(
      parseInt(sessDuration || "", 10) || 24,
      1
    );
    const sessionMaxAge = sessionDurationHours * 60 * 60 * 1000;
    const token = jwt.sign({ user: userName }, process.env.SECRET, {
      expiresIn: `${sessionDurationHours}h`,
    });
    const cookies = new Cookies(req, res);
    cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(req),
      path: "/",
      maxAge: sessionMaxAge,
    });
    return res.status(200).json({ success: true, error: null });
  }

  return res.status(401).json({ success: false, error: "Invalid credentials" });
};
