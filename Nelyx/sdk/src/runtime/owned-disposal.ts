// SPDX-License-Identifier: BSD-3-Clause
import { DisposalSequence, PendingDisposalError } from '@nelyx/core/foundation/disposable';
import type { DisposalStep } from '@nelyx/core/foundation/disposable';
/** Keep facade/effect promises current when an explicit recovery resumes an inner owner. */
export class OwnedDisposal {
  private readonly sequence: DisposalSequence;
  private closing: Promise<void> | undefined;
  constructor(
    steps: readonly DisposalStep[],
    private readonly onAttempt?: (promise: Promise<void>) => void,
  ) {
    this.sequence = new DisposalSequence(steps);
  }
  get status() {
    return this.sequence.status;
  }
  dispose(): Promise<void> {
    return this.closing ?? this.observe(this.sequence.dispose());
  }
  retryDispose(): Promise<void> {
    if (this.sequence.status.state === 'closing' || this.sequence.status.state === 'closed')
      return this.closing!;
    if (!this.sequence.status.recoverable)
      return Promise.reject(new Error('No explicitly recoverable effect disposal is pending'));
    return this.observe(this.sequence.retryDispose());
  }
  private observe(promise: Promise<void>): Promise<void> {
    const result = promise.catch((error) => {
      if (error instanceof PendingDisposalError)
        throw new PendingDisposalError([error], () => this.retryDispose());
      throw error;
    });
    this.closing = result;
    this.onAttempt?.(result);
    return result;
  }
}
/** At host boundaries, at most two safe recovery callbacks precede a retained failure. */
export async function finishOwnedDisposal(operation: () => void | Promise<void>): Promise<void> {
  let next = operation;
  for (let attempt = 0; ; attempt++)
    try {
      await next();
      return;
    } catch (error) {
      if (!(error instanceof PendingDisposalError) || attempt >= 2) throw error;
      next = error.retry;
    }
}
