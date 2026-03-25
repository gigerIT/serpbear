import type { NextApiRequest, NextApiResponse } from 'next';

const mockState = {
  getToken: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  decrypt: jest.fn((value: string) => `decrypted-${value}`),
  encrypt: jest.fn((value: string) => `encrypted-${value}`),
  clearAdwordsAccessTokenCache: jest.fn(),
  cookieSet: jest.fn(),
  cookieGet: jest.fn(),
};

jest.mock('cookies', () =>
  jest.fn().mockImplementation(() => ({
    set: mockState.cookieSet,
    get: mockState.cookieGet,
  })),
);

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({
    getToken: mockState.getToken,
  })),
}));

jest.mock('fs/promises', () => ({
  readFile: mockState.readFile,
  writeFile: mockState.writeFile,
}));

jest.mock('../../../database/database', () => ({
  __esModule: true,
  default: {
    sync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../utils/verifyUser', () => ({
  __esModule: true,
  default: jest.fn(() => 'authorized'),
}));

jest.mock('cryptr', () =>
  jest.fn().mockImplementation(() => ({
    decrypt: mockState.decrypt,
    encrypt: mockState.encrypt,
  })),
);

jest.mock('../../../utils/adwords', () => ({
  clearAdwordsAccessTokenCache: mockState.clearAdwordsAccessTokenCache,
  getAdwordsCredentials: jest.fn(),
  getAdwordsKeywordIdeas: jest.fn(),
}));

const { OAuth2Client: mockOAuth2Client } = jest.requireMock(
  'google-auth-library',
);
const handler = require('../../../pages/api/adwords').default;

type MockResponse = {
  statusCode: number;
  body: string | Record<string, any> | undefined;
  status: (code: number) => MockResponse;
  send: (payload: string) => MockResponse;
  json: (payload: Record<string, any>) => MockResponse;
};

const createResponse = () => {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: string) {
      this.body = payload;
      return this;
    },
    json(payload: Record<string, any>) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

describe('/api/adwords', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SECRET: 'test-secret',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    };
    mockState.readFile.mockResolvedValue(
      JSON.stringify({
        adwords_client_id: 'client-id',
        adwords_client_secret: 'client-secret',
      }),
    );
    mockState.writeFile.mockResolvedValue(undefined);
    mockState.getToken.mockResolvedValue({
      tokens: { refresh_token: 'refresh-token' },
    });
    mockState.cookieGet.mockReturnValue('oauth-state-token');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses forwarded request headers instead of NEXT_PUBLIC_APP_URL for the OAuth callback', async () => {
    const req = {
      method: 'GET',
      query: { code: 'auth-code', state: 'oauth-state-token' },
      headers: {
        host: 'internal:3000',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockOAuth2Client).toHaveBeenCalledWith(
      'decrypted-client-id',
      'decrypted-client-secret',
      'https://serp.example.com/api/adwords',
    );
    expect(mockState.cookieSet).toHaveBeenCalledWith(
      'adwords_oauth_state',
      undefined,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/adwords',
        secure: true,
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(
      'Google Ads Integrated Successfully! You can close this window.',
    );
  });

  it('rejects callbacks with a missing OAuth state before exchanging the code', async () => {
    const req = {
      method: 'GET',
      query: { code: 'auth-code' },
      headers: {
        host: 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.getToken).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toBe(
      'Invalid or expired Google Ads OAuth state. Please Try Again!',
    );
    expect(mockState.cookieSet).toHaveBeenCalledWith(
      'adwords_oauth_state',
      undefined,
      expect.objectContaining({
        path: '/api/adwords',
      }),
    );
  });

  it('reports redirect_uri_mismatch details without crashing on the resolved callback URL', async () => {
    mockState.getToken.mockRejectedValue({
      response: {
        data: {
          error: 'redirect_uri_mismatch',
        },
      },
    });

    const req = {
      method: 'GET',
      query: { code: 'auth-code', state: 'oauth-state-token' },
      headers: {
        host: 'internal:3000',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe(
      'Error Saving the Google Ads Refresh Token. Details: redirect_uri_mismatch Redirected URL: https://serp.example.com/api/adwords. Please Try Again!',
    );
  });

  it('handles unknown Google error shapes without throwing', async () => {
    mockState.getToken.mockRejectedValue(new Error('Unexpected failure'));

    const req = {
      method: 'GET',
      query: { code: 'auth-code', state: 'oauth-state-token' },
      headers: {
        host: 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe(
      'Error Saving the Google Ads Refresh Token. Please Try Again!',
    );
  });

  it('fails gracefully when Google does not return a refresh token', async () => {
    mockState.getToken.mockResolvedValue({
      tokens: { access_token: 'access-token' },
    });

    const req = {
      method: 'GET',
      query: { code: 'auth-code', state: 'oauth-state-token' },
      headers: {
        host: 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe(
      'Error Getting the Google Ads Refresh Token. Please Try Again!',
    );
    expect(mockState.writeFile).not.toHaveBeenCalled();
    expect(mockState.clearAdwordsAccessTokenCache).not.toHaveBeenCalled();
  });

  it('clears the OAuth state cookie without the secure flag when proxy headers are missing', async () => {
    const req = {
      method: 'GET',
      query: { code: 'auth-code', state: 'oauth-state-token' },
      headers: {
        host: 'serp.example.com',
      },
      socket: {},
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.cookieSet).toHaveBeenCalledWith(
      'adwords_oauth_state',
      undefined,
      expect.objectContaining({
        secure: false,
      }),
    );
    expect(res.statusCode).toBe(200);
  });
});
