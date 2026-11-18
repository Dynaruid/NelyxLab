// SPDX-License-Identifier: BSD-3-Clause
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Calendar midpoint and cold March Source comparison', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 400);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final samples = <String, List<double>>{};
    final coldRenderTypes = <String, int>{};
    Map<int, Element> pages() => {
      for (final e
          in find
              .byWidgetPredicate(
                (w) => w.runtimeType.toString() == '_DayPicker',
              )
              .evaluate())
        ((e.widget as dynamic).displayedMonth as DateTime).month: e,
    };
    for (var sample = 0; sample < 6; sample++) {
      for (final direction in ['forward', 'reverse', 'cold']) {
        final cold = direction == 'cold', calls = <int>[];
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData.light(),
            locale: const Locale('en', 'US'),
            home: Material(
              child: CalendarDatePicker(
                initialDate: DateTime(2025, cold ? 2 : 1, 15),
                currentDate: DateTime(2025, 1, 15),
                firstDate: DateTime(2025, 1),
                lastDate: DateTime(2025, 3, 31),
                onDisplayedMonthChanged: (date) => calls.add(date.month),
                onDateChanged: (_) => fail('selection changed'),
              ),
            ),
          ),
        );
        await tester.pump(const Duration(milliseconds: 16));
        final position = tester
            .widget<PageView>(find.byType(PageView))
            .controller!
            .position;
        expect(position.viewportDimension, 360);
        final steps = cold
            ? [(1.1, 'cold')]
            : direction == 'forward'
            ? [(0.35, ''), (0.45, 'forward-control'), (0.55, 'forward-cross')]
            : [(0.65, ''), (0.55, 'reverse-control'), (0.45, 'reverse-cross')];
        for (final (at, label) in steps) {
          final before = pages(), count = calls.length;
          if (label.isNotEmpty)
            expect(before.keys.toSet(), cold ? {2} : {1, 2});
          final watch = Stopwatch()..start();
          // ignore: deprecated_member_use
          position.jumpToWithoutSettling(at * 360);
          await tester.pump(const Duration(milliseconds: 16));
          watch.stop();
          if (label.isEmpty) continue;
          final after = pages();
          expect(after.keys.toSet(), cold ? {2, 3} : {1, 2});
          for (final m in before.keys) {
            expect(identical(before[m], after[m]), isTrue);
          }
          expect(
            calls.skip(count).toList(),
            label == 'forward-cross'
                ? [2]
                : label == 'reverse-cross'
                ? [1]
                : <int>[],
          );
          expect(position.pixels, at * 360);
          if (cold && sample == 0) {
            var days = 0;
            void visit(Element e, bool inDay) {
              if (e.widget.runtimeType.toString() == '_Day') {
                days++;
                inDay = true;
              }
              if (inDay && e is RenderObjectElement) {
                final name = e.widget.runtimeType.toString();
                coldRenderTypes[name] = (coldRenderTypes[name] ?? 0) + 1;
              }
              e.visitChildren((child) => visit(child, inDay));
            }

            visit(after[3]!, false);
            expect(days, 31);
          }
          if (sample > 0)
            (samples[label] ??= []).add(watch.elapsedMicroseconds / 1000);
        }
        await tester.pumpWidget(const SizedBox());
      }
    }
    // Test-engine pump wall time, not native presentation or Node build+layout.
    print('W7_FLUTTER_PUMP_MS ${jsonEncode(samples)}');
    print('W7_FLUTTER_COLD_RENDER_ELEMENTS ${jsonEncode(coldRenderTypes)}');
  }, timeout: const Timeout(Duration(minutes: 20)));
}
