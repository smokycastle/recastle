import { computed, ref, watch } from "vue";

/**
 * What the chosen pull request shows, of `number()`, its number or null when none is
 * chosen: its "conversation" or its "commits" as `tab`, kept from one pull request to
 * the next. `commitsOpened` says whether its commits have been shown: they stay, hidden,
 * while its conversation shows, so coming back to them is as they were left, but
 * they're not fetched for a pull request until they're asked for. `commitsShown` says
 * whether they're showing now, for what goes with them, as the review comments to send.
 */
export function usePullTabs(number) {
  const tab = ref("conversation");
  const commitsOpened = ref(false);
  watch(tab, (now) => now === "commits" && (commitsOpened.value = true));
  watch(number, () => (commitsOpened.value = tab.value === "commits"));
  const commitsShown = computed(() => number() != null && tab.value === "commits");
  return { tab, commitsOpened, commitsShown };
}
