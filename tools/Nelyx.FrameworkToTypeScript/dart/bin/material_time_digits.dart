// SPDX-License-Identifier: BSD-3-Clause
import 'dart:convert';
import 'dart:io';

import 'package:intl/intl.dart';

Future<void> main() async {
  final locales =
      (jsonDecode(await stdin.transform(utf8.decoder).join()) as List<Object?>)
          .cast<String>();
  final digits = <String, String>{};
  for (final locale in locales) {
    final canonical = Intl.canonicalizedLocale(locale);
    final language = canonical.split('_').first;
    final resolved = NumberFormat.localeExists(canonical)
        ? canonical
        : NumberFormat.localeExists(language)
        ? language
        : 'en';
    final format = NumberFormat.decimalPattern(resolved);
    digits[locale] = List<String>.generate(
      10,
      (digit) => format.format(digit),
    ).join();
  }
  stdout.write(jsonEncode(digits));
}
