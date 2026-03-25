import { logger } from "./logger";

type RefreshTask = {
  id: string;
  domains: string[];
  execute: () => Promise<void>;
};

class RefreshQueue {
  private queue: RefreshTask[] = [];

  private activeTasks = new Map<string, Promise<void>>();

  private activeDomains = new Set<string>();

  private maxConcurrency: number;

  constructor() {
    const parsedConcurrency = Number.parseInt(
      process.env.REFRESH_QUEUE_CONCURRENCY || "",
      10
    );

    this.maxConcurrency =
      Number.isFinite(parsedConcurrency) && parsedConcurrency > 0
        ? parsedConcurrency
        : 3;
  }

  private hasDomainConflict(domains: string[]): boolean {
    return domains.some((domain) => this.activeDomains.has(domain));
  }

  private processQueue(): void {
    while (
      this.activeTasks.size < this.maxConcurrency &&
      this.queue.length > 0
    ) {
      const nextTaskIndex = this.queue.findIndex(
        (task) => !this.hasDomainConflict(task.domains)
      );

      if (nextTaskIndex === -1) {
        return;
      }

      const task = this.queue.splice(nextTaskIndex, 1)[0];
      this.startTask(task);
    }
  }

  private startTask(task: RefreshTask): void {
    task.domains.forEach((domain) => this.activeDomains.add(domain));

    const taskPromise = task
      .execute()
      .catch((error) => {
        logger.error(
          `Refresh task failed: ${task.id}`,
          error instanceof Error ? error : new Error(String(error)),
          { domains: task.domains }
        );
      })
      .finally(() => {
        this.activeTasks.delete(task.id);
        task.domains.forEach((domain) => this.activeDomains.delete(domain));
        this.processQueue();
      });

    this.activeTasks.set(task.id, taskPromise);
  }

  enqueue(
    taskId: string,
    task: () => Promise<void>,
    domains: string[] = []
  ): void {
    this.queue.push({
      id: taskId,
      domains: Array.from(new Set(domains.filter(Boolean))),
      execute: task,
    });

    this.processQueue();
  }

  isDomainLocked(domain: string): boolean {
    return (
      this.activeDomains.has(domain) ||
      this.queue.some((task) => task.domains.includes(domain))
    );
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      activeTasks: this.activeTasks.size,
      activeDomains: Array.from(this.activeDomains),
      maxConcurrency: this.maxConcurrency,
    };
  }

  setMaxConcurrency(maxConcurrency: number): void {
    if (!Number.isFinite(maxConcurrency) || maxConcurrency < 1) {
      throw new Error("Max concurrency must be at least 1");
    }

    this.maxConcurrency = maxConcurrency;
    this.processQueue();
  }
}

export const refreshQueue = new RefreshQueue();

export default refreshQueue;
