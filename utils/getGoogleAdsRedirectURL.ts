import type { NextApiRequest } from 'next';

type HeaderValue = string | string[] | undefined;
type RequestWithSecurity = Pick<NextApiRequest, 'headers' | 'socket'> & {
  connection?: unknown;
};

type MaybeEncrypted = {
  encrypted?: boolean;
};

const getHeaderValue = (value: HeaderValue) => {
  if (Array.isArray(value)) {
    return value[0]?.trim();
  }

  return value?.split(',')[0]?.trim();
};

export const getRequestOrigin = (req: Pick<NextApiRequest, 'headers'>) => {
  const forwardedProto = getHeaderValue(req.headers['x-forwarded-proto']);
  const forwardedHost = getHeaderValue(req.headers['x-forwarded-host']);
  const host = forwardedHost || getHeaderValue(req.headers.host) || 'localhost:3000';
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');

  return `${protocol}://${host}`;
};

export const isSecureRequest = (req: RequestWithSecurity) => {
  const forwardedProto = getHeaderValue(req.headers['x-forwarded-proto']);
  if (forwardedProto) {
    return forwardedProto === 'https';
  }

  const socket = req.socket as MaybeEncrypted | undefined;
  const connection = req.connection as MaybeEncrypted | undefined;
  return !!(socket?.encrypted || connection?.encrypted);
};

const getGoogleAdsRedirectURL = (req: Pick<NextApiRequest, 'headers'>) =>
  `${getRequestOrigin(req)}/api/adwords`;

export default getGoogleAdsRedirectURL;
