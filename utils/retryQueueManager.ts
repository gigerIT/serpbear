import { mkdir, readFile } from "fs/promises";
import { dirname } from "path";
import * as lockfile from "proper-lockfile";
import { atomicWriteFile } from "./atomicWrite";

class RetryQueueManager {
  private filePath: string;

  constructor() {
    this.filePath = `${process.cwd()}/data/failed_queue.json`;
  }

  private async ensureQueueFile(): Promise<void> {
    try {
      await readFile(this.filePath, { encoding: "utf-8" });
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        throw error;
      }

      await mkdir(dirname(this.filePath), { recursive: true });
      await atomicWriteFile(this.filePath, JSON.stringify([]), "utf-8");
    }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureQueueFile();

    const release = await lockfile.lock(this.filePath, {
      retries: {
        retries: 5,
        factor: 2,
        minTimeout: 50,
        maxTimeout: 1000,
      },
    });

    try {
      return await operation();
    } finally {
      await release().catch(() => undefined);
    }
  }

  private async readQueue(): Promise<number[]> {
    try {
      const rawData = await readFile(this.filePath, { encoding: "utf-8" });
      const parsed = JSON.parse(rawData);
      return Array.isArray(parsed)
        ? parsed.filter((id) => Number.isInteger(id) && id > 0)
        : [];
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return [];
      }

      return [];
    }
  }

  private async writeQueue(queue: number[]): Promise<void> {
    await atomicWriteFile(this.filePath, JSON.stringify(queue), "utf-8");
  }

  async addToQueue(keywordID: number): Promise<void> {
    if (!Number.isInteger(keywordID) || keywordID <= 0) {
      return;
    }

    await this.withLock(async () => {
      const queue = await this.readQueue();

      if (!queue.includes(keywordID)) {
        queue.push(keywordID);
        await this.writeQueue(queue);
      }
    });
  }

  async removeFromQueue(keywordID: number): Promise<void> {
    if (!Number.isInteger(keywordID)) {
      return;
    }

    await this.withLock(async () => {
      const queue = await this.readQueue();
      const filtered = queue.filter((id) => id !== Math.abs(keywordID));

      if (filtered.length !== queue.length) {
        await this.writeQueue(filtered);
      }
    });
  }
}

export const retryQueueManager = new RetryQueueManager();
