import getGoogleAdsRedirectURL, {
  getRequestOrigin,
  isSecureRequest,
} from '../../utils/getGoogleAdsRedirectURL';

describe('getGoogleAdsRedirectURL', () => {
  it('prefers forwarded headers behind a reverse proxy', () => {
    const req = {
      headers: {
        host: 'internal:3000',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'serp.example.com',
      },
    };

    expect(getRequestOrigin(req as any)).toBe('https://serp.example.com');
    expect(getGoogleAdsRedirectURL(req as any)).toBe(
      'https://serp.example.com/api/adwords',
    );
  });

  it('uses the first forwarded value when proxies append multiple entries', () => {
    const req = {
      headers: {
        host: 'internal:3000',
        'x-forwarded-proto': 'https,http',
        'x-forwarded-host': 'serp.example.com,internal:3000',
      },
    };

    expect(getGoogleAdsRedirectURL(req as any)).toBe(
      'https://serp.example.com/api/adwords',
    );
  });

  it('only marks requests secure when https reaches the app or proxy headers say so', () => {
    const proxiedReq = {
      headers: {
        host: 'internal:3000',
        'x-forwarded-proto': 'https',
      },
      socket: {},
    };
    const directTlsReq = {
      headers: {
        host: 'serp.example.com',
      },
      socket: {
        encrypted: true,
      },
    };
    const publicHostWithoutProxyHeaders = {
      headers: {
        host: 'serp.example.com',
      },
      socket: {},
    };

    expect(isSecureRequest(proxiedReq as any)).toBe(true);
    expect(isSecureRequest(directTlsReq as any)).toBe(true);
    expect(isSecureRequest(publicHostWithoutProxyHeaders as any)).toBe(false);
  });

  it('falls back to the request host and localhost protocol heuristic', () => {
    const localReq = { headers: { host: 'localhost:3000' } };
    const publicReq = { headers: { host: 'app.example.com' } };

    expect(getGoogleAdsRedirectURL(localReq as any)).toBe(
      'http://localhost:3000/api/adwords',
    );
    expect(getGoogleAdsRedirectURL(publicReq as any)).toBe(
      'https://app.example.com/api/adwords',
    );
  });
});
