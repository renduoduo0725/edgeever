/** Runs async work for one key in order. A newer call waits until the previous one settles. */
export const createPluginScheduleQueue = () => {
  const tails = new Map<string, Promise<void>>();

  return {
    enqueue<T>(key: string, run: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      const result = previous.catch(() => undefined).then(run);
      const tail = result.then(() => undefined, () => undefined);
      tails.set(key, tail);
      void tail.finally(() => {
        if (tails.get(key) === tail) tails.delete(key);
      });
      return result;
    },
  };
};
