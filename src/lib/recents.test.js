import { beforeEach, describe, expect, test, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { forgetGoneRepositories, lastRepository, recentRepositories, rememberRepository, remembering, repositoryFolder } from "./recents.js";
import { writeJson } from "./storage.js";

// storage.js listens for Recastle's other windows as it loads.
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({ getCurrentWebviewWindow: () => ({ label: "main" }) }));

const repo = (name) => ({ name, path: `/code/${name}` });
const worktree = (name, more = {}) => ({ path: `/code/${name}`, branch: name, main: false, current: false, locked: false, prunable: false, ...more });

describe("the folder a repository is known by", () => {
  test("is its own, opened itself or from one of its worktrees", () => {
    const worktrees = [worktree("recastle", { main: true }), worktree("recastle-search", { current: true })];
    expect(repositoryFolder({ path: "/code/recastle-search", worktrees })).toBe("/code/recastle");
    expect(repositoryFolder({ path: "/code/recastle", worktrees: [] })).toBe("/code/recastle");
  });

  test("with no folder of its own, as for a bare repository, is the worktree's", () => {
    expect(repositoryFolder({ path: "/code/recastle-search", worktrees: [worktree("recastle-search", { current: true })] })).toBe("/code/recastle-search");
  });
});

describe("remembering a repository", () => {
  test("puts it first, once", () => {
    const overview = { name: "recastle", path: "/code/recastle", worktrees: [] };
    expect(remembering([repo("blog"), repo("recastle")], overview)).toEqual([repo("recastle"), repo("blog")]);
  });

  test("remembers a worktree as its repository, leaving out its other worktrees", () => {
    const overview = {
      name: "recastle-search",
      path: "/code/recastle-search",
      worktrees: [worktree("recastle", { main: true }), worktree("recastle-search", { current: true }), worktree("recastle-login")],
    };
    const recents = [repo("recastle-login"), repo("blog"), repo("recastle"), repo("recastle-search")];
    expect(remembering(recents, overview)).toEqual([repo("recastle"), repo("blog")]);
  });

  test("remembers the repository itself, opened, without its worktrees", () => {
    const overview = { name: "recastle", path: "/code/recastle", worktrees: [worktree("recastle", { main: true, current: true }), worktree("recastle-login")] };
    expect(remembering([repo("recastle-login"), repo("blog")], overview)).toEqual([repo("recastle"), repo("blog")]);
  });

  test("with no folder of its own, as for a bare repository, remembers each worktree for itself", () => {
    const overview = { name: "recastle-search", path: "/code/recastle-search", worktrees: [worktree("recastle-search", { current: true }), worktree("recastle-login")] };
    expect(remembering([repo("recastle-login"), repo("blog")], overview)).toEqual([repo("recastle-search"), repo("blog")]);
  });

  test("notes a worktree as the last opened, to open again, though the list has its repository", async () => {
    writeJson("recastle.recentRepositories", []);
    rememberRepository({ name: "recastle-search", path: "/code/recastle-search", worktrees: [worktree("recastle", { main: true }), worktree("recastle-search", { current: true })] });
    expect(recentRepositories()).toEqual([repo("recastle")]);
    vi.mocked(invoke).mockResolvedValue(true);
    expect(await lastRepository()).toBe("/code/recastle-search");
    // The worktree removed since, its repository opens.
    vi.mocked(invoke).mockResolvedValue(false);
    expect(await lastRepository()).toBe("/code/recastle");
  });
});

describe("forgetting repositories that are gone", () => {
  beforeEach(() => writeJson("recastle.recentRepositories", [repo("recastle"), repo("deleted"), repo("blog")]));

  test("takes those whose folders are gone off the list", async () => {
    vi.mocked(invoke).mockResolvedValue(["/code/deleted"]);
    await forgetGoneRepositories();
    expect(invoke).toHaveBeenCalledWith("folders_gone", { paths: ["/code/recastle", "/code/deleted", "/code/blog"] });
    expect(recentRepositories()).toEqual([repo("recastle"), repo("blog")]);
  });

  test("keeps them all when it can't tell", async () => {
    vi.mocked(invoke).mockRejectedValue("No.");
    await forgetGoneRepositories();
    expect(recentRepositories()).toHaveLength(3);
  });
});
