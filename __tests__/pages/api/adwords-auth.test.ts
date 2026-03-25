import type { NextApiRequest, NextApiResponse } from 'next';

const mockState = {
  generateAuthUrl: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  decrypt: jest.fn((value: string) => `decrypted-${value}`),
  encrypt: jest.fn((value: string) => `encrypted-${value}`),
  clearAdwordsAccessTokenCache: jest.fn(),
  cookieSet: jest.fn(),
  cookieGet: jest.fn(),
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'oauth-state-token'),
  })),
};

jest.mock('crypto', () => ({
  randomBytes: (size: number) => (mockState.randomBytes as any)(size),
}));

jest.mock('cookies', () =>
  jest.fn().mockImplementation(() => ({
    set: mockState.cookieSet,
    get: mockState.cookieGet,
  })),
);

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({
    generateAuthUrl: mockState.generateAuthUrl,
  })),
}));

jest.mock('fs/promises', () => ({
  readFile: mockState.readFile,
  writeFile: mockState.writeFile,
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
}));

const { OAuth2Client: mockOAuth2Client } = jest.requireMock(
  'google-auth-library',
);
const handler = require('../../../pages/api/adwords/auth').default;

type MockResponse = {
  statusCode: number;
  body: Record<string, any> | undefined;
  status: (code: number) => MockResponse;
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
    json(payload: Record<string, any>) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

describe('/api/adwords/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SECRET = 'test-secret';
    mockState.readFile.mockResolvedValue(
      JSON.stringify({
        adwords_refresh_token: 'encrypted-old-refresh-token',
        adwords_developer_token: 'encrypted-developer-token',
      }),
    );
    mockState.writeFile.mockResolvedValue(undefined);
    mockState.generateAuthUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth?prompt=consent',
    );
  });

  it('stores credentials, clears stale refresh token, and returns a consent auth URL', async () => {
    const req = {
      method: 'POST',
      body: {
        client_id: 'client-id',
        client_secret: 'client-secret',
      },
      headers: {
        host: 'internal:3000',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockOAuth2Client).toHaveBeenCalledWith(
      'client-id',
      'client-secret',
      'https://serp.example.com/api/adwords',
    );
    expect(mockState.generateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: ['https://www.googleapis.com/auth/adwords'],
      state: 'oauth-state-token',
    });
    expect(mockState.cookieSet).toHaveBeenCalledWith(
      'adwords_oauth_state',
      'oauth-state-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/adwords',
        secure: true,
        maxAge: 600000,
      }),
    );
    expect(mockState.clearAdwordsAccessTokenCache).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      authURL: 'https://accounts.google.com/o/oauth2/v2/auth?prompt=consent',
    });

    const writePayload = JSON.parse(mockState.writeFile.mock.calls[0][1]);
    expect(writePayload.adwords_client_id).toBe('encrypted-client-id');
    expect(writePayload.adwords_client_secret).toBe('encrypted-client-secret');
    expect(writePayload.adwords_refresh_token).toBe('');
    expect(writePayload.adwords_developer_token).toBe(
      'encrypted-developer-token',
    );
  });

  it('rejects missing credentials', async () => {
    const req = {
      method: 'POST',
      body: {
        client_id: 'client-id',
      },
      headers: {
        host: 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Please Provide the Google Ads Client ID and Client Secret',
    });
    expect(mockState.writeFile).not.toHaveBeenCalled();
  });

  it('does not mark the OAuth state cookie secure when the app receives plain HTTP without proxy headers', async () => {
    const req = {
      method: 'POST',
      body: {
        client_id: 'client-id',
        client_secret: 'client-secret',
      },
      headers: {
        host: 'serp.example.com',
      },
      socket: {},
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.cookieSet).toHaveBeenCalledWith(
      'adwords_oauth_state',
      'oauth-state-token',
      expect.objectContaining({
        secure: false,
      }),
    );
    expect(res.statusCode).toBe(200);
  });
});
