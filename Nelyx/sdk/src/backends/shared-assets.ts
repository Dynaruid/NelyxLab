interface Entry<T> {
  readonly ready: Promise<T>;
  owners: number;
}
/** Share decoded assets while overlapping platform owners are attaching/draining. */
export class SharedAssetPool<TKey extends object, TValue> {
  private entries = new WeakMap<TKey, Entry<TValue>>();
  constructor(
    private load: (key: TKey) => Promise<TValue>,
    private retire: (value: TValue) => void | Promise<void>,
  ) {}
  acquire(key: TKey): { readonly ready: Promise<TValue>; release(): Promise<void> } {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { ready: Promise.resolve().then(() => this.load(key)), owners: 0 };
      this.entries.set(key, entry);
    }
    entry.owners++;
    const current = entry;
    let close: Promise<void> | undefined;
    return {
      ready: current.ready,
      release: () => {
        if (close) return close;
        if (--current.owners > 0) return (close = Promise.resolve());
        if (this.entries.get(key) === current) this.entries.delete(key);
        return (close = current.ready.then(
          (value) => this.retire(value),
          () => {},
        ));
      },
    };
  }
}
