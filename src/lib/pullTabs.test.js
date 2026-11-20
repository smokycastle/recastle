import { expect, test } from "vitest";
import { nextTick, ref } from "vue";
import { usePullTabs } from "./pullTabs.js";

function setUp() {
  const number = ref(7);
  return { number, ...usePullTabs(() => number.value) };
}

test("a pull request's commits aren't opened till they're asked for, then stay while its conversation shows", async () => {
  const { tab, commitsOpened, commitsShown } = setUp();
  expect([tab.value, commitsOpened.value, commitsShown.value]).toEqual(["conversation", false, false]);

  tab.value = "commits";
  await nextTick();
  expect([commitsOpened.value, commitsShown.value]).toEqual([true, true]);

  tab.value = "conversation";
  await nextTick();
  expect([commitsOpened.value, commitsShown.value]).toEqual([true, false]);
});

test("another pull request chosen opens its commits only if they're what shows", async () => {
  const { number, tab, commitsOpened } = setUp();
  tab.value = "commits";
  await nextTick();
  tab.value = "conversation";
  await nextTick();

  number.value = 8;
  await nextTick();
  expect(commitsOpened.value).toBe(false);

  tab.value = "commits";
  await nextTick();
  number.value = 9;
  await nextTick();
  expect([tab.value, commitsOpened.value]).toEqual(["commits", true]);
});

test("with no pull request chosen, its commits don't show, though the tab's kept for the next", async () => {
  const { number, tab, commitsShown } = setUp();
  tab.value = "commits";
  number.value = null;
  await nextTick();
  expect([tab.value, commitsShown.value]).toEqual(["commits", false]);
});
