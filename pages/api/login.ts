import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import Cookies from "cookies";
import { getRequestOrigin } from "../../utils/getGoogleAdsRedirectURL";

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
  return res.status(401).json({ success: false, error: "Invalid Method" });
}

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

  if (
    req.body.username === userName &&
    req.body.password === process.env.PASSWORD &&
    process.env.SECRET
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
      secure: getRequestOrigin(req).startsWith("https://"),
      path: "/",
      maxAge: sessionMaxAge,
    });
    return res.status(200).json({ success: true, error: null });
  }

  const error =
    req.body.username !== userName
      ? "Incorrect Username"
      : "Incorrect Password";

  return res.status(401).json({ success: false, error });
};
