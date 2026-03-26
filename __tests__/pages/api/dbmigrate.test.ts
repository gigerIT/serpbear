import type { NextApiRequest, NextApiResponse } from "next";

const mockState = {
  sync: jest.fn(),
  getQueryInterface: jest.fn(),
  verifyUser: jest.fn(() => "authorized"),
  pending: jest.fn(),
  up: jest.fn(),
  umzugCtor: jest.fn(),
  storageCtor: jest.fn(),
};

jest.mock("../../../database/database", () => ({
  __esModule: true,
  default: {
    sync: (...args: any[]) => mockState.sync.apply(null, args),
    getQueryInterface: (...args: any[]) =>
      mockState.getQueryInterface.apply(null, args),
  },
}));

jest.mock("../../../utils/verifyUser", () => ({
  __esModule: true,
  default: (...args: any[]) => mockState.verifyUser.apply(null, args),
}));

jest.mock("umzug", () => ({
  Umzug: jest.fn().mockImplementation((config) => {
    mockState.umzugCtor(config);
    return {
      pending: (...args: any[]) => mockState.pending.apply(null, args),
      up: (...args: any[]) => mockState.up.apply(null, args),
    };
  }),
  SequelizeStorage: jest.fn().mockImplementation((config) => {
    mockState.storageCtor(config);
    return { config };
  }),
}));

const handler = require("../../../pages/api/dbmigrate").default;

type MockResponse = {
  statusCode: number;
  body: Record<string, any> | undefined;
  status: (code: number) => MockResponse;
  json: (payload: Record<string, any>) => MockResponse;
};

const createResponse = (): MockResponse => ({
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
});

describe("/api/dbmigrate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.getQueryInterface.mockReturnValue({ queryInterface: true });
    mockState.pending.mockResolvedValue([]);
    mockState.up.mockResolvedValue([]);
  });

  it("checks pending migrations with the shared database connection", async () => {
    const req = { method: "GET" } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.sync).toHaveBeenCalledTimes(1);
    expect(mockState.getQueryInterface).toHaveBeenCalledTimes(1);
    expect(mockState.storageCtor).toHaveBeenCalledWith({
      sequelize: expect.objectContaining({
        sync: expect.any(Function),
        getQueryInterface: expect.any(Function),
      }),
    });
    expect(mockState.umzugCtor).toHaveBeenCalledWith({
      migrations: { glob: "database/migrations/*.js" },
      context: { queryInterface: true },
      storage: { config: { sequelize: expect.any(Object) } },
      logger: undefined,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ hasMigrations: false });
  });

  it("runs migrations with the shared database connection", async () => {
    const req = { method: "POST" } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.sync).not.toHaveBeenCalled();
    expect(mockState.up).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ migrated: true });
  });

  it("returns 401 when authorization fails", async () => {
    mockState.verifyUser.mockReturnValueOnce("unauthorized");
    const req = { method: "GET" } as unknown as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(mockState.sync).not.toHaveBeenCalled();
    expect(mockState.pending).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });
});
