/**
 * 有限并发执行 tasks
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} limit
 * @param {(done: number, total: number, last: T) => void} [onProgress]
 */
export async function mapPool(tasks, limit, onProgress) {
  const results = new Array(tasks.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
      done++;
      onProgress?.(done, tasks.length, results[i]);
    }
  }

  const n = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
