import { afterEach, expect, test, vi } from "vitest";
import { createApp, h, nextTick, shallowRef } from "vue";
import { invoke } from "@tauri-apps/api/core";
import PullCommits from "./PullCommits.vue";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
// Avatars listen for pictures fetched in the background.
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
// settings.js sets the window's theme as it loads.
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTheme: async () => {} }) }));

let app;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = "";
  vi.mocked(invoke).mockReset();
});

const found = (id, summary) => ({ id, short_id: id.slice(0, 7), summary, author_name: "Ada", time: 1_793_314_199 });
const commits = [found("a".repeat(40), "Add b"), found("b".repeat(40), "Add c")];
const changes = (more = {}) => ({ base: "1".repeat(40), head: "b".repeat(40), base_name: "main", head_name: "grace:engine-fix", commits, more: false, ...more });
const comparison = { base_id: "1", head_id: "b", merge_base: null, ahead: 2, behind: 0, files: [], additions: 0, deletions: 0, counted: true };
const commitDetails = { id: "a".repeat(40), tree_id: "", parents: [], author: { name: "Ada", email: "", time: 0 }, committer: { name: "Ada", email: "", time: 0 }, message: "Add b\n", files: [] };

const settle = async () => {
  for (let i = 0; i < 6; i++) await nextTick();
};

async function mount(pull, props = {}) {
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "pull_changes") return pull();
    if (command === "compare") return comparison;
    if (command === "commit_details") return commitDetails;
    return null;
  });
  const refreshKey = shallowRef(0);
  const root = document.createElement("div");
  document.body.append(root);
  app = createApp({
    render: () =>
      h(PullCommits, { path: "/repo", repo: { owner: "ada", repo: "engine" }, number: 7, refreshKey: refreshKey.value, ...props }),
  });
  app.mount(root);
  await settle();
  return refreshKey;
}

const calls = (command) => vi.mocked(invoke).mock.calls.filter(([c]) => c === command).map(([, args]) => args);
const rows = () => [...document.querySelectorAll(".row")];

test("lists the commits under all the changes, which show first, as GitHub compares them", async () => {
  await mount(() => changes());
  expect(calls("pull_changes")).toEqual([{ path: "/repo", owner: "ada", repo: "engine", number: 7 }]);
  expect(rows().map((row) => row.querySelector(".summary").textContent)).toEqual(["All changes", "Add b", "Add c"]);
  expect(rows()[0].classList).toContain("selected");
  expect(calls("compare")).toEqual([{ path: "/repo", base: "1".repeat(40), head: "b".repeat(40) }]);
});

test("a commit clicked shows its own changes", async () => {
  await mount(() => changes());
  rows()[1].click();
  await settle();
  expect(rows()[1].classList).toContain("selected");
  expect(calls("commit_details")).toEqual([{ path: "/repo", id: "a".repeat(40) }]);
});

test("read again on a refresh, a commit that's gone goes back to all the changes", async () => {
  let rebased = false;
  const refreshKey = await mount(() => (rebased ? changes({ commits: [found("c".repeat(40), "Add b, again")] }) : changes()));
  rows()[1].click();
  await settle();

  rebased = true;
  refreshKey.value++;
  await settle();
  expect(calls("pull_changes")).toHaveLength(2);
  expect(rows().map((row) => row.querySelector(".summary").textContent)).toEqual(["All changes", "Add b, again"]);
  expect(rows()[0].classList).toContain("selected");
});

test("says why the commits couldn't be read", async () => {
  await mount(() => {
    throw "fatal: couldn't find remote ref refs/pull/7/head";
  });
  expect(document.body.textContent).toContain("couldn't find remote ref");
  expect(rows()).toHaveLength(0);
});

test("Try Again reads the commits again after a read that failed", async () => {
  let fails = true;
  await mount(() => {
    if (fails) throw "Fetching the pull request's commits stalled. Check your connection, then try again.";
    return changes();
  });
  fails = false;
  [...document.querySelectorAll("button")].find((b) => b.textContent === "Try Again").click();
  await settle();
  expect(rows().map((row) => row.querySelector(".summary").textContent)).toEqual(["All changes", "Add b", "Add c"]);
});

// While an agent works, refreshes come faster than the commits are read.
test("refreshes during a read wait for it, then read once more, rather than each taking its place", async () => {
  const pending = [];
  const refreshKey = await mount(() => new Promise((resolve) => pending.push(resolve)));
  refreshKey.value++;
  await settle();
  refreshKey.value++;
  await settle();
  expect(pending).toHaveLength(1);

  pending[0](changes());
  await settle();
  expect(rows()).toHaveLength(3);
  expect(pending).toHaveLength(2);
  pending[1](changes({ commits: [found("c".repeat(40), "Add d")] }));
  await settle();
  expect(rows().map((row) => row.querySelector(".summary").textContent)).toEqual(["All changes", "Add d"]);
  expect(calls("pull_changes")).toHaveLength(2);
});

test("another pull request chosen during a read is read straight away, the one before's not shown", async () => {
  const pending = [];
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "pull_changes") return new Promise((resolve) => pending.push({ number: args.number, resolve }));
    if (command === "compare") return comparison;
    return null;
  });
  const number = shallowRef(7);
  const root = document.createElement("div");
  document.body.append(root);
  app = createApp({ render: () => h(PullCommits, { path: "/repo", repo: { owner: "ada", repo: "engine" }, number: number.value }) });
  app.mount(root);
  await settle();

  number.value = 8;
  await settle();
  expect(pending.map((p) => p.number)).toEqual([7, 8]);
  pending[1].resolve(changes({ commits: [found("d".repeat(40), "From 8")] }));
  await settle();
  pending[0].resolve(changes({ commits: [found("e".repeat(40), "From 7")] }));
  await settle();
  expect(document.body.textContent).toContain("From 8");
  expect(document.body.textContent).not.toContain("From 7");
});

test("names the branches the changes are between, rather than their commits", async () => {
  await mount(() => changes());
  expect(document.querySelector(".merge-note").textContent.replace(/\s+/g, " ").trim()).toBe(
    "Changes made on “grace:engine-fix” since it split from “main”.",
  );
});

test("a refresh that fails keeps the commits shown, saying so, with Try Again", async () => {
  let fails = false;
  const refreshKey = await mount(() => {
    if (fails) throw "GitHub couldn't be reached.";
    return changes();
  });
  fails = true;
  refreshKey.value++;
  await settle();
  expect(rows()).toHaveLength(3);
  expect(document.querySelector(".refresh-error").textContent).toContain("GitHub couldn't be reached.");

  fails = false;
  document.querySelector(".refresh-error button").click();
  await settle();
  expect(document.querySelector(".refresh-error")).toBeNull();
});
