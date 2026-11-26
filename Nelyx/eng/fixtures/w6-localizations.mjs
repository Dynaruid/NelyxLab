// SPDX-License-Identifier: BSD-3-Clause
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { AppSession } from '@nelyx/core/hosting/runtime';
import { WidgetsApp } from '@nelyx/core/framework/widgets/app';
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import { Builder, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { ErrorWidget } from '@nelyx/core/framework/widgets/framework';
import { IntlProvider } from '@nelyx/core/framework/widgets/intl-provider';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { widgetApplication } from '@nelyx/core/framework/widgets/root';
import { WidgetsLocalizations } from '@nelyx/core/framework/widgets/widgets-localizations';
import { Locale } from '@nelyx/core/ui/locale';
import { DateTime, GregorianCalendarDelegate } from '@nelyx/material/date-picker';
import {
  MaterialLocalizations,
  DefaultMaterialLocalizations,
  MaterialLocalizationsScope,
  materialCatalogDelegate,
  materialPickerLocalizations,
} from '@nelyx/material/material-localizations';
import { CupertinoLocalizations } from '@nelyx/cupertino/cupertino-localizations';
import { bindViewLocale } from '/__w6/sdk/dist/backends/browser/view-locale.js';
import {
  englishSchema,
  readMessages,
  requireMessages,
  requiredMessageKeys,
} from '/__w6/arb-schema.mjs';

function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      label + ' expected ' + JSON.stringify(expected) + ', observed ' + JSON.stringify(actual),
    );
}

export function verifyArbValidation() {
  const english = {
    title: 'Hello $name',
    '@title': { parameters: 'name' },
    countOther: '$count entries',
    '@count': { plural: 'count' },
    '@countOne': { optional: true },
  };
  const metadata = englishSchema(english, 'material_en.arb');
  const required = requiredMessageKeys(english, metadata);
  const regionalPath = 'material_en_GB.arb';
  const region = readMessages({ countOne: 'One entry' }, regionalPath, english, metadata).messages;
  const parent = readMessages(english, 'material_en.arb', english, metadata).messages;
  requireMessages({ ...parent, ...region }, required, regionalPath, 'en-GB');
  for (const [run, message] of [
    [
      () => requireMessages(region, required, regionalPath, 'en-GB'),
      'material_en_GB.arb title: Required message missing for en-GB',
    ],
    [
      () => readMessages({ title: 'Hello $unexpected' }, regionalPath, english, metadata),
      'material_en_GB.arb title: Undeclared placeholder unexpected',
    ],
  ]) {
    let actual;
    try {
      run();
    } catch (error) {
      actual = error.message;
    }
    equal(actual, message, 'ARB validation identifies the source path and key');
  }
}

