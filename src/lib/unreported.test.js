import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { UNREPORTED_AFTER, noteReports } from "./unreported.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tab = () => ({ unreported: false, session: { front: null, records: new Map() } });
// What's in front in the tab, as last checked.
const inFront = (t, front) => {
  t.session.front = front;
  noteReports(t);
};
// A report applied, or all of them cleared.
const reported = (t, state) => {
  if (state) t.session.records.set("", { id: "", state });
  else t.session.records.clear();
  noteReports(t);
};

test("Claude Code in front with no report standing is marked, after a moment", () => {
  const viewing = tab();
  inFront(viewing, "claude");
  vi.advanceTimersByTime(UNREPORTED_AFTER - 1);
  expect(viewing.unreported).toBe(false);
  vi.advanceTimersByTime(1);
  expect(viewing.unreported).toBe(true);
  // Reporting after all, as one slow to start, it isn't.
  reported(viewing, "idle");
  expect(viewing.unreported).toBe(false);
});

test("one that reports as it starts isn't", () => {
  const started = tab();
  inFront(started, "claude");
  reported(started, "idle");
  vi.advanceTimersByTime(UNREPORTED_AFTER * 2);
  expect(started.unreported).toBe(false);
});

test("one that clears its reports and goes on in front, as /resume taking it to a background session, is", () => {
  const resumed = tab();
  inFront(resumed, "claude");
  reported(resumed, "idle");
  reported(resumed, null);
  vi.advanceTimersByTime(UNREPORTED_AFTER);
  expect(resumed.unreported).toBe(true);
});

test("anything else in front isn't, nor where what's in front can't be told", () => {
  const shell = tab();
  inFront(shell, "claude");
  vi.advanceTimersByTime(UNREPORTED_AFTER);
  inFront(shell, "zsh");
  expect(shell.unreported).toBe(false);
  // Claude Code ending clears its reports, the shell back in front a moment after.
  inFront(shell, "claude");
  reported(shell, "idle");
  reported(shell, null);
  inFront(shell, "zsh");
  vi.advanceTimersByTime(UNREPORTED_AFTER);
  expect(shell.unreported).toBe(false);
  inFront(shell, null);
  vi.advanceTimersByTime(UNREPORTED_AFTER);
  expect(shell.unreported).toBe(false);
});
