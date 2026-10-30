// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
export type ConnectionState = 'none' | 'waiting' | 'active' | 'done';
export class AsyncSnapshot<T> {
  constructor(
    readonly connectionState: ConnectionState,
    readonly data: T | undefined = undefined,
    readonly error: unknown = null,
    readonly hasError = error !== null,
  ) {
    Object.freeze(this);
  }
  get hasData(): boolean {
    return this.data !== undefined;
  }
  requireData(): T {
    if (this.hasError) throw this.error;
    if (!this.hasData) throw new Error('Snapshot has no data');
    return this.data!;
  }
}
type SnapshotBuilder<T> = (context: BuildContext, snapshot: AsyncSnapshot<T>) => Widget;
export interface FutureBuilderOptions<T> extends WidgetOptions {
  readonly future: PromiseLike<T> | null;
  readonly initialData?: T;
  readonly builder: SnapshotBuilder<T>;
}
export class FutureBuilder<T> extends StatefulWidget {
  constructor(readonly options: FutureBuilderOptions<T>) {
    super(options.key ?? null);
  }
  createState(): State {
    return new FutureBuilderState<T>();
  }
}
class FutureBuilderState<T> extends State<FutureBuilder<T>> {
  private epoch = 0;
  private snapshot!: AsyncSnapshot<T>;
  private connect(): void {
    const epoch = ++this.epoch,
      future = this.widget.options.future;
    this.snapshot = new AsyncSnapshot(
      future ? 'waiting' : 'none',
      this.snapshot?.data ?? this.widget.options.initialData,
    );
    if (future)
      void Promise.resolve(future).then(
        (data) => {
          if (this.mounted && epoch === this.epoch)
            this.setState(() => {
              this.snapshot = new AsyncSnapshot('done', data);
            });
        },
        (error) => {
          if (this.mounted && epoch === this.epoch)
            this.setState(() => {
              this.snapshot = new AsyncSnapshot<T>('done', undefined, error, true);
            });
        },
      );
  }
  override initState(): void {
    this.connect();
  }
  override didUpdateWidget(old: FutureBuilder<T>): void {
    if (old.options.future !== this.widget.options.future) this.connect();
  }
  override dispose(): void {
    this.epoch++;
    super.dispose();
  }
  build(context: BuildContext): Widget {
    return this.widget.options.builder(context, this.snapshot);
  }
}
export interface StreamObserver<T> {
  next(value: T): void;
  error(error: unknown): void;
  complete(): void;
}
export interface WidgetStream<T> {
  subscribe(observer: StreamObserver<T>): { dispose(): void };
}
export interface StreamBuilderOptions<T> extends WidgetOptions {
  readonly stream: WidgetStream<T> | null;
  readonly initialData?: T;
  readonly builder: SnapshotBuilder<T>;
}
export class StreamBuilder<T> extends StatefulWidget {
  constructor(readonly options: StreamBuilderOptions<T>) {
    super(options.key ?? null);
  }
  createState(): State {
    return new StreamBuilderState<T>();
  }
}
class StreamBuilderState<T> extends State<StreamBuilder<T>> {
  private epoch = 0;
  private snapshot!: AsyncSnapshot<T>;
  private subscription: { dispose(): void } | undefined;
  private connect(): void {
    const epoch = ++this.epoch,
      old = this.subscription;
    this.subscription = undefined;
    old?.dispose();
    const stream = this.widget.options.stream;
    this.snapshot = new AsyncSnapshot(
      stream ? 'waiting' : 'none',
      this.snapshot?.data ?? this.widget.options.initialData,
    );
    let subscribing = true,
      done = false;
    const update = (snapshot: AsyncSnapshot<T>) => {
      if (done || epoch !== this.epoch || !this.mounted) return;
      if (subscribing) this.snapshot = snapshot;
      else
        this.setState(() => {
          this.snapshot = snapshot;
        });
    };
    if (stream) {
      try {
        const lease = stream.subscribe({
          next: (data) => update(new AsyncSnapshot('active', data)),
          error: (error) => update(new AsyncSnapshot<T>('active', undefined, error, true)),
          complete: () => {
            if (done || epoch !== this.epoch || !this.mounted) return;
            update(
              new AsyncSnapshot(
                'done',
                this.snapshot.data,
                this.snapshot.error,
                this.snapshot.hasError,
              ),
            );
            done = true;
            if (!subscribing) {
              const lease = this.subscription;
              this.subscription = undefined;
              lease?.dispose();
            }
          },
        });
        if (epoch === this.epoch && !done) this.subscription = lease;
        else lease.dispose();
      } catch (error) {
        this.snapshot = new AsyncSnapshot<T>('done', undefined, error, true);
        done = true;
      } finally {
        subscribing = false;
      }
    }
  }
  override initState(): void {
    this.connect();
  }
  override didUpdateWidget(old: StreamBuilder<T>): void {
    if (old.options.stream !== this.widget.options.stream) this.connect();
  }
  override dispose(): void {
    this.epoch++;
    const subscription = this.subscription;
    this.subscription = undefined;
    subscription?.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    return this.widget.options.builder(context, this.snapshot);
  }
}
