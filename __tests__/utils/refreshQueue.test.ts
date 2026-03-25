import { refreshQueue } from "../../utils/refreshQueue";

describe("refreshQueue", () => {
  beforeEach(() => {
    refreshQueue.setMaxConcurrency(1);
  });

  it("tracks queued domains as locked", async () => {
    let releaseTask: (() => void) | undefined;
    const runningTask = new Promise<void>((resolve) => {
      releaseTask = resolve;
    });

    refreshQueue.enqueue("first", async () => runningTask, ["example.com"]);
    refreshQueue.enqueue("second", async () => undefined, ["another.com"]);

    expect(refreshQueue.isDomainLocked("example.com")).toBe(true);
    expect(refreshQueue.isDomainLocked("another.com")).toBe(true);

    releaseTask?.();
    await runningTask;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("serializes work for overlapping domains", async () => {
    const executionOrder: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstTask = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    refreshQueue.enqueue(
      "first",
      async () => {
        executionOrder.push("first");
        await firstTask;
      },
      ["example.com"]
    );

    refreshQueue.enqueue(
      "second",
      async () => {
        executionOrder.push("second");
      },
      ["example.com"]
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(executionOrder).toEqual(["first"]);

    releaseFirst?.();
    await firstTask;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(executionOrder).toEqual(["first", "second"]);
  });
});
