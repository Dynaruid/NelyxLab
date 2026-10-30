// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { StrutStyle } from '@nelyx/core/framework/painting/strut-style';
import { TextPosition } from '@nelyx/core/ui/text-position';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';
import { textLimits, admitTextLayoutResources, freezeTextInput } from '@nelyx/core/ui/text';
import { ParagraphBuilder } from '@nelyx/core/ui/paragraph-builder';
import { ParagraphStyle } from '@nelyx/core/ui/paragraph-style';
import { ParagraphConstraints } from '@nelyx/core/ui/paragraph-constraints';
import { RenderParagraph, RenderRichParagraph } from '@nelyx/core/framework/rendering/paragraph';
import { PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { Paint } from '@nelyx/core/ui/paint';
import { Locale } from '@nelyx/core/ui/locale';
import { TextHeightBehavior } from '@nelyx/core/ui/typography';
import { engineFixture } from '../../../packages/material/tests/engine-fixture.mjs';

const timeout = 1_200_000;
const span = (color) =>
  new TextSpan({ text: '한글 A😀 label', style: new TextStyle({ fontSize: 16, color }) });
function context(f) {
  return {
    text: f.library,
    resources: f.root.context.resources,
    font: f.root.context.defaultFont,
    scale: 1,
  };
}
function painter(owner, options = {}) {
  return new TextPainter({ text: span(0xff000000), textDirection: 'ltr', ...options }, owner);
}

test(
  'a direct rich renderer owns its source painter and retires the laid-out paragraph through the shared registry',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      ctx = context(f),
      source = new RenderParagraph(span(0xff123456), { textDirection: 'rtl' }, ctx),
      pipeline = new PipelineOwner();
    let direct;
    try {
      direct = new RenderRichParagraph(source.config, ctx);
      pipeline.setRoot(direct);
      pipeline.flushLayout({ width: 180, height: 80 });
      assert.equal(direct.paragraph.input.text, '한글 A😀 label');
      assert.equal(direct.textDirection, 'rtl');
      assert(direct.paragraph.height > 0);
      const position = direct.getPositionForOffset({ x: 40, y: 8 });
      assert(position.offset >= 0 && position.offset <= direct.paragraph.input.text.length);
      const resource = direct.paragraph.resource;
      assert(ctx.resources.hasInitialProducer(resource));
      pipeline.setRoot(undefined);
      assert.equal(direct.paragraph, undefined);
      assert.equal(
        ctx.resources.hasInitialProducer(resource),
        false,
        'Detach releases the renderer producer while the cache owns its separate lease',
      );
    } finally {
      pipeline.setRoot(undefined);
      direct?.dispose();
      pipeline.dispose();
      source.dispose();
      await f.close();
    }
  },
);

test(
  'source renderer configuration defers unused run and strut serialization until paragraph preparation',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      events = [],
      pipeline = new PipelineOwner();
    let render;
    class Style extends TextStyle {
      toRunStyle(...args) {
        events.push('run');
        return super.toRunStyle(...args);
      }
    }
    class Strut extends StrutStyle {
      toStyle(...args) {
        events.push('strut');
        return super.toStyle(...args);
      }
    }
    try {
      const style = new Style({ fontSize: 16, color: 0xff123456 }),
        strutStyle = new Strut({ fontSize: 20, height: 1, forceStrutHeight: true });
      render = new RenderParagraph(
        new TextSpan({ text: 'source 한글' }),
        { textDirection: 'rtl', baseStyle: style, strutStyle },
        context(f),
      );
      assert.deepEqual(events, []);
      assert.equal('input' in render.config, false);
      pipeline.setRoot(render);
      pipeline.flushLayout({ width: 180, height: 80 });
      assert(events.includes('strut'));
      assert.equal(render.paragraph.input.text, 'source 한글');
      assert.equal(render.paragraph.input.direction, 'rtl');
      assert.equal(render.selectionPainter.preferredLineHeight, 20);
    } finally {
      pipeline.setRoot(undefined);
      render?.dispose();
      pipeline.dispose();
      await f.close();
    }
  },
);

