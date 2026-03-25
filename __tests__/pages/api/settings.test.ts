import type { NextApiRequest, NextApiResponse } from 'next';

const mockState = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  clearAdwordsAccessTokenCache: jest.fn(),
  decrypt: jest.fn((value: string) => {
    if (value === 'enc-old-id') {
      return 'old-id';
    }
    if (value === 'enc-old-secret') {
      return 'old-secret';
    }
    return `decrypted-${value}`;
  }),
  encrypt: jest.fn((value: string) => `encrypted-${value}`),
};

jest.mock('fs/promises', () => ({
  readFile: mockState.readFile,
  writeFile: mockState.writeFile,
}));

jest.mock('cryptr', () =>
  jest.fn().mockImplementation(() => ({
    decrypt: mockState.decrypt,
    encrypt: mockState.encrypt,
  })),
);

jest.mock('next/config', () =>
  jest.fn(() => ({
    publicRuntimeConfig: { version: 'test-version' },
  })),
);

jest.mock('../../..//scrapers/index', () => []);

jest.mock('../../../utils/verifyUser', () => ({
  __esModule: true,
  default: jest.fn(() => 'authorized'),
}));

jest.mock('../../../utils/adwords', () => ({
  clearAdwordsAccessTokenCache: mockState.clearAdwordsAccessTokenCache,
}));

const handler = require('../../../pages/api/settings').default;

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

describe('/api/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SECRET = 'test-secret';
    mockState.readFile.mockResolvedValue(
      JSON.stringify({
        adwords_client_id: 'enc-old-id',
        adwords_client_secret: 'enc-old-secret',
        adwords_refresh_token: 'enc-refresh-token',
      }),
    );
    mockState.writeFile.mockResolvedValue(undefined);
  });

  it('preserves the refresh token when Google Ads client credentials do not change', async () => {
    const req = {
      method: 'PUT',
      body: {
        settings: {
          adwords_client_id: 'old-id',
          adwords_client_secret: 'old-secret',
        },
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    const writePayload = JSON.parse(mockState.writeFile.mock.calls[0][1]);
    expect(writePayload.adwords_refresh_token).toBe('enc-refresh-token');
    expect(mockState.clearAdwordsAccessTokenCache).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('clears the refresh token when Google Ads client credentials change', async () => {
    const req = {
      method: 'PUT',
      body: {
        settings: {
          adwords_client_id: 'new-id',
          adwords_client_secret: 'old-secret',
        },
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    const writePayload = JSON.parse(mockState.writeFile.mock.calls[0][1]);
    expect(writePayload.adwords_refresh_token).toBe('');
    expect(mockState.clearAdwordsAccessTokenCache).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
