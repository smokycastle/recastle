import { afterEach, expect, test } from "vitest";
import { createApp, h, ref } from "vue";
import { inActiveWorkspace, provideActive, provideShown } from "./activeWorkspace.js";

let app;
afterEach(() => app?.unmount());

// A component inside a workspace whose `active` is given, reading it as it changes.
function within(active) {
  let read;
  const Inside = { setup: () => ((read = inActiveWorkspace()), () => h("div")) };
  app = createApp({
    setup() {
      if (active) provideActive(() => active.value);
      return () => h(Inside);
    },
  });
  app.mount(document.createElement("div"));
  return () => read();
}

test("a component reads whether its workspace is the one showing, as it changes", () => {
  const active = ref(true);
  const read = within(active);
  expect(read()).toBe(true);
  active.value = false;
  expect(read()).toBe(false);
});

test("outside a workspace, it's showing", () => {
  expect(within(null)()).toBe(true);
});

test("a part of the workspace kept hidden is showing only while it's shown and the workspace is", () => {
  const active = ref(true);
  const shown = ref(false);
  let read;
  const Inside = { setup: () => ((read = inActiveWorkspace()), () => h("div")) };
  const Part = { setup: () => (provideShown(() => shown.value), () => h(Inside)) };
  app = createApp({ setup: () => (provideActive(() => active.value), () => h(Part)) });
  app.mount(document.createElement("div"));
  expect(read()).toBe(false);
  shown.value = true;
  expect(read()).toBe(true);
  active.value = false;
  expect(read()).toBe(false);
});