test(
  'rich source configuration captures borrowed fields once and cannot change through a caller-owned options record',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      ctx = context(f),
      source = new RenderParagraph(span(0xff123456), { textDirection: 'ltr' }, ctx),
      reads = [],
      optionReads = [],
      options = { textDirection: 'ltr', textAlign: 'start' };
    let render,
      align = 'start';
    const borrowedOptions = new Proxy(options, {
        get(target, key, receiver) {
          optionReads.push(key);
          return Reflect.get(target, key, receiver);
        },
      }),
      value = { ...source.config, painterOptions: borrowedOptions, placeholderCount: 0 };
    delete value.placeholders;
    Object.defineProperty(value, 'opaque', {
      enumerable: true,
      get() {
        throw Error('Unconsumed metadata must not be read');
      },
    });
    const external = new Proxy(value, {
      get(target, key, receiver) {
        reads.push(key);
        return Reflect.get(target, key, receiver);
      },
    });
    Object.defineProperty(options, 'textAlign', {
      get() {
        assert.equal(this, borrowedOptions);
        return align;
      },
      set(value) {
        align = value;
      },
    });
    Object.defineProperty(value, 'scale', {
      get() {
        assert.equal(this, external);
        return 1;
      },
    });
    try {
      render = new RenderRichParagraph(external, ctx);
      assert.notEqual(render.config, external);
      assert(Object.isFrozen(render.config));
      assert(Object.isFrozen(render.config.painterOptions));
      assert.equal('placeholders' in render.config, false);
      assert.equal(render.config.placeholderCount, 0);
      assert.equal(new Set(reads).size, reads.length);
      assert.equal(new Set(optionReads).size, optionReads.length);
      options.textDirection = 'rtl';
      options.textAlign = 'end';
      assert.equal(render.textDirection, 'ltr');
      assert.equal(render.config.painterOptions.textAlign, 'start');
      render.config = { ...render.config, painterOptions: borrowedOptions };
      assert.equal(render.textDirection, 'rtl');
      const before = render.config;
      for (const failure of [0, null, undefined]) {
        const next = { ...before };
        Object.defineProperty(next, 'font', {
          get() {
            throw failure;
          },
        });
        assert.throws(
          () => {
            render.config = next;
          },
          (error) => error === failure,
        );
        assert.equal(render.config, before);
      }
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      render?.dispose();
      source.dispose();
      await f.close();
    }
  },
);

test(
  'source measurements reuse one captured span before painting and keep geometry independent of native producer retirement',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f);
    let builds = 0,
      p;
    class Source extends TextSpan {
      build(...args) {
        builds++;
        return super.build(...args);
      }
    }
    try {
      p = painter(owner, {
        text: new Source({
          text: '한글 العربية label label label',
          style: new TextStyle({ fontSize: 16 }),
        }),
      });
      const narrow = p._measure(70),
        wide = p._measure(200);
      assert(narrow.height > wide.height);
      assert.equal(p._measure(70), narrow);
      assert(Object.isFrozen(narrow.lines[0].bounds));
      assert.equal(builds, 1);
      assert.equal(f.library.debugTextStats.producers, 0);
      p.layout({ minWidth: 70, maxWidth: 70 });
      assert.equal(builds, 1, 'The painted owner consumes the same prepared source paragraph');
      assert.equal(p.height, narrow.height);
      const resource = p._layoutSnapshot().resource;
      p._measure(100);
      assert.equal(builds, 1);
      assert(owner.resources.hasInitialProducer(resource));
      assert.equal(f.library.debugTextStats.producers, 1);
      p._releaseLayoutResources();
      assert.equal(f.library.debugTextStats.producers, 0);
      assert(
        narrow.lines.every((line) => Number.isFinite(line.baseline) && line.bounds.height > 0),
      );
      p._measure(70);
      assert.equal(builds, 2);
      p.dispose();
      p = undefined;
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      p?.dispose();
      await f.close();
    }
  },
);

test(
  'dry text layout matches painted alignment and width policies without retaining native producers',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f);
    let dry, painted;
    try {
      for (const textDirection of ['ltr', 'rtl'])
        for (const textAlign of ['start', 'center', 'right'])
          for (const textWidthBasis of ['parent', 'longestLine'])
            for (const maxWidth of [80, Infinity]) {
              const options = {
                  text: new TextSpan({
                    text: 'one 한글 two three',
                    style: new TextStyle({ fontSize: 16 }),
                  }),
                  textDirection,
                  textAlign,
                  textWidthBasis,
                },
                constraints = { minWidth: 40, maxWidth };
              dry = new TextPainter(options, owner);
              painted = new TextPainter(options, owner);
              const geometry = dry._measureLayout(constraints);
              assert.equal(f.library.debugTextStats.producers, 0);
              assert(!('resource' in geometry));
              assert(!('input' in geometry));
              assert(Object.isFrozen(geometry.lines[0].bounds));
              painted.layout(constraints);
              assert.equal(geometry.width, painted.width);
              assert.equal(geometry.height, painted.height);
              assert.equal(
                geometry.alphabeticBaseline,
                painted._layoutSnapshot().alphabeticBaseline,
              );
              assert.deepEqual(geometry.lines, painted._layoutSnapshot().lines);
              const layout = f.library.layout;
              let calls = 0;
              f.library.layout = function (...args) {
                calls++;
                return layout.apply(this, args);
              };
              try {
                painted._measure(painted._layoutSnapshot().input.width);
                assert.equal(
                  calls,
                  0,
                  'Measuring the completed width must use its current producer geometry',
                );
              } finally {
                f.library.layout = layout;
              }
              painted.dispose();
              painted = undefined;
              dry.dispose();
              dry = undefined;
              assert.equal(f.library.debugTextStats.producers, 0);
            }
    } finally {
      dry?.dispose();
      painted?.dispose();
      await f.close();
    }
  },
);

