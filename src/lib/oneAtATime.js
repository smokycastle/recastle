/**
 * `work(key)`, run one at a time, as reading what an agent keeps changing is. Asked for
 * again while it's running, it runs once more when that's done, however many times it
 * was asked meanwhile: nothing's missed, but runs don't pile up, nor does each take the
 * place of the one before, so that none is ever done while they keep being asked for.
 * Asked for with another `key`, as for another pull request, it runs straight away, the
 * one under way left to finish on its own. `pending()` says whether it's to run once more,
 * and `stop()` that it isn't, nor anything that's under way to run again, as what it's
 * for goes.
 */
export function oneAtATime(work) {
  let current = null;
  let again = false;
  function run(key = null) {
    if (current && current.key === key) {
      again = true;
      return;
    }
    const mine = { key };
    current = mine;
    again = false;
    (async () => work(key))().finally(() => {
      if (current !== mine) return;
      current = null;
      if (again) run(key);
    });
  }
  function stop() {
    current = null;
    again = false;
  }
  return { run, pending: () => again, stop };
}