export function verifyFormats() {
  const date = new DateTime(2024, 2, 29);
  const calendar = new GregorianCalendarDelegate();
  const gregorian = { calendar: 'gregory', timeZone: 'UTC' };
  for (const tag of ['en', 'en-US', 'ko', 'ko-KR', 'en-GB', 'ar-EG', 'th-TH']) {
    const resource = new MaterialLocalizations(tag);
    const display = calendar.formatCompactDate(date, resource);
    equal(calendar.parseCompactDate(display, resource)?.day, 29, tag + ' leap date');
    equal(calendar.parseCompactDate(display, resource)?.month, 2, tag + ' month');
    equal(calendar.parseCompactDate(display, resource)?.year, 2024, tag + ' civil year');
    for (const invalid of [new DateTime(2023, 2, 17), new DateTime(2024, 4, 17)]) {
      const field = resource.formatCompactDate(invalid);
      const replace = (digit) => new Intl.NumberFormat(tag).format(digit);
      const day = replace(17);
      const offset = field.lastIndexOf(day);
      const bad =
        field.slice(0, offset) +
        replace(invalid.month === 2 ? 29 : 31) +
        field.slice(offset + day.length);
      equal(resource.parseCompactDate(bad), null, tag + ' invalid date');
    }
  }
  equal(new DefaultMaterialLocalizations().formatCompactDate(date), '02/29/2024', 'US default');
  const british = new MaterialLocalizations('en-GB');
  equal(
    [british.formatCompactDate(date), british.dateHelpText],
    ['29/02/2024', 'dd/mm/yyyy'],
    'British date',
  );
  const ko = new MaterialLocalizations('ko-KR');
  equal(
    ko.formatMonthYear(date),
    new Intl.DateTimeFormat('ko-KR', { ...gregorian, month: 'long', year: 'numeric' }).format(
      new Date(Date.UTC(2024, 1, 29)),
    ),
    'Korean month title',
  );
  equal(ko.dateRangeLabel('dateHelpText'), ko.dateHelpText, 'shared date input hint');
  equal(ko.dateInputLabel, '날짜 입력', 'Korean single-date text');
  equal(ko.invalidTimeLabel, '유효한 시간을 입력하세요.', 'Korean time validation text');
  class CustomMaterialLocalizations extends MaterialLocalizations {
    get dateHelpText() {
      return 'custom date';
    }
  }
  const custom = new CustomMaterialLocalizations('ko-KR');
  const parentWith = (resource) =>
    new Localizations(
      'ko-KR',
      {},
      'en',
      new SizedBox(),
      new Map([[MaterialLocalizations, resource]]),
    );
  const customParent = parentWith(custom);
  const catalogParent = parentWith(materialCatalogDelegate.load(new Locale('ko', 'KR')));
  const scope = new MaterialLocalizationsScope(custom, new SizedBox());
  const contextFor = (parent, scoped = null) => ({
    maybeDependOn: (type) => (type === Localizations ? parent : scoped),
  });
  equal(
    materialPickerLocalizations(contextFor(customParent), 'en-US') === custom,
    true,
    'user delegate preference',
  );
  equal(
    materialPickerLocalizations(contextFor(catalogParent, scope), 'en-US') === custom,
    true,
    'user scope preference',
  );
  equal(
    materialPickerLocalizations(contextFor(catalogParent), 'en-US').dateHelpText,
    'mm/dd/yyyy',
    'explicit dialog catalog',
  );
  equal(
    catalogParent.resource(MaterialLocalizations).dateHelpText,
    ko.dateHelpText,
    'parent catalog kept',
  );
  equal(
    new MaterialLocalizations('pt-PT').datePickerHelpText,
    'Selecionar data',
    'Portuguese regional text',
  );
  equal(
    new MaterialLocalizations('pt-PT').invalidDateFormatLabel,
    new MaterialLocalizations('pt').invalidDateFormatLabel,
    'regional parent text',
  );
  const ar = new MaterialLocalizations('ar-EG');
  if (!ar.licensesPackageDetailText(11).includes(new Intl.NumberFormat('ar-EG').format(11)))
    throw new Error('Arabic plural should render a localized number');
  const cup = new CupertinoLocalizations('ko-KR');
  equal(cup.datePickerStandaloneMonth(2), '2월', 'Cupertino Korean month');
  equal(cup.copyButtonLabel, '복사', 'Cupertino selection catalog');
  equal(
    new WidgetsLocalizations('zh-Hant-HK').radioButtonUnselectedLabel,
    new WidgetsLocalizations('zh-HK').radioButtonUnselectedLabel,
    'Chinese script and region routing',
  );
  equal(
    IntlProvider.forLocale('ko_KR') === IntlProvider.forLocale('ko-KR'),
    true,
    'provider cache',
  );
  const original = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'formatToParts');
  Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatToParts', {
    ...original,
    value: undefined,
  });
  try {
    const withoutParts = new MaterialLocalizations('ja-JP');
    equal(withoutParts.formatCompactDate(date), '02/29/2024', 'missing Intl parts output');
    equal(withoutParts.dateHelpText, 'mm/dd/yyyy', 'missing Intl parts hint');
    equal(withoutParts.parseCompactDate('02/29/2024')?.day, 29, 'missing Intl parts parser');
  } finally {
    Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatToParts', original);
  }
  const unsupported = new MaterialLocalizations('zz-ZZ');
  equal(
    [unsupported.formatCompactDate(date), unsupported.dateHelpText],
    ['02/29/2024', 'mm/dd/yyyy'],
    'unsupported Intl locale',
  );
}

