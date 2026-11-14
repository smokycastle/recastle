// Whether Palace can see what Claude Code in a terminal tab is doing. Claude Code says
// what it's doing with the Program Status Protocol (see programStatus.js), and keeps a
// report standing for as long as its own session is in front: idle, at its prompt, or
// working, finished or needing the user. In front with none standing, it isn't saying:
// most often the tab is showing a session that runs in the background, Claude Code's
// own background host running it on a terminal of its own, whose reports don't reach
// the tab. That's so whether the tab started as that, or became it as `/resume` took
// it to a session already running in the background, clearing the reports of the one
// it had. Such a tab is marked `unreported`, so it doesn't seem idle.

// How long Claude Code is in front without a report before it's taken not to be
// saying: it can be in front a moment before its first, as it starts.
export const UNREPORTED_AFTER = 2000;

/**
 * Looks again at whether `tab` is to be marked: as the program in front's checked
 * (`tab.session.front`, by name, or null where it can't be told), and as reports come,
 * or are cleared (`tab.session.records`, see programStatus.js). Claude Code in front
 * with none standing is marked once that's been so a while; anything else isn't.
 */
export function noteReports(tab) {
  const session = tab.session;
  if (session.front !== "claude" || session.records?.size) {
    stopWaiting(tab);
    tab.unreported = false;
    return;
  }
  if (session.reportWait || tab.unreported) return;
  session.reportWait = setTimeout(() => {
    session.reportWait = 0;
    tab.unreported = session.front === "claude" && !session.records?.size;
  }, UNREPORTED_AFTER);
}

/** Stops waiting to see whether the program in `tab` reports, as when the tab closes. */
export function stopWaiting(tab) {
  clearTimeout(tab.session.reportWait);
  tab.session.reportWait = 0;
}
