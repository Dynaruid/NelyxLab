export interface Disposable {
  dispose(): void | Promise<void>;
}

/** The retry callback explicitly completes this failed disposal; arbitrary dispose() is never replayed. */
export class PendingDisposalError extends AggregateError {
  constructor(
    errors: Iterable<unknown>,
    readonly retry: () => void | Promise<void>,
  ) {
    super(errors, 'Disposal completion unconfirmed; explicit recovery is available');
    this.name = 'PendingDisposalError';
  }
}
export interface DisposalStep {
  readonly name: string;
  readonly run: () => void | Promise<void>;
}
/** Resume at one acknowledged owner boundary, preserving already completed steps. */
export class DisposalSequence implements Disposable {
  private index = 0;
  private running = false;
  private failed = false;
  private finished = false;
  private pending: PendingDisposalError | undefined;
  private closing: Promise<void> | undefined;
  private readonly steps: readonly DisposalStep[];
  constructor(steps: readonly DisposalStep[]) {
    this.steps = Object.freeze(steps.map((step) => Object.freeze({ ...step })));
  }
  get status(): Readonly<{
    state: 'open' | 'closing' | 'blocked' | 'closed';
    phase: string | null;
    recoverable: boolean;
  }> {
    return Object.freeze({
      state: this.finished ? 'closed' : this.running ? 'closing' : this.failed ? 'blocked' : 'open',
      phase: this.steps[this.index]?.name ?? null,
      recoverable: !this.running && this.pending !== undefined,
    });
  }
  dispose(): Promise<void> {
    return this.closing ?? this.start();
  }
  retryDispose(): Promise<void> {
    if (this.running || this.finished) return this.closing!;
    if (!this.pending)
      return Promise.reject(new Error('No explicitly recoverable disposal is pending'));
    const resume = this.pending.retry;
    this.pending = undefined;
    return this.start(resume);
  }
  private start(resume?: () => void | Promise<void>): Promise<void> {
    let resolve!: () => void, reject!: (error: unknown) => void;
    const result = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    this.closing = result;
    this.running = true;
    this.failed = false;
    void Promise.resolve()
      .then(async () => {
        try {
          if (resume) {
            await resume();
            this.index++;
          }
          while (this.index < this.steps.length) {
            await this.steps[this.index]!.run();
            this.index++;
          }
          this.finished = true;
        } catch (error) {
          this.failed = true;
          if (error instanceof PendingDisposalError) {
            this.pending = error;
            throw new PendingDisposalError([error], () => this.retryDispose());
          }
          throw error;
        } finally {
          this.running = false;
        }
      })
      .then(resolve, reject);
    return result;
  }
}