class Resource {}
class Supplement {}
function deferredDelegate(type, calls, supported = () => true) {
  return {
    type,
    isSupported: supported,
    shouldReload: () => true,
    load(locale) {
      const entry = { locale: locale.toLanguageTag() };
      calls.push(entry);
      return new Promise((resolve, reject) => Object.assign(entry, { resolve, reject }));
    },
  };
}
const immediate = (type, value, isSupported = () => true) => ({
  type,
  isSupported,
  shouldReload: () => true,
  load: () => ({ value }),
});
const unsupported = immediate(Resource, 'unsupported', () => false);
const duplicate = immediate(Resource, 'duplicate');

function viewWith(options) {
  const input = new ValueNotifier(options);
  const frames = new Set();
  let now = 1,
    visible,
    language;
  const child = new Builder((context) => {
    const localization = Localizations.of(context);
    visible = [
      localization.locale,
      localization.text('title'),
      localization.text('fallback'),
      localization.resource(Resource)?.value,
      localization.resource(Supplement)?.value,
    ];
    return new SizedBox();
  });
  const definition = widgetApplication({
    id: 'w6-locale',
    accessibilityEnabled: false,
    background: 0xff000000,
    createRoot: () =>
      new ListenableBuilder(
        input,
        () =>
          new WidgetsApp({
            child,
            debugShowCheckedModeBanner: false,
            supportedLocales: ['en-US', 'ko-KR'],
            ...input.value,
          }),
      ),
  });
  const session = new AppSession(definition, {
    request(callback) {
      frames.add(callback);
      return { dispose: () => frames.delete(callback) };
    },
  });
  const view = session.attach({
    id: 'w6-locale',
    generation: 1,
    ownership: 'borrowed',
    metrics: {
      scale: 1,
      logicalWidth: 300,
      logicalHeight: 200,
      physicalWidth: 300,
      physicalHeight: 200,
      viewportGeneration: 1,
      rendererGeneration: 1,
      nativeContextGeneration: null,
      nativeSurfaceGeneration: null,
    },
    renderer: {
      capabilities: { admission: 'bounded', notifications: 'unavailable' },
      canBuildFrame: () => true,
      updateMetrics() {},
      submit(frame, lease) {
        lease.transfer();
        lease.returnBy('renderer');
        return { status: 'accepted', submission: frame.token.sequence };
      },
      dispose() {},
    },
    services: {
      clock: { now: () => now },
      text: {},
      assets: new Map(),
      semantics: { capability: 'unavailable' },
      setViewLocale(tag, direction) {
        language = [tag, direction];
      },
    },
    onError(error) {
      throw error;
    },
  });
  const flush = () => {
    view.requestFrame();
    now += 16;
    for (const callback of [...frames])
      if (frames.delete(callback))
        callback({ tick: now, dispatch: now, queueDelay: 0, clockUncertainty: 0 });
  };
  const retire = async () => {
    await session.dispose();
    input.dispose();
  };
  return {
    flush,
    retire,
    change(delta) {
      input.value = { ...input.value, ...delta };
      flush();
    },
    read: () => [visible, language],
  };
}

