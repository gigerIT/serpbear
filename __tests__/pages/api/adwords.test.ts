import type { NextApiRequest, NextApiResponse } from 'next';

const mockState = {
   getToken: jest.fn(),
   readFile: jest.fn(),
   writeFile: jest.fn(),
   decrypt: jest.fn((value: string) => `decrypted-${value}`),
   encrypt: jest.fn((value: string) => `encrypted-${value}`),
};

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

jest.mock('cryptr', () => jest.fn().mockImplementation(() => ({
   decrypt: mockState.decrypt,
   encrypt: mockState.encrypt,
})));

jest.mock('../../../utils/adwords', () => ({
   getAdwordsCredentials: jest.fn(),
   getAdwordsKeywordIdeas: jest.fn(),
}));

const { OAuth2Client: mockOAuth2Client } = jest.requireMock('google-auth-library');
const handler = require('../../../pages/api/adwords').default;

type MockResponse = {
   statusCode: number,
   body: string | Record<string, any> | undefined,
   status: (code:number) => MockResponse,
   send: (payload:string) => MockResponse,
   json: (payload:Record<string, any>) => MockResponse,
}

const createResponse = () => {
   const res: MockResponse = {
      statusCode: 200,
      body: undefined,
      status(code:number) {
         this.statusCode = code;
         return this;
      },
      send(payload:string) {
         this.body = payload;
         return this;
      },
      json(payload:Record<string, any>) {
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
      mockState.readFile.mockResolvedValue(JSON.stringify({
         adwords_client_id: 'client-id',
         adwords_client_secret: 'client-secret',
      }));
      mockState.writeFile.mockResolvedValue(undefined);
      mockState.getToken.mockResolvedValue({
         tokens: { refresh_token: 'refresh-token' },
      });
   });

   afterAll(() => {
      process.env = originalEnv;
   });

   it('uses forwarded request headers instead of NEXT_PUBLIC_APP_URL for the OAuth callback', async () => {
      const req = {
         method: 'GET',
         query: { code: 'auth-code' },
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
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('Google Ads Integrated Successfully! You can close this window.');
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
         query: { code: 'auth-code' },
         headers: {
            host: 'internal:3000',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'serp.example.com',
         },
      } as unknown as NextApiRequest;
      const res = createResponse();

      await handler(req, res as unknown as NextApiResponse);

      expect(res.statusCode).toBe(400);
      expect(res.body).toBe('Error Saving the Google Ads Refresh Token. Details: redirect_uri_mismatch Redirected URL: https://serp.example.com/api/adwords. Please Try Again!');
   });

   it('handles unknown Google error shapes without throwing', async () => {
      mockState.getToken.mockRejectedValue(new Error('Unexpected failure'));

      const req = {
         method: 'GET',
         query: { code: 'auth-code' },
         headers: {
            host: 'serp.example.com',
         },
      } as unknown as NextApiRequest;
      const res = createResponse();

      await handler(req, res as unknown as NextApiResponse);

      expect(res.statusCode).toBe(400);
      expect(res.body).toBe('Error Saving the Google Ads Refresh Token. Please Try Again!');
   });
});
