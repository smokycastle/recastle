<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Files, GitCommitHorizontal } from "lucide-vue-next";
import { formatAgo } from "../lib/format.js";
import { oneAtATime } from "../lib/oneAtATime.js";
import { provideShown } from "../lib/activeWorkspace.js";
import CommitDetails from "./CommitDetails.vue";
import IssueError from "./IssueError.vue";
import Spinner from "./Spinner.vue";

// A pull request's commits, and its changes: all of them, as GitHub shows them, or one
// commit's. Read from the repository, so they show as any commit's do, its commits
// fetched from GitHub first where they aren't here (see pull_changes).
const props = defineProps({
  path: { type: String, required: true },
  // { owner, repo }
  repo: { type: Object, required: true },
  number: { type: Number, required: true },
  // Whether "#123" in a commit's message links to that issue.
  issueLinks: { type: Boolean, default: false },
  // Whether it's showing, rather than kept, hidden, behind the conversation: hidden,
  // what listens to the whole window in it, as C to comment on the lines picked in a
  // diff, doesn't act (see provideShown).
  shown: { type: Boolean, default: true },
  // Read again with each refresh, as the conversation is, so what's pushed to the pull
  // request shows, and a fetch that failed is tried again.
  refreshKey: { type: Number, default: 0 },
});
// "show-issue" asks to open an issue a commit's message mentions, by number.
const emit = defineEmits(["show-issue"]);

// { base, head, base_name, head_name, commits, more } (see pull_changes).
const changes = shallowRef(null);
// Why the commits couldn't be read; or once they have been, why reading them again
// couldn't, while they're still shown, as they were.
const error = ref("");
const refreshError = ref("");
// The commit whose changes show, by id, or null for all of them.
const chosen = ref(null);

// One read at a time for each pull request (see oneAtATime): while an agent works,
// refreshes come faster than GitHub answers and the commits are fetched. `pullKey`
// changes as another pull request's chosen, whose read starts straight away, the one
// before's result left unshown, and its fetch stopped (see PullFetches).
let pullKey = 0;
const reads = oneAtATime(async (key) => {
  try {
    const result = await invoke("pull_changes", {
      path: props.path,
      owner: props.repo.owner,
      repo: props.repo.repo,
      number: props.number,
    });
    if (key !== pullKey) return;
    changes.value = result;
    error.value = "";
    refreshError.value = "";
    // A commit chosen that's gone, as when the pull request's been rebased.
    if (!result.commits.some((c) => c.id === chosen.value)) chosen.value = null;
  } catch (e) {
    if (key !== pullKey) return;
    // A read again that fails, offline say, keeps what was read before, saying so.
    if (changes.value) refreshError.value = String(e);
    else error.value = String(e);
  }
});
const load = () => reads.run(pullKey);
// Gone, as on leaving the pull requests, nothing more's read, nor shown when it's back.
onBeforeUnmount(() => {
  pullKey++;
  reads.stop();
});
provideShown(() => props.shown);

function tryAgain() {
  error.value = "";
  refreshError.value = "";
  load();
}

watch(
  [() => props.path, () => props.repo.owner, () => props.repo.repo, () => props.number],
  () => {
    pullKey++;
    changes.value = null;
    error.value = "";
    refreshError.value = "";
    chosen.value = null;
    load();
  },
  { immediate: true },
);
watch(() => props.refreshKey, load);

// Named by their branches, its comments kept with the pull request rather than its
// commits, so they stay on its changes as it's pushed to (see FileDiff).
const comparison = computed(
  () =>
    changes.value && {
      base: changes.value.base,
      head: changes.value.head,
      names: { base: changes.value.base_name, head: changes.value.head_name },
      review: `pull:${props.repo.owner}/${props.repo.repo}#${props.number}`,
    },
);
const commit = computed(() => {
  const found = changes.value?.commits.find((c) => c.id === chosen.value);
  return found ? { id: found.id, short_id: found.short_id, refs: [] } : null;
});
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
</script>

<template>
  <div class="pull-commits">
    <div v-if="error" class="message failed">
      <IssueError :error="error" />
      <button class="secondary-button" @click="tryAgain">Try Again</button>
    </div>
    <div v-else-if="!changes" class="message dim"><Spinner /> Fetching the pull request's commits…</div>

    <template v-else>
      <div v-if="refreshError" class="refresh-error">
        <span class="dim">Couldn't read the commits again.</span>
        <!-- As it came, so one about the token still offers to change it (see issueError). -->
        <IssueError :error="refreshError" />
        <button class="secondary-button" @click="tryAgain">Try Again</button>
      </div>
      <div class="commit-list">
        <button class="row" :class="{ selected: !chosen }" @click="chosen = null">
          <Files :size="15" class="dim" />
          <span class="summary">All changes</span>
          <span class="dim when">{{ plural(changes.commits.length, "commit") }}{{ changes.more ? " or more" : "" }}</span>
        </button>
        <button
          v-for="c in changes.commits"
          :key="c.id"
          class="row"
          :class="{ selected: chosen === c.id }"
          @click="chosen = c.id"
        >
          <GitCommitHorizontal :size="15" class="dim" />
          <span class="mono dim">{{ c.short_id }}</span>
          <span class="summary">{{ c.summary }}</span>
          <span class="dim when">{{ c.author_name }}, {{ formatAgo(new Date(c.time * 1000).toISOString()) }}</span>
        </button>
        <p v-if="changes.more" class="dim more">Only the first {{ changes.commits.length }} commits are listed.</p>
      </div>
      <CommitDetails v-if="commit" :path="path" :commit="commit" :issue-links="issueLinks" @show-issue="emit('show-issue', $event)" />
      <CommitDetails v-else :path="path" :comparison="comparison" />
    </template>
  </div>
</template>

<style scoped>
.pull-commits {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 16px;
  font-size: var(--font-ui);
}

.refresh-error {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  font-size: var(--font-ui);
}

.message.failed {
  flex-direction: column;
  align-items: flex-start;
}

/* At most a third of the pane, scrolling, so the changes have room below. */
.commit-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 33%;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px;
  border-bottom: 1px solid var(--border);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  font: inherit;
  font-size: var(--font-md);
  text-align: left;
  color: var(--text-primary);
}

.row:hover {
  background: var(--row-hover);
}

.row.selected {
  background: var(--row-selected);
}

.mono {
  font-family: ui-monospace, "Ubuntu Mono", "DejaVu Sans Mono", monospace;
  font-size: var(--font-sm);
}

.summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.when {
  flex-shrink: 0;
  font-size: var(--font-sm);
}

.more {
  margin: 4px 8px;
  font-size: var(--font-sm);
}
</style>
