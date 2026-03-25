import type { NextApiRequest, NextApiResponse } from 'next';
import { readFile, writeFile } from 'fs/promises';
import Cryptr from 'cryptr';
import verifyUser from '../../../utils/verifyUser';
import getGoogleAdsRedirectURL from '../../../utils/getGoogleAdsRedirectURL';
import { getGoogleAdsAuthURL } from '../../../utils/googleAdsOAuth';
import { clearAdwordsAccessTokenCache } from '../../../utils/adwords';

type AdwordsAuthStartResponse = {
  authURL?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdwordsAuthStartResponse>,
) {
  const authorized = verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  if (req.method !== 'POST') {
    return res.status(502).json({ error: 'Unrecognized Route.' });
  }

  const clientID = typeof req.body?.client_id === 'string' ? req.body.client_id.trim() : '';
  const clientSecret = typeof req.body?.client_secret === 'string'
      ? req.body.client_secret.trim()
      : '';

  if (!clientID || !clientSecret) {
    return res.status(400).json({
      error: 'Please Provide the Google Ads Client ID and Client Secret',
    });
  }

  try {
    const settingsRaw = await readFile(`${process.cwd()}/data/settings.json`, {
      encoding: 'utf-8',
    });
    const settings: SettingsType = settingsRaw ? JSON.parse(settingsRaw) : {};
    const cryptr = new Cryptr(process.env.SECRET as string);
    const redirectURL = getGoogleAdsRedirectURL(req);
    const securedSettings = {
      ...settings,
      adwords_client_id: cryptr.encrypt(clientID),
      adwords_client_secret: cryptr.encrypt(clientSecret),
      adwords_refresh_token: '',
    };

    await writeFile(
      `${process.cwd()}/data/settings.json`,
      JSON.stringify(securedSettings),
      { encoding: 'utf-8' },
    );
    clearAdwordsAccessTokenCache();

    return res.status(200).json({
      authURL: getGoogleAdsAuthURL({ clientID, clientSecret, redirectURL }),
    });
  } catch (error) {
    console.log('[ERROR] Starting Google Ads OAuth Flow: ', error);
    return res.status(400).json({
      error: 'Error Starting Google Ads OAuth Flow. Please Try Again!',
    });
  }
}
