import type { NextApiRequest, NextApiResponse } from 'next';

const mockState = {
  verifyUser: jest.fn(() => 'authorized'),
  cookieSet: jest.fn(),
};

jest.mock('../../../utils/verifyUser', () => ({
  __esModule: true,
  default: (...args: any[]) => (mockState.verifyUser as any)(...args),
}));

jest.mock('cookies', () =>
  jest.fn().mockImplementation(() => ({
    set: mockState.cookieSet,
  })),
);

const handler = require('../../../pages/api/logout').default;

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

describe('/api/logout', () => {
  it('expires the session cookie with matching security attributes', async () => {
    const req = {
      method: 'POST',
      headers: {
        host: 'internal:3000',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'serp.example.com',
      },
    } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.cookieSet).toHaveBeenCalledWith(
      'token',
      undefined,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
      }),
    );
    expect(mockState.cookieSet.mock.calls[0][2].maxAge).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, error: null });
  });
});
