import { expect, test, vi } from "vitest";
import { reviewMessage } from "./review.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
// storage.js listens for Recastle's other windows as it loads.
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({ getCurrentWebviewWindow: () => ({ label: "main" }) }));

const comment = (where) => ({ id: 1, file: "src/engine.js", where, lines: [{ kind: "+", old: null, new: 3, text: "go();" }], body: "Why?" });

test("says which diff each comment is on, so the agent can find it", () => {
  const firstLine = (where) => reviewMessage([comment(where)]).split("\n")[2];
  expect(firstLine("unstaged")).toBe("src/engine.js, line 3:");
  expect(firstLine(`commit:${"a".repeat(40)}`)).toBe("src/engine.js, line 3, in commit aaaaaaa:");
  expect(firstLine("compare:main..feature")).toBe("src/engine.js, line 3, comparing main with feature:");
  expect(firstLine("pull:ada/engine#7")).toBe("src/engine.js, line 3, in pull request ada/engine#7:");
});
