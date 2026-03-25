import { OAuth2Client } from 'google-auth-library';

const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';

type GoogleAdsAuthUrlOptions = {
  clientID: string;
  clientSecret: string;
  redirectURL: string;
  state?: string;
};

export const getGoogleAdsOAuthClient = ({
  clientID,
  clientSecret,
  redirectURL,
}: GoogleAdsAuthUrlOptions) =>
  new OAuth2Client(clientID, clientSecret, redirectURL);

export const getGoogleAdsAuthURL = ({
  clientID,
  clientSecret,
  redirectURL,
  state,
}: GoogleAdsAuthUrlOptions) => {
  const client = getGoogleAdsOAuthClient({
    clientID,
    clientSecret,
    redirectURL,
  });
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [GOOGLE_ADS_SCOPE],
    state,
  });
};

export default getGoogleAdsAuthURL;