test(
  'rich dry size and baseline queries reuse geometry and font invalidation refreshes the probe',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f),
      layout = f.library.layout;
    let calls = 0,
      render;
    f.library.layout = function (...args) {
      calls++;
      return layout.apply(this, args);
    };
    try {
      render = new RenderParagraph(span(0xff123456), { textDirection: 'ltr' }, owner);
      const constraints = new BoxConstraints(0, 100, 0, 200);
      const size = render.getDryLayout(constraints),
        baseline = render.getDryBaseline(constraints, 'alphabetic');
      assert(size.height > 0);
      assert(baseline > 0);
      assert.equal(calls, 1, 'Dry baseline must reuse the size probe for the same paragraph width');
      assert.equal(f.library.debugTextStats.producers, 0);
      render.markNeedsLayout();
      render.getDryLayout(constraints);
      assert.equal(calls, 2, 'Explicit layout invalidation must retire the measurement cache too');
      render.systemFontsDidChange();
      render.getDryBaseline(constraints, 'alphabetic');
      assert.equal(calls, 3, 'Font notifications must retire cached source geometry');
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      render?.dispose();
      f.library.layout = layout;
      await f.close();
    }
  },
);

test(
  'source geometry failures preserve falsey backend and retirement errors while retiring the transient producer',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f),
      release = owner.resources.releaseProducer;
    let p;
    try {
      p = painter({
        ...owner,
        text: {
          layout(input, request) {
            const layout = f.library.layout(input, request);
            return new Proxy(layout, {
              get(target, key, receiver) {
                if (key === 'height') throw undefined;
                return Reflect.get(target, key, receiver);
              },
            });
          },
        },
      });
      owner.resources.releaseProducer = function (resource) {
        release.call(this, resource);
        throw null;
      };
      assert.throws(
        () => p._measure(120),
        (error) =>
          error instanceof AggregateError &&
          error.errors.length === 2 &&
          error.errors[0] === undefined &&
          error.errors[1] === null,
      );
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      owner.resources.releaseProducer = release;
      p?.dispose();
      await f.close();
    }
  },
);

test(
  'reentrant source retirement cannot publish a prepared paragraph or revive a completed native layout',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f);
    let p,
      armed = true;
    class Source extends TextSpan {
      build(...args) {
        const result = super.build(...args);
        if (armed) {
          armed = false;
          const current = p;
          p = undefined;
          current.dispose();
        }
        return result;
      }
    }
    try {
      p = painter(owner, {
        text: new Source({
          text: 'close during source capture',
          style: new TextStyle({ fontSize: 16 }),
        }),
      });
      assert.throws(() => p._measure(140), /disposed|changed|retired/);
      p = undefined;
      assert.equal(f.library.debugTextStats.producers, 0);
      let close = true;
      p = painter({
        ...owner,
        text: {
          layout(input, request) {
            const result = f.library.layout(input, request);
            if (close) {
              close = false;
              const current = p;
              p = undefined;
              current.dispose();
            }
            return result;
          },
        },
      });
      assert.throws(() => p.layout({ maxWidth: 140 }), /disposed|changed|retired/);
      p = undefined;
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      p?.dispose();
      await f.close();
    }
  },
);

