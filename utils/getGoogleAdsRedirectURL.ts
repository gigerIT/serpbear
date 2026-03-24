import type { NextApiRequest } from 'next';

type HeaderValue = string | string[] | undefined;

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

const getGoogleAdsRedirectURL = (req: Pick<NextApiRequest, 'headers'>) => `${getRequestOrigin(req)}/api/adwords`;

export default getGoogleAdsRedirectURL;