const drain = () => new Promise((resolve) => setTimeout(resolve, 0));
export async function verifyTransactions() {
  const reports = [];
  const original = FlutterError.onError;
  const builder = ErrorWidget.builder;
  let renderErrors = 0;
  FlutterError.onError = (details) => reports.push(details.exception.message);
  ErrorWidget.builder = () => {
    renderErrors++;
    return new SizedBox();
  };
  const messages = {
    'en_US': { title: 'Original', fallback: 'en fallback' },
    ko: { title: '한국어' },
    'ko-KR': { fallback: 'ko fallback' },
  };
  const calls = [];
  const slow = deferredDelegate(Resource, calls);
  const fixed = immediate(Resource, 'English');
  const view = viewWith({
    locale: 'en_US',
    messages,
    localizationsDelegates: [unsupported, fixed, duplicate],
  });
  try {
    const english = [
      ['en-US', 'Original', 'en fallback', 'English', null],
      ['en-US', 'ltr'],
    ];
    view.flush();
    equal(view.read(), english, 'first synchronous frame and first supported delegate');
    const extras = [];
    view.change({
      locale: 'ko-KR',
      supportedLocales: ['ko-KR', 'en-US'],
      localizationsDelegates: [slow, deferredDelegate(Supplement, extras)],
    });
    view.change({ messages: { ...messages, ko: { title: '최신 한국어' } } });
    calls[0].resolve({ value: 'new ko resource' });
    await drain();
    view.flush();
    equal(view.read(), english, 'pending request keeps committed locale, messages and fallback');
    extras[0].reject(new Error('transition failed'));
    await drain();
    view.flush();
    view.flush();
    equal(view.read(), english, 'failed request keeps all previous resources');
    equal([calls.length, reports.length], [1, 1], 'failure reported once');

    const newerCalls = [];
    const newer = deferredDelegate(Resource, newerCalls);
    view.change({ localizationsDelegates: [newer] });
    view.change({ locale: 'en-US' });
    newerCalls[1].resolve({ value: 'new English' });
    await drain();
    view.flush();
    newerCalls[0].reject(new Error('superseded Korean'));
    await drain();
    view.flush();
    equal(
      view.read(),
      [
        ['en-US', 'Original', 'en fallback', 'new English', null],
        ['en-US', 'ltr'],
      ],
      'latest request wins',
    );
    view.change({
      messages: { ...messages, 'en_US': { title: 'Updated', fallback: 'en fallback' } },
    });
    equal(view.read()[0][1], 'Updated', 'message-only update');
    equal(newerCalls.length, 2, 'message update reuses resources');
    view.change({ locale: 'ko-KR' });
    await view.retire();
    newerCalls[2].reject(new Error('closed view'));
    await drain();
    equal(reports, ['transition failed'], 'stale and closed errors discarded');
  } finally {
    await view.retire();
  }

  for (const recover of [true, false]) {
    const loads = [];
    const initial = viewWith({
      locale: 'ko-KR',
      messages,
      localizationsDelegates: [deferredDelegate(Resource, loads)],
    });
    try {
      initial.flush();
      equal(initial.read(), [undefined, undefined], 'initial content held');
      loads[0].reject(new Error('initial failed'));
      await drain();
      equal(
        loads.map((entry) => entry.locale),
        ['ko-KR', 'en-US'],
        'first supported fallback tried once',
      );
      if (recover) loads[1].resolve({ value: 'recovered' });
      else loads[1].reject(new Error('recovery failed'));
      await drain();
      initial.flush();
      if (recover)
        equal(
          initial.read()[0],
          ['en-US', 'Original', 'en fallback', 'recovered', null],
          'initial recovery',
        );
      else equal(renderErrors, 1, 'failed fallback rendered an ErrorWidget');
    } finally {
      await initial.retire();
    }
  }
  FlutterError.onError = original;
  ErrorWidget.builder = builder;
}

export function verifyViewBoundaries() {
  const first = document.createElement('div');
  const second = document.createElement('div');
  document.body.append(first, second);
  document.documentElement.lang = 'fr';
  const a = bindViewLocale(() => first, true);
  const b = bindViewLocale(() => second, false);
  try {
    a.update('ko-KR', 'ltr');
    b.update('ar-EG', 'rtl');
    equal(
      [document.documentElement.lang, first.lang, second.lang, second.dir],
      ['fr', 'ko-KR', 'ar-EG', 'rtl'],
      'two views sharing a document',
    );
    b.dispose();
    equal(document.documentElement.lang, 'ko-KR', 'single document owner');
  } finally {
    b.dispose();
    a.dispose();
    first.remove();
    second.remove();
  }
  equal(document.documentElement.lang, 'fr', 'document language restored');
}