test(
  'a reentrant source layout keeps the newer paragraph and a closing paint capture retires its candidate',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f);
    let p,
      again = true,
      armed = false;
    const canvas = new Canvas();
    class Source extends TextSpan {
      build(...args) {
        const result = super.build(...args);
        if (armed) {
          armed = false;
          const current = p;
          p = undefined;
          current.dispose();
        }
        return result;
      }
    }
    try {
      p = painter({
        ...owner,
        text: {
          layout(input, request) {
            if (again) {
              again = false;
              p.layout({ minWidth: 75, maxWidth: 75 });
            }
            return f.library.layout(input, request);
          },
        },
      });
      assert.throws(() => p.layout({ minWidth: 150, maxWidth: 150 }), /changed/);
      assert.equal(p.width, 75);
      assert.equal(f.library.debugTextStats.producers, 1);
      p.dispose();
      p = undefined;
      p = painter(owner, {
        text: new Source({
          text: 'paint replacement',
          style: new TextStyle({ fontSize: 16, color: 0xff123456 }),
        }),
      });
      p.layout({ maxWidth: 180 });
      p.text = new Source({
        text: 'paint replacement',
        style: new TextStyle({ fontSize: 16, color: 0xff654321 }),
      });
      armed = true;
      assert.throws(() => p.paint(canvas, Offset.zero), /disposed|changed|retired/);
      assert.equal(f.library.debugTextStats.producers, 0);
    } finally {
      p?.dispose();
      canvas.dispose();
      await f.close();
    }
  },
);

test(
  'captured paragraph creation preserves ordinary source, scaler, Paint, font, locale, strut and serialization callbacks',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      events = [];
    class Source extends TextSpan {
      toPlainText(options) {
        events.push('plain');
        return super.toPlainText(options);
      }
    }
    class Scaler extends TextScaler {
      scale(size) {
        events.push('scale:' + size);
        return size;
      }
      get textScaleFactor() {
        events.push('factor');
        return 1;
      }
    }
    class SourceLocale extends Locale {
      toString() {
        events.push('locale');
        return super.toString();
      }
    }
    class SourceStrut extends StrutStyle {
      toStyle(scaler) {
        events.push('strut');
        return super.toStyle(scaler);
      }
    }
    class SourceHeight extends TextHeightBehavior {
      toJSON() {
        events.push('height JSON');
        return {
          applyHeightToFirstAscent: this.applyHeightToFirstAscent,
          applyHeightToLastDescent: this.applyHeightToLastDescent,
          leadingDistribution: this.leadingDistribution,
        };
      }
    }
    const original = context(f).font,
      font = new Proxy(original, {
        get(target, key, receiver) {
          events.push('font:' + String(key));
          return Reflect.get(target, key, receiver);
        },
      });
    try {
      for (const kind of ['source', 'scaler', 'paint', 'font', 'locale', 'strut', 'height']) {
        const style = new TextStyle({
            fontSize: 16,
            ...(kind === 'paint'
              ? { foreground: new Paint({ color: 0xff123456 }) }
              : { color: 0xff123456 }),
          }),
          source =
            kind === 'source'
              ? new Source({ text: 'A😀', style })
              : new TextSpan({ text: 'A😀', style }),
          scaler = kind === 'scaler' ? new Scaler() : TextScaler.noScaling,
          ctx = { ...context(f), font: kind === 'font' ? font : original };
        const config = {
          span: source,
          style,
          scaler,
          placeholderCount: 0,
          font: ctx.font,
          scale: 1,
          painterOptions: { textDirection: 'ltr', textScaler: scaler },
          paragraphOptions: { overflow: 'clip', softWrap: true },
        };
        if (kind === 'locale') config.painterOptions.locale = new SourceLocale('en');
        if (kind === 'strut') config.painterOptions.strutStyle = new SourceStrut({ fontSize: 16 });
        if (kind === 'height') config.painterOptions.textHeightBehavior = new SourceHeight();
        const options = {
          ...config.painterOptions,
          textDirection: 'ltr',
          baseStyle: style,
          textScaler: scaler,
          ...config.paragraphOptions,
          devicePixelRatio: 1,
        };
        events.length = 0;
        const expected = new RenderParagraph(source, options, ctx);
        const reference = [...events];
        expected.dispose();
        events.length = 0;
        const actual = RenderParagraph._fromConfiguration(config, ctx);
        assert.deepEqual(events, reference, kind);
        assert(Object.isFrozen(actual.config));
        assert.equal(actual.config.span, config.span);
        assert.equal(actual.config.style, config.style);
        actual.dispose();
      }
    } finally {
      await f.close();
    }
  },
);

