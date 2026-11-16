import { beforeEach, expect, test, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({ getCurrentWebviewWindow: () => ({ label: "main" }) }));

const { fromPalace, loadStore, readJson } = await import("./storage.js");

// What the file holds, as the backend loads it.
let file;
beforeEach(() => {
  file = {};
  localStorage.clear();
  vi.mocked(invoke)
    .mockReset()
    .mockImplementation(async (command) => (command === "load_store" ? file : null));
});
const saved = () => vi.mocked(invoke).mock.calls.filter(([command]) => command === "save_store").map(([, args]) => args.values);

test("what Palace saved is Recastle's, where Recastle has nothing of its own under that name", () => {
  expect(fromPalace({ "palace.settings": { theme: "dark" }, "palace.firstStarted": 5, "recastle.firstStarted": 9, other: 1 })).toEqual({
    "recastle.settings": { theme: "dark" },
  });
  expect(fromPalace({})).toEqual({});
});

test("loading Palace's file, its values are read as Recastle's, and kept so, Palace's left as they were", async () => {
  file = { "palace.settings": { theme: "dark" }, "palace.recentRepositories": [{ path: "/code/a" }] };
  await loadStore();
  expect(readJson("recastle.settings", null)).toEqual({ theme: "dark" });
  expect(readJson("recastle.recentRepositories", [])).toEqual([{ path: "/code/a" }]);
  expect(readJson("palace.settings", null)).toEqual({ theme: "dark" });
  await vi.waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0]).toEqual({ "recastle.settings": { theme: "dark" }, "recastle.recentRepositories": [{ path: "/code/a" }] });
});

test("once they're Recastle's, nothing's brought over again", async () => {
  file = { "palace.settings": { theme: "dark" }, "recastle.settings": { theme: "light" } };
  await loadStore();
  expect(readJson("recastle.settings", null)).toEqual({ theme: "light" });
  await new Promise((resolve) => setTimeout(resolve));
  expect(saved()).toEqual([]);
});
