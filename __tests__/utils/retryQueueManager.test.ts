jest.mock("fs/promises", () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock("proper-lockfile", () => ({
  lock: jest.fn(),
}));

jest.mock("../../utils/atomicWrite", () => ({
  atomicWriteFile: jest.fn(),
}));

import { mkdir, readFile } from "fs/promises";
import * as lockfile from "proper-lockfile";
import { atomicWriteFile } from "../../utils/atomicWrite";
import { retryQueueManager } from "../../utils/retryQueueManager";

describe("retryQueueManager", () => {
  const queuePath = `${process.cwd()}/data/failed_queue.json`;
  const mockRelease = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (lockfile.lock as jest.Mock).mockResolvedValue(mockRelease);
    (readFile as jest.Mock).mockResolvedValue("[]");
    (atomicWriteFile as jest.Mock).mockResolvedValue(undefined);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it("creates the queue file before adding when it is missing", async () => {
    (readFile as jest.Mock)
      .mockRejectedValueOnce({ code: "ENOENT" })
      .mockResolvedValueOnce("[]");

    await retryQueueManager.addToQueue(123);

    expect(mkdir).toHaveBeenCalledWith(`${process.cwd()}/data`, {
      recursive: true,
    });
    expect(atomicWriteFile).toHaveBeenNthCalledWith(
      1,
      queuePath,
      JSON.stringify([]),
      "utf-8"
    );
    expect(atomicWriteFile).toHaveBeenNthCalledWith(
      2,
      queuePath,
      JSON.stringify([123]),
      "utf-8"
    );
    expect(lockfile.lock).toHaveBeenCalledWith(
      queuePath,
      expect.objectContaining({ retries: expect.any(Object) })
    );
    expect(mockRelease).toHaveBeenCalled();
  });

  it("does not rewrite the queue when the id already exists", async () => {
    (readFile as jest.Mock).mockResolvedValue("[123,456]");

    await retryQueueManager.addToQueue(123);

    expect(atomicWriteFile).not.toHaveBeenCalled();
    expect(lockfile.lock).toHaveBeenCalledTimes(1);
  });

  it("removes an id from the queue", async () => {
    (readFile as jest.Mock).mockResolvedValue("[123,456,789]");

    await retryQueueManager.removeFromQueue(456);

    expect(atomicWriteFile).toHaveBeenCalledWith(
      queuePath,
      JSON.stringify([123, 789]),
      "utf-8"
    );
    expect(mockRelease).toHaveBeenCalled();
  });

  it("ignores invalid queue ids", async () => {
    await retryQueueManager.addToQueue(0);
    await retryQueueManager.addToQueue(-1);
    await retryQueueManager.removeFromQueue(Number.NaN);

    expect(lockfile.lock).not.toHaveBeenCalled();
    expect(atomicWriteFile).not.toHaveBeenCalled();
  });

  it("removes a batch of ids from the queue", async () => {
    (readFile as jest.Mock).mockResolvedValue("[123,456,789]");

    await retryQueueManager.removeBatch(new Set([123, 789]));

    expect(atomicWriteFile).toHaveBeenCalledWith(
      queuePath,
      JSON.stringify([456]),
      "utf-8"
    );
  });

  it("returns the current queue contents", async () => {
    (readFile as jest.Mock).mockResolvedValue("[123,456,789]");

    await expect(retryQueueManager.getQueue()).resolves.toEqual([
      123, 456, 789,
    ]);
    expect(lockfile.lock).toHaveBeenCalledTimes(1);
  });

  it("clears the queue contents", async () => {
    await retryQueueManager.clearQueue();

    expect(atomicWriteFile).toHaveBeenCalledWith(
      queuePath,
      JSON.stringify([]),
      "utf-8"
    );
  });
});