test(
  'a paragraph carries owned immutable runs to layout while external getters keep their capture boundary',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true });
    let paragraph, input;
    try {
      const ctx = {
        ...context(f),
        text: {
          layout(value, request) {
            input = value;
            return f.library.layout(value, request);
          },
        },
      };
      const builder = new ParagraphBuilder(
        new ParagraphStyle({ fontSize: 16, locale: 'ko', textDirection: 'ltr' }),
        ctx,
      );
      try {
        builder.pushStyle({
          fontFamilies: ['UI'],
          color: 0xff123456,
          fontFeatures: [{ name: 'tnum', value: 1 }],
        });
        builder.addText('한글 😀');
        builder.addPlaceholder(4, 5, 'middle');
        paragraph = builder.build();
      } finally {
        builder.dispose();
      }
      const snapshot = paragraph._textSnapshot();
      paragraph.layout(new ParagraphConstraints({ width: 220 }));
      const layout = paragraph._layoutSnapshot();
      assert(Object.isFrozen(input));
      assert.equal(layout.input.runs, snapshot.runs);
      assert.equal(layout.input.placeholders, snapshot.placeholders);
      assert(Object.isFrozen(layout.input.runs[0].style.fontFeatures));
      let reads = 0;
      const external = { ...input };
      Object.defineProperty(external, 'runs', {
        enumerable: true,
        get() {
          reads++;
          return snapshot.runs;
        },
      });
      Object.freeze(external);
      const captured = freezeTextInput(external);
      assert.equal(reads, 2, 'External getters are still read at the original validation points');
      assert.notEqual(captured.runs, snapshot.runs);
      assert.deepEqual(captured.runs, snapshot.runs);
      assert.throws(
        () => freezeTextInput({ ...input, text: 'X' }),
        /offset outside|surrogate|replacement/,
      );
    } finally {
      paragraph?.dispose();
      await f.close();
    }
  },
);

test(
  'resident count admission permits exact owned reuse and rejects foreign layouts or new allocations',
  { timeout },
  () => {
    const input = {
      text: '',
      width: 220,
      font: { id: 'font', generation: 1 },
      fontSize: 16,
      locale: 'en',
      direction: 'ltr',
      scale: 1,
    };
    const layouts = Array.from({ length: textLimits.retainedResources }, (_, index) => ({
      resource: { id: 'paragraph-' + index, generation: 1 },
      input,
    }));
    assert.throws(
      () => admitTextLayoutResources(layouts, () => 0, input),
      /Retained paragraph resource budget exhausted/,
    );
    assert.doesNotThrow(() =>
      admitTextLayoutResources(layouts, () => 0, input, {}, layouts.at(-1)),
    );
    assert.throws(
      () => admitTextLayoutResources(layouts, () => 0, input, {}, { ...layouts.at(-1) }),
      /exact retained layout owned/,
    );
  },
);

test(
  'identical immutable layouts share shaping while each painter and recording keeps an independent lifetime',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      registry = f.root.context.resources;
    const input = {
      text: 'Shared 한글 😀',
      width: 220,
      font: f.root.context.defaultFont,
      fontSize: 16,
      locale: 'ko',
      direction: 'ltr',
      scale: 1,
    };
    let lease;
    try {
      const a = f.library.layout(input),
        b = f.library.layout(input);
      assert.equal(a, b);
      assert.equal(registry.initialProducerCount(a.resource), 2);
      assert.equal(
        f.library.debugTextStats.producers,
        2,
        'Shared shaping must not bypass logical producer admission',
      );
      lease = registry.acquire([a.resource]);
      registry.releaseProducer(a.resource);
      assert.equal(registry.initialProducerCount(b.resource), 1);
      assert(f.library.hit(b, 0, 0));
      registry.releaseProducer(b.resource);
      assert(!registry.hasInitialProducer(a.resource));
      assert(registry.isRetained(a.resource));
      const reused = f.library.layout(input);
      assert.equal(
        reused,
        a,
        'A recording may keep the immutable paragraph available across lazy remounts',
      );
      registry.releaseProducer(reused.resource);
      lease.returnBy('caller');
      lease = undefined;
      assert(
        registry.isRetained(a.resource),
        'A separately bounded cache owner keeps an idle paragraph resident',
      );
      assert.throws(
        () => f.library.hit(a, 0, 0),
        /Stale\/foreign/,
        'Cached residency does not grant a released logical producer query access',
      );
      const idle = f.library.layout(input);
      assert.equal(idle, a);
      registry.releaseProducer(idle.resource);
      for (let i = 0; i < 17; i++) {
        const fill = f.library.layout({ ...input, text: 'A'.repeat(4096), color: 0xff000000 + i });
        registry.releaseProducer(fill.resource);
      }
      assert(
        !registry.isRetained(a.resource),
        'The UTF16 cache budget evicts the old idle paragraph',
      );
      const fresh = f.library.layout(input);
      assert.notDeepEqual(
        fresh.resource,
        a.resource,
        'An actually retired native paragraph cannot be revived',
      );
      registry.releaseProducer(fresh.resource);
    } finally {
      if (lease && !lease.released) lease.returnBy('caller');
      await f.close();
    }
  },
);

