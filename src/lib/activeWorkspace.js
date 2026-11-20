import { inject, provide } from "vue";

// Whether the workspace a component is in is the one showing in its window. A window can
// hold several, each kept running while another shows (see Workspace.vue), so what
// listens to the whole window, as for a key, acts only in the one showing.

const ACTIVE = Symbol("active workspace");

/** Says, to the components in the calling workspace, whether it's showing: `active()`. */
export const provideActive = (active) => provide(ACTIVE, active);

/** Whether the workspace the calling component is in is showing; true outside one. */
export function inActiveWorkspace() {
  const active = inject(ACTIVE, () => true);
  return () => active();
}

/**
 * Says, to the components inside the calling one, that they're showing only while
 * `shown()` and their workspace is: for a part of it kept, hidden, while another
 * shows, as a pull request's Commits tab behind its conversation, so what listens to
 * the whole window doesn't act in it unseen.
 */
export function provideShown(shown) {
  const outer = inActiveWorkspace();
  provideActive(() => outer() && shown());
}
