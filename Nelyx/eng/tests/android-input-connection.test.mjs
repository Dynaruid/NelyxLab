// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {capture} from '../../sdk/tooling/cli/src/commands.mjs';
const timeout=1_200_000;
test('Android nonvisual input endpoint uses actual BaseInputConnection completion and paints zero native pixels',{timeout},t=>{
  const serial=process.env.NELYX_ANDROID_TEST_SERIAL;assert(serial&&/^emulator-\d+$/.test(serial),'Select a prepared emulator with NELYX_ANDROID_TEST_SERIAL');
  const disk=fs.statfsSync(process.cwd());assert(disk.bavail*disk.bsize>=20*1024**3,'At least 20 GiB of free disk is required');
  const sdk=process.env.ANDROID_HOME??process.env.ANDROID_SDK_ROOT??path.join(process.env.LOCALAPPDATA,'Android/Sdk'),adb=path.join(sdk,'platform-tools','adb'+(process.platform==='win32'?'.exe':''));
  const call=args=>capture(adb,['-s',serial,...args],{timeout});
  assert.equal(call(['get-state']).trim(),'device');assert(Number(call(['shell','getprop','ro.build.version.sdk']))>=26);
  for(const relative of ['debug/app-debug.apk','androidTest/debug/app-debug-androidTest.apk']){
    const apk=path.resolve('sample/nelyx-testbed-app-2/android/app/build/outputs/apk',relative);assert(fs.statSync(apk).isFile(),'Build the current Debug application and androidTest APKs first');call(['install','-r',apk]);
  }
  const result=call(['shell','am','instrument','-w','com.nelyxtestbed2.test/dev.nelyx.sdk.editing.InputConnectionInstrumentation']);
  // Android am instrument can exit zero even when the instrumentation reports failure.
  assert.match(result,/INSTRUMENTATION_RESULT: status=PASS-scoped\b/,result);assert(!result.includes('INSTRUMENTATION_RESULT: error='),result);
  t.diagnostic(result.match(/INSTRUMENTATION_RESULT: scope=(.*)/)?.[1]??'Actual Android input APIs; application/OS IME and Core pixels remain separate');
});