test(
  'custom style serialization cannot collapse different native shaping inputs into a cached paragraph',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      registry = f.root.context.resources,
      layouts = [];
    let calls = 0;
    const input = {
      text: 'Serialization 한글',
      width: 220,
      font: f.root.context.defaultFont,
      fontSize: 16,
      locale: 'ko',
      direction: 'ltr',
      scale: 1,
    };
    try {
      const a = f.library.layout({
        ...input,
        style: {
          fontSize: 12,
          toJSON() {
            calls++;
            return {};
          },
        },
      });
      layouts.push(a);
      const b = f.library.layout({
        ...input,
        style: {
          fontSize: 30,
          toJSON() {
            calls++;
            return {};
          },
        },
      });
      layouts.push(b);
      assert.notEqual(a, b);
      assert(b.height > a.height);
      assert(calls > 0);
      for (const layout of layouts) {
        registry.releaseProducer(layout.resource);
        assert(
          !registry.isRetained(layout.resource),
          'Custom serialization does not create an idle owner',
        );
      }
      layouts.length = 0;
    } finally {
      for (const layout of layouts) registry.releaseProducer(layout.resource);
      await f.close();
    }
  },
);

test(
  'extra callback and opaque style metadata cannot outlive their logical paragraph through the cache',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      registry = f.root.context.resources,
      layouts = [];
    /* oxlint-disable no-unused-private-class-members -- The opaque private allocation is retained to exercise paragraph lifetime and memory accounting. */
    class Opaque {
      #body = new Uint8Array(1024);
      constructor() {
        Object.freeze(this);
      }
    }
    /* oxlint-enable no-unused-private-class-members */
    const input = {
      text: 'Owned data only',
      width: 220,
      font: f.root.context.defaultFont,
      fontSize: 16,
      locale: 'en',
      direction: 'ltr',
      scale: 1,
    };
    try {
      for (const extra of [
        { callback: () => f },
        { opaque: new Opaque() },
        { [Symbol('private')]: () => f },
      ]) {
        const a = f.library.layout({ ...input, style: { fontSize: 16, ...extra } });
        layouts.push(a);
        const b = f.library.layout({ ...input, style: { fontSize: 16, ...extra } });
        layouts.push(b);
        assert.notEqual(a, b);
        for (const layout of layouts) {
          registry.releaseProducer(layout.resource);
          assert(
            !registry.isRetained(layout.resource),
            'Unrepresented metadata must not receive a cache lease',
          );
        }
        layouts.length = 0;
      }
    } finally {
      for (const layout of layouts) registry.releaseProducer(layout.resource);
      await f.close();
    }
  },
);

test(
  'shared layout identity changes with geometry, style and live fallback font catalog',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      registry = f.root.context.resources,
      layouts = [];
    const input = {
      text: 'Shared 한글 😀',
      width: 220,
      font: f.root.context.defaultFont,
      fontSize: 16,
      locale: 'ko',
      direction: 'ltr',
      scale: 1,
    };
    const own = (value) => {
      layouts.push(value);
      return value;
    };
    try {
      const original = own(f.library.layout(input));
      for (const change of [
        { width: 180 },
        { color: 0xffff0000 },
        { scale: 1.5 },
        { direction: 'rtl' },
        { locale: 'en' },
      ])
        assert.notEqual(own(f.library.layout({ ...input, ...change })), original);
      const source = await import('node:fs'),
        crypto = await import('node:crypto');
      const bytes = source.readFileSync(
        new URL(
          '../../sdk/tooling/cli/templates/nelyx-app/assets/RobotoSlab-VariableFont_wght.ttf',
          import.meta.url,
        ),
      );
      const font = f.library.decode(
        {
          id: 'new-fallback',
          kind: 'font',
          fontFamily: 'NewFallback',
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        },
        bytes,
      );
      registry.register(font.descriptor, font.retire);
      assert.notEqual(
        own(f.library.layout(input)),
        original,
        'Registering a live fallback must invalidate a still-retained layout',
      );
      registry.releaseProducer(font.descriptor);
    } finally {
      for (const layout of layouts) registry.releaseProducer(layout.resource);
      await f.close();
    }
  },
);

