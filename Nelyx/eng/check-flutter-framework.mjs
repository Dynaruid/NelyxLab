// SPDX-License-Identifier: BSD-3-Clause
// Runs actual pinned Flutter framework code with the installed flutter_tester.
// The installed engine is reported separately; no screenshot/engine equivalence is inferred.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import {
  openFlutterSource,
  flutterRevision,
  gitBlob,
} from '../../tools/Nelyx.FrameworkToTypeScript/flutter-source.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i],
    value = process.argv[i + 1];
  if (
    !['--source', '--flutter', '--dates'].includes(key) ||
    !value ||
    value.startsWith('--') ||
    options[key]
  )
    throw Error(
      'Usage: check-flutter-framework.mjs --source <Flutter Git repository> --flutter <installed Flutter SDK> [--dates check|write]',
    );
  options[key] = key === '--dates' ? value : fs.realpathSync(value);
}
if (options['--dates'] && !['check', 'write'].includes(options['--dates']))
  throw Error('--dates must be check or write');
if (!options['--source'] || !options['--flutter'])
  throw Error('Explicit Flutter source and installed SDK are required');
const parent = path.join(root, '.tmp');
fs.mkdirSync(parent, { recursive: true });
const temporary = fs.mkdtempSync(path.join(parent, 'flutter-framework-'));
const deadline = Date.now() + 1_200_000;
const remaining = () => {
  if (Date.now() >= deadline) throw Error('Flutter framework oracle exceeded 20 minutes');
  return deadline - Date.now();
};
function removeTemporary() {
  if (path.dirname(temporary) !== parent || fs.lstatSync(temporary).isSymbolicLink())
    throw Error('Flutter fixture temporary owner differs');
  fs.rmSync(temporary, { recursive: true, force: true });
}
try {
  const source = openFlutterSource(options['--source']);
  const sdk = options['--flutter'];
  const dart = path.join(
    sdk,
    'bin/cache/dart-sdk/bin',
    process.platform === 'win32' ? 'dart.exe' : 'dart',
  );
  const tools = path.join(sdk, 'bin/cache/flutter_tools.snapshot');
  const engine = JSON.parse(
    fs.readFileSync(path.join(sdk, 'bin/cache/flutter.version.json'), 'utf8'),
  );
  if (!fs.existsSync(dart) || !fs.existsSync(tools))
    throw Error('Installed Flutter/Dart tools are unavailable');
  const inputs = [];
  const materialize = (file) => {
    const output = path.join(temporary, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const reference = path.join(root, 'reference/flutter-master', file);
    const local = fs.existsSync(reference)
      ? Buffer.from(fs.readFileSync(reference, 'utf8').replaceAll('\r\n', '\n'))
      : null;
    const bytes = local && gitBlob(local) === source.blob(file) ? local : source.read(file);
    fs.writeFileSync(output, bytes);
  };
  for (const name of ['flutter', 'flutter_test']) {
    const prefix = `packages/${name}`;
    for (const file of source.files(prefix + '/lib')) {
      materialize(file);
      inputs.push(file);
    }
    // Package resolution is a host adaptation; every executable library remains an exact Git blob.
    const pubspec = source
      .text(prefix + '/pubspec.yaml')
      .replace(/^resolution: workspace\r?\n/m, '')
      .split(/^dev_dependencies:/m)[0];
    fs.writeFileSync(path.join(temporary, prefix, 'pubspec.yaml'), pubspec);
  }
  fs.writeFileSync(
    path.join(temporary, 'pubspec.yaml'),
    `name: nelyx_framework_oracle\npublish_to: none\nenvironment:\n  sdk: '^3.13.0-0'\ndependencies:\n  flutter:\n    path: packages/flutter\ndev_dependencies:\n  flutter_test:\n    path: packages/flutter_test\ndependency_overrides:\n  flutter:\n    path: packages/flutter\n`,
  );
  const oracle = path.join(temporary, 'oracle.json');
  const test = path.join(temporary, 'test/framework_test.dart');
  fs.mkdirSync(path.dirname(test));
  fs.writeFileSync(
    test,
    `
import 'dart:convert';
import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
class UserGridDelegate extends SliverGridDelegate {
  int calls = 0;
  @override SliverGridLayout getLayout(SliverConstraints constraints) {
    calls++;
    expect(constraints.crossAxisExtent, 120);
    return const SliverGridRegularTileLayout(crossAxisCount: 2, mainAxisStride: 40,
      crossAxisStride: 60, childMainAxisExtent: 35, childCrossAxisExtent: 55, reverseCrossAxis: false);
  }
  @override bool shouldRelayout(covariant UserGridDelegate oldDelegate) => false;
}
void main() {
  testWidgets('pinned PageView geometry and zero-size restoration', (WidgetTester tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.windows;
    addTearDown(() { debugDefaultTargetPlatformOverride = null; });
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(120, 80);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final pages = <Map<String, Object?>>[];
    for (final fraction in <double>[0.5, 1, 1.5]) {
      for (final config in <(Axis, TextDirection, bool)>[
        (Axis.horizontal, TextDirection.ltr, false),
        (Axis.horizontal, TextDirection.rtl, false),
        (Axis.horizontal, TextDirection.ltr, true),
        (Axis.vertical, TextDirection.ltr, true),
      ]) {
        final controller = PageController(initialPage: 2, viewportFraction: fraction);
        final changes = <int>[];
        await tester.pumpWidget(Directionality(textDirection: config.$2, child: PageView(
          controller: controller, scrollDirection: config.$1, reverse: config.$3,
          onPageChanged: changes.add,
          children: List<Widget>.generate(8, (_) => const SizedBox.expand()),
        )));
        expect(controller.page, 2);
        controller.jumpToPage(3);
        await tester.pump();
        expect(controller.page, 3);
        expect(changes, <int>[3]);
        tester.view.physicalSize = config.$1 == Axis.horizontal ? const Size(0, 80) : const Size(120, 0);
        await tester.pump();
        controller.jumpToPage(4);
        expect(controller.page, 4);
        tester.view.physicalSize = const Size(120, 80);
        await tester.pump();
        pages.add(<String, Object?>{'fraction': fraction, 'axis': config.$1.name,
          'direction': config.$2.name, 'reverse': config.$3,
          'pixels': controller.position.pixels, 'page': controller.page});
        await tester.pumpWidget(const SizedBox.shrink());
        expect(controller.hasClients, false);
        controller.dispose();
      }
    }
    final lifecycle = <Map<String,Object?>>[];
    List<Widget> pageChildren() => List<Widget>.generate(8, (_) => const SizedBox.expand());
    for (final keepPage in <bool>[true,false]) {
      final bucket = PageStorageBucket(), controller = PageController(initialPage:1,keepPage:keepPage,viewportFraction:0.5);
      Widget make() => Directionality(textDirection:TextDirection.ltr,child:PageStorage(bucket:bucket,child:PageView(key:const PageStorageKey<String>('pages'),controller:controller,children:pageChildren())));
      await tester.pumpWidget(make());controller.jumpToPage(3);await tester.pump();
      await tester.pumpWidget(const SizedBox.shrink());expect(controller.hasClients,false);
      await tester.pumpWidget(make());
      lifecycle.add(<String,Object?>{'kind':'storage','keepPage':keepPage,'page':controller.page,'pixels':controller.offset});
      await tester.pumpWidget(const SizedBox.shrink());controller.dispose();
    }
    {
      final events=<String>[], first=PageController(initialPage:2,onAttach:(_)=>events.add('first-attach'),onDetach:(_)=>events.add('first-detach')),
        second=PageController(initialPage:0,viewportFraction:0.5,onAttach:(_)=>events.add('second-attach'),onDetach:(_)=>events.add('second-detach'));
      Widget make(PageController controller)=>Directionality(textDirection:TextDirection.ltr,child:PageView(controller:controller,children:pageChildren()));
      await tester.pumpWidget(make(first));first.jumpToPage(3);await tester.pump();
      await tester.pumpWidget(make(second));expect(first.hasClients,false);
      lifecycle.add(<String,Object?>{'kind':'transfer','page':second.page,'pixels':second.offset,'events':List<String>.of(events)});
      await tester.pumpWidget(const SizedBox.shrink());first.dispose();second.dispose();
    }
    {
      final controller=PageController();
      await tester.pumpWidget(Directionality(textDirection:TextDirection.ltr,child:PageView(controller:controller,children:pageChildren())));
      final done=controller.animateToPage(4,duration:const Duration(milliseconds:200),curve:Curves.linear);
      await tester.pump(const Duration(milliseconds:16));controller.jumpToPage(1);await tester.pump();await done;
      lifecycle.add(<String,Object?>{'kind':'interrupt','page':controller.page,'pixels':controller.offset,'scrolling':controller.position.isScrollingNotifier.value});
      await tester.pumpWidget(const SizedBox.shrink());controller.dispose();
    }
    for(final empty in <bool>[false,true]) {
      final controller=PageController(viewportFraction:0.5);
      await tester.pumpWidget(Directionality(textDirection:TextDirection.ltr,child:PageView(controller:controller,padEnds:false,children:empty?<Widget>[]:pageChildren())));
      lifecycle.add(<String,Object?>{'kind':empty?'empty':'no-padding','page':controller.page,'pixels':controller.offset,'min':controller.position.minScrollExtent,'max':controller.position.maxScrollExtent});
      await tester.pumpWidget(const SizedBox.shrink());controller.dispose();
    }
    Map<String,Object?> record(RenderSliverMultiBoxAdaptor render, ScrollController controller, String kind) {
      final rows = <Map<String,Object?>>[];
      for (RenderBox? child = render.firstChild; child != null; child = render.childAfter(child)) {
        final data = child.parentData! as SliverMultiBoxAdaptorParentData;
        rows.add(<String,Object?>{'index': data.index, 'offset': data.layoutOffset,
          'height': child.size.height, 'cross': data is SliverGridParentData ? data.crossAxisOffset : 0});
      }
      return <String,Object?>{'kind':kind,'pixels':controller.offset,'max':controller.position.maxScrollExtent,'rows':rows};
    }
    final slivers = <Map<String,Object?>>[];
    final extents = <double>[17,43,29,61,23,37,52,31], listController = ScrollController();
    await tester.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: ListView.builder(
      controller:listController, cacheExtent:0, itemCount:extents.length,
      itemBuilder:(_, index) => SizedBox(height:extents[index]),
    )));
    listController.jumpTo(60); await tester.pump();
    listController.jumpTo(200); await tester.pump();
    slivers.add(record(tester.renderObject<RenderSliverList>(find.byType(SliverList)),listController,'variable-list'));
    await tester.pumpWidget(const SizedBox.shrink()); expect(listController.hasClients,false); listController.dispose();
    final delegate=UserGridDelegate(), gridController=ScrollController();
    await tester.pumpWidget(Directionality(textDirection:TextDirection.ltr,child:GridView.builder(
      controller:gridController,cacheExtent:0,gridDelegate:delegate,itemCount:10,itemBuilder:(_,index)=>const SizedBox.expand(),
    )));
    gridController.jumpTo(65);await tester.pump();expect(delegate.calls,greaterThan(0));
    slivers.add(record(tester.renderObject<RenderSliverGrid>(find.byType(SliverGrid)),gridController,'custom-grid'));
    await tester.pumpWidget(const SizedBox.shrink());expect(gridController.hasClients,false);gridController.dispose();
    File(${JSON.stringify(oracle.replaceAll('\\', '/'))}).writeAsStringSync(jsonEncode(<String, Object?>{
      'revision': '${flutterRevision}', 'pages': pages, 'slivers': slivers, 'lifecycle': lifecycle,
    }));
  });
}
`,
  );
  const env = { ...process.env, FLUTTER_ROOT: sdk, FLUTTER_SUPPRESS_ANALYTICS: 'true', CI: 'true' };
  if (options['--dates']) {
    // Analyze before Flutter pub owns this fixture's package configuration.
    for (const prefix of [
      'engine/src/flutter/lib/ui',
      'engine/src/flutter/lib/web_ui/lib',
      'packages/flutter_localizations/lib',
    ]) {
      for (const file of source.files(prefix).filter((file) => file.endsWith('.dart')))
        materialize(file);
    }
    await execute(
      'bun',
      [
        path.join(root, 'tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts'),
        '--source',
        temporary,
        '--dart',
        dart,
        '--' + options['--dates'],
        '--verify',
      ],
      { cwd: root, env, timeout: remaining() },
    );
  }
  // Missing package configuration was confirmed before this fixture was introduced.
  // Reuse installed Pub packages first; an offline failure may fetch only these declared dependencies.
  try {
    await execute(dart, [tools, '--no-version-check', 'pub', 'get', '--offline'], {
      cwd: temporary,
      env,
      timeout: remaining(),
    });
  } catch (error) {
    if (!error.output?.includes('offline') && !error.output?.includes('version solving failed'))
      throw error;
    await execute(dart, [tools, '--no-version-check', 'pub', 'get'], {
      cwd: temporary,
      env,
      timeout: remaining(),
    });
  }
  const configuration = JSON.parse(
    fs.readFileSync(path.join(temporary, '.dart_tool/package_config.json'), 'utf8'),
  );
  for (const name of ['flutter', 'flutter_test']) {
    const entry = configuration.packages.find((entry) => entry.name === name);
    const actual =
      entry &&
      fs.realpathSync(
        fileURLToPath(
          new URL(
            entry.rootUri,
            pathToFileURL(path.join(temporary, '.dart_tool/package_config.json')),
          ),
        ),
      );
    if (actual !== fs.realpathSync(path.join(temporary, 'packages', name)))
      throw Error('Oracle did not select the pinned ' + name + ' package');
  }
  await execute(
    dart,
    [
      tools,
      '--no-version-check',
      'test',
      '--no-pub',
      '--no-test-assets',
      '--timeout',
      '1200s',
      test,
    ],
    { cwd: temporary, env, timeout: remaining() },
  );
  const result = JSON.parse(fs.readFileSync(oracle, 'utf8'));
  if (
    result.revision !== flutterRevision ||
    result.pages.length !== 12 ||
    result.slivers.length !== 2 ||
    result.lifecycle.length !== 6
  )
    throw Error('Original framework observations are incomplete');
  await execute(
    process.execPath,
    [path.join(root, 'Nelyx/eng/check-source-framework.mjs'), '--oracle', oracle],
    { cwd: root, timeout: remaining() },
  );
  console.log(
    'FLUTTER_FRAMEWORK',
    JSON.stringify({
      result: 'PASS-scoped',
      revision: source.revision,
      executableFiles: inputs.length,
      installedEngine: engine.engineRevision,
      dart: engine.dartSdkVersion,
      cases: result.pages.length + result.slivers.length + result.lifecycle.length,
      scope:
        'actual pinned PageView geometry/storage/transfer/interruption/empty and variable list/custom grid; installed tester engine; no pixel/physical acceptance',
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  removeTemporary();
}
