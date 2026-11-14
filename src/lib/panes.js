import { onBeforeUnmount, reactive, ref, watch } from "vue";
import { stillness } from "./slide.js";
import { readJson, writeJson } from "./storage.js";

// How wide the sidebar and the history are, and how tall the terminal panel is: each
// repository's own (see usePaneSizes), so a tab's are as they were last set for the
// repository it shows, in whichever tab or window. `panes` here are those last set for
// any, kept for a repository that's had none of its own.

const KEY = "palace.paneWidths";

export const panes = reactive({ sidebar: 300, history: 580, terminal: 300, ...readJson(KEY, {}) });

// Each repository's sizes, by path, { sidebar, history, terminal }, the most recently
// set last; no more are kept than this, the least recently set going first.
const SIZES_KEY = "palace.paneSizes";
const MOST_KEPT = 200;

// How tall the row of tabs across the window's top is, if there is one (see styles.css).
const tabRowHeight = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tab-row-height")) || 0;

/** The terminal panel's tallest: room left for the panes above it, under any tabs. */
export const tallestTerminal = () => Math.max(160, window.innerHeight - 200 - tabRowHeight());

// Counted up as there's less room for the terminal panel, for each tab's to fit it.
const fits = ref(0);

// How long the panes take to slide to a tab's sizes as it comes to show, all at once.
const PANE_SLIDE_MS = 280;

// A strong ease-out: off at once, most of the way there in the first moments, then
// settling. Exactly there at the end.
const easeOut = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

// The sizes the tab showing in the window last showed, for the next to show to slide
// from (see usePaneSizes): none while it shows no repository, and so no panes.
let lastShown = null;

/** Makes the terminal panels no taller than they can be now, as when the row of tabs comes. */
export function fitTerminal() {
  fits.value++;
}

/**
 * A tab's pane sizes, for the repository at `path()` it shows: as they were last set for
 * that repository, in any tab or window, or for one that's had none, as they were last
 * set for any; the terminal panel no taller than there's room for. Returns:
 *   sizes    reactive, { sidebar, history, terminal }, which dragging an edge sets
 *   save()   for once one's been set
 *   shown    the sizes it's drawn at: `sizes`, but for a moment as the tab comes to show
 *            (`active()`), when they start at the last tab's, and slide to its own
 */
export function usePaneSizes(path, active = () => true) {
  const sizes = reactive({ sidebar: panes.sidebar, history: panes.history, terminal: panes.terminal });
  const shown = reactive({ ...sizes });
  // The frame of a slide under way, or 0.
  let sliding = 0;
  const fit = () => (sizes.terminal = Math.min(sizes.terminal, tallestTerminal()));
  watch(
    path,
    (now) => {
      Object.assign(sizes, { sidebar: panes.sidebar, history: panes.history, terminal: panes.terminal }, readJson(SIZES_KEY, {})[now]);
      fit();
    },
    { immediate: true },
  );
  watch(fits, fit);

  // Coming to show, it starts at the last tab's sizes, drawn so, then slides to its own,
  // a frame at a time, each pane heading for its size as it is then, so one set by
  // dragging an edge meanwhile is where it ends up. Seen at once, before its own are
  // noted as the last shown, which would leave none to slide from.
  watch(
    active,
    (now) => {
      cancelAnimationFrame(sliding);
      sliding = 0;
      if (!now) return;
      const from = lastShown;
      const moving = Object.keys(sizes).filter((key) => from && from[key] !== sizes[key]);
      if (!moving.length || stillness()?.matches) {
        Object.assign(shown, sizes);
        return;
      }
      Object.assign(shown, from);
      let start = null;
      const step = (time) => {
        start ??= time;
        const t = Math.min(1, (time - start) / PANE_SLIDE_MS);
        for (const key of moving) shown[key] = from[key] + (sizes[key] - from[key]) * easeOut(t);
        sliding = t < 1 ? requestAnimationFrame(step) : 0;
        if (t >= 1) Object.assign(shown, sizes);
      };
      sliding = requestAnimationFrame(step);
    },
    { flush: "sync" },
  );
  onBeforeUnmount(() => cancelAnimationFrame(sliding));

  // Drawn as they are, but while sliding, when they're on their way there; and those of
  // the tab showing noted, for the next, mid-slide too, or none without panes showing.
  watch(sizes, () => sliding || Object.assign(shown, sizes));
  watch(
    () => active() && (path() ? { ...shown } : null),
    (now) => now !== false && (lastShown = now),
    { immediate: true },
  );

  function save() {
    const set = { sidebar: sizes.sidebar, history: sizes.history, terminal: sizes.terminal };
    Object.assign(panes, set);
    writeJson(KEY, set);
    const at = path();
    if (!at) return;
    // Read afresh, with other windows' saves taken in, so theirs aren't saved over.
    const all = readJson(SIZES_KEY, {});
    delete all[at];
    all[at] = set;
    const keys = Object.keys(all);
    for (const key of keys.slice(0, Math.max(0, keys.length - MOST_KEPT))) delete all[key];
    writeJson(SIZES_KEY, all);
  }

  return { sizes, save, shown };
}