test(
  'paint-only text replacement works at the producer limit and old recordings retain their exact paragraph',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      painters = [],
      before = new Canvas(),
      after = new Canvas();
    try {
      const owner = context(f);
      for (let i = 0; i < textLimits.resources; i++) {
        const p = painter(owner, { text: span(0xff000000 + i) });
        painters.push(p);
        p.layout({ maxWidth: 220 });
      }
      const extra = painter(owner);
      painters.push(extra);
      assert.throws(
        () => extra.layout({ maxWidth: 220 }),
        /Live paragraph producer budget exhausted/,
      );
      const p = painters[0],
        size = p.size;
      p.paint(before, Offset.zero);
      const original = before.commands.find((command) => command.op === 'paragraph').resource;
      p.text = span(0xffff0000);
      p.paint(after, Offset.zero);
      const replacement = after.commands.find((command) => command.op === 'paragraph').resource;
      assert.notEqual(replacement.id, original.id);
      assert.deepEqual(p.size, size);
      assert.equal(owner.resources.hasInitialProducer(original), false);
      assert.equal(
        owner.resources.isRetained(original),
        true,
        'An existing recording keeps its old paragraph alive',
      );
      assert.equal(f.library.debugTextStats.producers, textLimits.resources);
      assert.equal(f.library.debugTextStats.retainedOnly, 1);
      before.dispose();
      assert.equal(owner.resources.isRetained(original), false);
      assert.equal(owner.resources.hasInitialProducer(replacement), true);
      painters.splice(1, 1)[0].dispose();
      extra.layout({ maxWidth: 220 });
      assert.equal(f.library.debugTextStats.producers, textLimits.resources);
    } finally {
      before.dispose();
      after.dispose();
      for (const p of painters) p.dispose();
      await f.close();
    }
  },
);

test(
  'inline line-height and caret templates use a synchronous measurement slot without retaining extra producers',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      painters = [];
    try {
      const owner = context(f),
        probe = painter(owner);
      let expected;
      try {
        expected = probe.preferredLineHeight;
      } finally {
        probe.dispose();
      }
      for (let i = 0; i < textLimits.resources; i++) {
        const p = painter(owner, { text: span(0xff000000 + i) });
        painters.push(p);
        p.layout({ maxWidth: 220 });
      }
      for (const p of painters) {
        assert.equal(p.preferredLineHeight, expected);
        assert.equal(p.preferredLineHeight, expected);
        assert(
          Number.isFinite(p.getOffsetForCaret(new TextPosition({ offset: 0 }), { width: 1 }).dy),
        );
        assert.equal(f.library.debugTextStats.producers, textLimits.resources);
        assert.equal(f.library.debugTextStats.paragraphs, textLimits.resources);
      }
    } finally {
      for (const p of painters) p.dispose();
      await f.close();
    }
  },
);

test(
  'changing strut policy invalidates cached template metrics while preserving the ordinary layout owner',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f),
      p = painter(owner);
    const strut = new StrutStyle({ fontSize: 32, height: 2, forceStrutHeight: true }),
      fresh = painter(owner, { strutStyle: strut });
    try {
      const previous = p.preferredLineHeight;
      p.strutStyle = strut;
      assert.equal(p.preferredLineHeight, fresh.preferredLineHeight);
      assert(p.preferredLineHeight > previous);
      assert.equal(
        f.library.debugTextStats.producers,
        0,
        'Metrics alone do not retain a native paragraph',
      );
    } finally {
      p.dispose();
      fresh.dispose();
      await f.close();
    }
  },
);

test(
  'failed paint replacement and template queries keep the previous layout usable and retire temporary producers',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      owner = context(f),
      p = painter(owner),
      before = new Canvas(),
      after = new Canvas();
    const layout = f.library.layout,
      boxes = f.library.boxes,
      failure = new Error('backend failure');
    try {
      p.layout({ maxWidth: 220 });
      p.paint(before, Offset.zero);
      const original = before.commands.find((command) => command.op === 'paragraph').resource;
      p.text = span(0xff0000ff);
      f.library.layout = () => {
        throw failure;
      };
      assert.throws(
        () => p.paint(after, Offset.zero),
        (error) => error === failure,
      );
      assert.equal(owner.resources.hasInitialProducer(original), true);
      assert.equal(f.library.debugTextStats.producers, 1);
      assert.equal(after.commands.length, 0);
      f.library.layout = layout;
      p.paint(after, Offset.zero);
      assert.equal(owner.resources.hasInitialProducer(original), false);
      f.library.boxes = () => {
        throw failure;
      };
      assert.throws(
        () => p.preferredLineHeight,
        (error) => error === failure,
      );
      assert.equal(
        f.library.debugTextStats.producers,
        1,
        'A failed geometry query releases its measurement paragraph',
      );
      f.library.boxes = boxes;
      assert(p.preferredLineHeight > 0);
      assert.equal(f.library.debugTextStats.producers, 1);
    } finally {
      f.library.layout = layout;
      f.library.boxes = boxes;
      before.dispose();
      after.dispose();
      p.dispose();
      await f.close();
    }
  },
);

