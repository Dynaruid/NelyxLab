// SPDX-License-Identifier: BSD-3-Clause
import 'dart:convert';
import 'dart:io';
import 'dart:ui' show FramePhase;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

void main() {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  if (kProfileMode) {
    final file = File(Platform.environment['W8_FLUTTER_TIMINGS']!);
    binding.addTimingsCallback((frames) {
      file.writeAsStringSync(jsonEncode([
        for (final frame in frames) [
          frame.timestampInMicroseconds(FramePhase.rasterFinishWallTime),
          frame.buildDuration.inMicroseconds, frame.rasterDuration.inMicroseconds,
        ],
      ]) + '\n', mode: FileMode.append);
    });
  }
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    locale: const Locale('en', 'US'),
    theme: ThemeData(
      fontFamily: 'NelyxSample',
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff6750a4)),
    ),
    home: Material(child: Center(child: SizedBox(
      width: 360, height: 400,
      child: CalendarDatePicker(
        initialDate: DateTime(2025, 2, 15), currentDate: DateTime(2025, 2, 15),
        firstDate: DateTime(2024), lastDate: DateTime(2026, 12, 31),
        onDateChanged: (_) {},
      ),
    ))),
  ));
}
