// SPDX-License-Identifier: BSD-3-Clause
import type {
  Element,
  ElementBuildDiagnosticObserver,
} from '@nelyx/core/framework/widgets/framework';
import type { SourceDiagnosticClock } from './source-preparation.ts';

type Type = { id: number; name: string; calls: number; empty: number; populated: number };
type Sample = {
  sequence: number;
  type: number;
  childrenBefore: number;
  started: number;
  elapsedMs: number;
  complete: boolean;
};
/** First two empty/nonempty rebuilds per Widget constructor. No Element, Widget
 * or State is retained, and no scheduler/lifetime/Source callback is replaced. */
export class SourceElementProfile implements ElementBuildDiagnosticObserver {
  private readonly types = new Map<Function, Type>();
  private readonly samples: Sample[] = [];
  private calls = 0;
  private unclassified = 0;
  private limited = 0;
  private failures = 0;
  constructor(private readonly clock: SourceDiagnosticClock) {}
  active(): boolean {
    try {
      return this.clock.profileActive?.() === true;
    } catch {
      ++this.failures;
      return false;
    }
  }
  begin(element: Element): number | undefined {
    ++this.calls;
    try {
      const constructor = element.widget.constructor;
      if (typeof constructor !== 'function') {
        ++this.unclassified;
        return;
      }
      let type = this.types.get(constructor);
      if (!type) {
        if (this.types.size === 128) {
          ++this.unclassified;
          return;
        }
        const name = constructor.name;
        if (typeof name !== 'string') {
          ++this.unclassified;
          return;
        }
        type = {
          id: this.types.size + 1,
          name: name.slice(0, 128),
          calls: 0,
          empty: 0,
          populated: 0,
        };
        this.types.set(constructor, type);
      }
      ++type.calls;
      const childrenBefore = element.children.length;
      if (!Number.isSafeInteger(childrenBefore) || childrenBefore < 0) {
        ++this.failures;
        return;
      }
      const kind = childrenBefore === 0 ? 'empty' : 'populated';
      if (type[kind] === 2 || this.samples.length === 512) {
        ++this.limited;
        return;
      }
      ++type[kind];
      const token = this.samples.length;
      const sample = {
        sequence: token + 1,
        type: type.id,
        childrenBefore,
        started: 0,
        elapsedMs: 0,
        complete: false,
      };
      this.samples.push(sample);
      const started = this.clock.now();
      if (!Number.isFinite(started) || started <= 0) {
        ++this.failures;
        return;
      }
      sample.started = started;
      return token;
    } catch {
      ++this.failures;
      return;
    }
  }
  end(token: number): void {
    try {
      const ended = this.clock.now(),
        sample = this.samples[token];
      if (!sample || sample.complete || !Number.isFinite(ended) || ended < sample.started) {
        ++this.failures;
        return;
      }
      sample.elapsedMs = ended - sample.started;
      sample.complete = true;
    } catch {
      ++this.failures;
    }
  }
  diagnostics() {
    return {
      schema: 'nelyx.app.source-element-profile/v1',
      domain: this.clock.domain,
      scope: 'flushed-dirty-element-rebuild',
      sampling: 'first-two-per-constructor-and-empty-or-populated-children',
      calls: this.calls,
      unclassified: this.unclassified,
      limited: this.limited,
      failures: this.failures,
      capacity: 512,
      typeCapacity: 128,
      types: [...this.types.values()].map((type) => ({ ...type })),
      samples: this.samples.map((sample) => ({ ...sample })),
    };
  }
}
