// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Date defaults checks exceeded 20 minutes');
}, 1_200_000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {Theme} from './packages/material/src/theme.ts';
import {ThemeData} from './packages/material/src/theme-data.ts';
import {DatePickerTheme} from './packages/material/src/date-picker-theme.ts';
import {DatePickerDefaultsM3} from './packages/material/src/internal/theme/date-picker-defaults.ts';
import {WidgetState,emptyWidgetStateSet} from '@nelyx/core/framework/widgets/widget-state';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
const themes=[ThemeData.light(),ThemeData.dark()],contexts=[{theme:0},{theme:0}],reads=[];
const original=Theme.of;Theme.of=context=>{reads.push(context);return themes[context.theme];};
const names=['dayForegroundColor','dayBackgroundColor','dayOverlayColor','todayForegroundColor',
  'todayBackgroundColor','yearForegroundColor','yearBackgroundColor','yearOverlayColor'];
const states=[[],[WidgetState.selected],[WidgetState.disabled],[WidgetState.hovered],
  [WidgetState.pressed],[WidgetState.focused],[WidgetState.selected,WidgetState.disabled],
  [WidgetState.selected,WidgetState.hovered],[WidgetState.selected,WidgetState.pressed]];
const argb=value=>value?.toARGB32()??null;
try {
  const first=DatePickerTheme.defaults(contexts[0]),second=DatePickerTheme.defaults(contexts[1]);
  assert.equal(first,second,'Identical resolved theme rebuilt default shapes/properties');
  assert.deepEqual(reads,contexts,'A defaults cache hit skipped a caller inherited lookup');
  assert.equal(first.context,null,'Theme-scoped defaults retained a calendar Element/context');
  for(const context of contexts){
    const cached=DatePickerTheme.defaults(context),oracle=new DatePickerDefaultsM3(context);
    for(const name of names){
      assert.equal(cached[name],cached[name],'Unchanged state property was reallocated');
      for(const selected of states){
        const values=emptyWidgetStateSet();for(const value of selected)values.add(value);
        assert.equal(argb(cached[name].resolve(values)),argb(oracle[name].resolve(values)),name+' changed source state precedence');
      }
    }
    assert(cached.shape.equals(oracle.shape));
    assert.equal(cached.dayStyle,oracle.dayStyle);
  }
  const empty=emptyWidgetStateSet(),before=argb(first.dayForegroundColor.resolve(empty));
  contexts[0].theme=1;
  const changed=DatePickerTheme.defaults(contexts[0]);assert.notEqual(changed,first);
  assert.equal(changed.context,null);
  assert.equal(argb(changed.dayForegroundColor.resolve(empty)),argb(new DatePickerDefaultsM3(contexts[0]).dayForegroundColor.resolve(empty)));
  assert.equal(argb(first.dayForegroundColor.resolve(empty)),before,'A theme update mutated old retained defaults');
  assert.equal(DatePickerTheme.defaults(contexts[1]),first,'Another context lost its light theme');
  console.log('Date defaults: shared immutable theme values, every caller lookup, no retained context, light/dark replacement, state precedence and source oracle PASS.');
} finally {Theme.of=original;}
`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
    loader: { '.sksl': 'text' },
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
