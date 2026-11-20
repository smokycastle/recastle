import { expect, test } from "vitest";
import { oneAtATime } from "./oneAtATime.js";

// Work whose runs each wait to be finished, by key, in the order they started.
function setUp() {
  const runs = [];
  const work = oneAtATime((key) => new Promise((finish) => runs.push({ key, finish })));
  const finish = async (i) => {
    runs[i].finish();
    for (let n = 0; n < 4; n++) await Promise.resolve();
  };
  return { runs, work, finish };
}

test("asked for again while it runs, it runs once more after, however many times it was asked", async () => {
  const { runs, work, finish } = setUp();
  work.run();
  work.run();
  work.run();
  expect(runs).toHaveLength(1);
  expect(work.pending()).toBe(true);

  await finish(0);
  expect(runs).toHaveLength(2);
  expect(work.pending()).toBe(false);
  await finish(1);
  expect(runs).toHaveLength(2);
});

test("asked for with another key, it runs straight away, and the one before doesn't run again", async () => {
  const { runs, work, finish } = setUp();
  work.run(7);
  work.run(7);
  work.run(8);
  expect(runs.map((r) => r.key)).toEqual([7, 8]);
  await finish(0);
  expect(runs).toHaveLength(2);

  // Asked for again meanwhile, the one under way, 8, runs once more after.
  work.run(8);
  await finish(1);
  expect(runs.map((r) => r.key)).toEqual([7, 8, 8]);
});

test("back to a key while its earlier run's still going, that run finishing doesn't count as the new one's", async () => {
  const { runs, work, finish } = setUp();
  work.run(7);
  work.run(8);
  work.run(7);
  work.run(7);
  await finish(0);
  // The 7 under way is the third run; the first finishing doesn't start another.
  expect(runs.map((r) => r.key)).toEqual([7, 8, 7]);
  await finish(2);
  expect(runs.map((r) => r.key)).toEqual([7, 8, 7, 7]);
});

test("stopped, what's under way doesn't run again once it's done, though it was asked to", async () => {
  const { runs, work, finish } = setUp();
  work.run();
  work.run();
  work.stop();
  expect(work.pending()).toBe(false);
  await finish(0);
  expect(runs).toHaveLength(1);
});
