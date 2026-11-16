import { beforeEach, expect, test, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mountComposable } from "../test/mount.js";

// Saved data, in memory.
const saved = vi.hoisted(() => new Map());
vi.mock("./storage.js", () => ({
  readJson: (key, fallback) => (saved.has(key) ? structuredClone(saved.get(key)) : fallback),
  writeJson: (key, value) => saved.set(key, structuredClone(value)),
}));

const { fitTerminal, panes, usePaneSizes } = await import("./panes.js");

beforeEach(() => {
  saved.clear();
  Object.assign(panes, { sidebar: 300, history: 580, terminal: 300 });
  window.innerHeight = 900;
});

// A tab's pane sizes, showing the repository at `path`.
const tabShowing = (path, active = () => true, separate = () => true) => {
  const repository = ref(path);
  return { repository, ...mountComposable(() => usePaneSizes(() => repository.value, active, separate)).result };
};

test("each repository keeps its own pane sizes, one without starting at those last set", async () => {
  const a = tabShowing("/a");
  Object.assign(a.sizes, { sidebar: 260, history: 700, terminal: 420 });
  a.save();
  const b = tabShowing("/b");
  // Never set for /b: those last set, in any tab.
  expect({ ...b.sizes }).toEqual({ sidebar: 260, history: 700, terminal: 420 });
  b.sizes.history = 400;
  b.save();
  expect(a.sizes.history).toBe(700);
  // A tab showing /a again, as in another window or after a restart, has its own.
  expect({ ...tabShowing("/a").sizes }).toEqual({ sidebar: 260, history: 700, terminal: 420 });
  // A tab going on to another repository takes that one's.
  a.repository.value = "/b";
  await nextTick();
  expect(a.sizes.history).toBe(400);
  // Those last set are kept for Palace's next start too.
  expect(saved.get("recastle.paneWidths")).toEqual({ sidebar: 260, history: 400, terminal: 420 });
});

test("the terminal panel no taller than there's room for, as the window's height, or the tabs' row, leaves", async () => {
  const a = tabShowing("/a");
  a.sizes.terminal = 650;
  a.save();
  window.innerHeight = 700;
  fitTerminal();
  await nextTick();
  expect(a.sizes.terminal).toBe(500);
  // What's saved is what was set, for when there's room again.
  window.innerHeight = 900;
  expect(tabShowing("/a").sizes.terminal).toBe(650);
});

test("keeps only so many, the least recently set going first", () => {
  const tab = tabShowing("/r0");
  for (let i = 0; i <= 200; i++) {
    tab.repository.value = `/r${i}`;
    tab.save();
  }
  const all = saved.get("recastle.paneSizes");
  expect(Object.keys(all)).toHaveLength(200);
  expect(all).not.toHaveProperty("/r0");
  expect(all).toHaveProperty("/r200");
});

test("a tab coming to show starts at the last tab's sizes, and slides to its own, together", async () => {
  // Frames run by hand, each at the time given.
  const frames = [];
  vi.stubGlobal("requestAnimationFrame", (run) => frames.push(run));
  vi.stubGlobal("cancelAnimationFrame", () => frames.splice(0));
  const frameAt = (time) => frames.shift()?.(time);
  const showingA = ref(true);
  const a = tabShowing("/a", () => showingA.value);
  Object.assign(a.sizes, { sidebar: 200, history: 600, terminal: 400 });
  await nextTick();
  const showingB = ref(false);
  const b = tabShowing("/b", () => showingB.value);
  Object.assign(b.sizes, { sidebar: 300, history: 500, terminal: 400 });
  await nextTick();

  // B comes to show: drawn first as A was.
  showingA.value = false;
  showingB.value = true;
  await nextTick();
  expect({ ...b.shown }).toEqual({ sidebar: 200, history: 600, terminal: 400 });
  // Both off at once, most of the way in their first moments, but not there yet.
  frameAt(1000);
  frameAt(1060);
  expect(b.shown.sidebar).toBeGreaterThan(270);
  expect(b.shown.history).toBeLessThan(530);
  expect(b.shown.sidebar).toBeLessThan(300);
  // Dragged meanwhile, the history heads for where it's been dragged to.
  b.sizes.history = 450;
  frameAt(2000);
  expect({ ...b.shown }).toEqual({ sidebar: 300, history: 450, terminal: 400 });
  expect(frames).toHaveLength(0);

  // Once it's settled, dragging's drawn at once.
  b.sizes.sidebar = 320;
  await nextTick();
  expect(b.shown.sidebar).toBe(320);
  vi.unstubAllGlobals();
});

test("a tab coming to show after one showing no repository is at its own sizes at once", async () => {
  const frames = [];
  vi.stubGlobal("requestAnimationFrame", (run) => frames.push(run));
  const showingWelcome = ref(true);
  tabShowing(null, () => showingWelcome.value);
  await nextTick();
  const showingA = ref(false);
  const a = tabShowing("/a", () => showingA.value);
  Object.assign(a.sizes, { sidebar: 250, history: 650, terminal: 350 });
  await nextTick();
  showingWelcome.value = false;
  showingA.value = true;
  await nextTick();
  expect({ ...a.shown }).toEqual({ sidebar: 250, history: 650, terminal: 350 });
  expect(frames).toHaveLength(0);
  vi.unstubAllGlobals();
});

test("set not to keep each repository's, every tab has the same, and takes them as they're set in any", async () => {
  const separate = ref(true);
  const a = tabShowing("/a", () => true, () => separate.value);
  Object.assign(a.sizes, { sidebar: 250, history: 650, terminal: 350 });
  a.save();
  const b = tabShowing("/b", () => false, () => separate.value);
  b.sizes.history = 500;
  b.save();
  expect(a.sizes.history).toBe(650);

  separate.value = false;
  await nextTick();
  // Both those last set, /b's.
  expect([a.sizes.history, b.sizes.history]).toEqual([500, 500]);
  a.sizes.sidebar = 280;
  a.save();
  await nextTick();
  expect(b.sizes.sidebar).toBe(280);
  // Not kept as /a's own, which it has again once each keeps its own.
  separate.value = true;
  await nextTick();
  expect(a.sizes.sidebar).toBe(250);
});