test(
  'aggregate text content rejects before the paragraph count limit, allows replacement and recovers after release',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      resources = f.root.context.resources,
      layouts = [];
    const input = {
      text: 'A'.repeat(4096),
      width: Infinity,
      font: f.root.context.defaultFont,
      fontSize: 16,
      locale: 'en',
      direction: 'ltr',
      scale: 1,
    };
    try {
      for (let i = 0; i < 16; i++) layouts.push(f.library.layout(input));
      assert.equal(f.library.debugTextStats.producers, 16);
      assert.throws(() => f.library.layout(input), /Live paragraph content budget exhausted/);
      assert.equal(
        resources.initialProducerCount(layouts[0].resource),
        16,
        'Rejected reuse must not acquire another producer',
      );
      assert.throws(
        () => f.library.layout({ ...input, text: 'A' }),
        /Live paragraph content budget exhausted/,
      );
      const previous = layouts[0],
        replacement = f.library.layout(input, { replacing: previous });
      resources.releaseProducer(previous.resource);
      layouts[0] = replacement;
      const transient = f.library.layout({ ...input, text: ' ' }, { transient: true });
      assert.throws(
        () => f.library.layout({ ...input, text: ' ' }, { transient: true }),
        /Live paragraph content budget exhausted/,
      );
      resources.releaseProducer(transient.resource);
      resources.releaseProducer(layouts.pop().resource);
      layouts.push(f.library.layout({ ...input, text: 'Recovery' }));
      assert.equal(f.library.debugTextStats.producers, 16);
    } finally {
      for (const layout of layouts)
        if (resources.hasInitialProducer(layout.resource))
          resources.releaseProducer(layout.resource);
      await f.close();
    }
  },
);

test(
  'retained content remains charged after producer retirement until its actual frame lease returns',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true }),
      resources = f.root.context.resources,
      leases = [];
    const input = {
      text: 'A'.repeat(4096),
      width: Infinity,
      font: f.root.context.defaultFont,
      fontSize: 16,
      locale: 'en',
      direction: 'ltr',
      scale: 1,
    };
    try {
      for (let batch = 0; batch < 4; batch++) {
        const layouts = [];
        try {
          for (let i = 0; i < 16; i++)
            layouts.push(f.library.layout({ ...input, color: 0xff000000 + batch * 16 + i }));
          leases.push(resources.acquire(layouts.map((layout) => layout.resource)));
        } finally {
          for (const layout of layouts) resources.releaseProducer(layout.resource);
        }
      }
      assert.equal(f.library.debugTextStats.producers, 0);
      assert.equal(f.library.debugTextStats.retainedOnly, 64);
      assert.throws(
        () => f.library.layout({ ...input, text: 'A' }),
        /Retained paragraph content budget exhausted/,
      );
      const reused = f.library.layout({ ...input, color: 0xff000000 + 63 });
      assert.equal(
        f.library.debugTextStats.paragraphs,
        64,
        'Reusing an existing paragraph adds no resident content',
      );
      assert.equal(resources.initialProducerCount(reused.resource), 1);
      resources.releaseProducer(reused.resource);
      assert.throws(
        () => f.library.layout({ ...input, text: 'A' }),
        /Retained paragraph content budget exhausted/,
      );
      leases.shift().returnBy('caller');
      const recovered = f.library.layout(input);
      resources.releaseProducer(recovered.resource);
    } finally {
      for (const lease of leases) lease.returnBy('caller');
      await f.close();
    }
  },
);

test(
  'style-heavy snapshots have a separate byte limit before native shaping',
  { timeout },
  async () => {
    const f = await engineFixture({ fonts: true });
    try {
      const families = Array.from({ length: 64 }, (_, i) => String(i).padEnd(256, 'A'));
      const input = {
        text: 'A'.repeat(4096),
        width: Infinity,
        font: f.root.context.defaultFont,
        fontSize: 16,
        locale: 'en',
        direction: 'ltr',
        scale: 1,
        runs: Array.from({ length: 256 }, (_, i) => ({
          start: i * 16,
          end: (i + 1) * 16,
          style: { fontFamilies: families },
        })),
      };
      assert.throws(() => f.library.layout(input), /Live paragraph content budget exhausted/);
      assert.equal(f.library.debugTextStats.paragraphs, 0);
      const recovered = f.library.layout({ ...input, runs: undefined });
      f.root.context.resources.releaseProducer(recovered.resource);
    } finally {
      await f.close();
    }
  },
);
