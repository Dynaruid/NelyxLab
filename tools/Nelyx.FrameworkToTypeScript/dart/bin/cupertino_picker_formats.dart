// SPDX-License-Identifier: BSD-3-Clause
import 'dart:convert';
import 'dart:io';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

typedef Messages = Map<String, String>;

Future<void> main() async {
  await initializeDateFormatting();
  final json =
      jsonDecode(await stdin.transform(utf8.decoder).join())
          as Map<String, dynamic>;
  final messages = json.map(
    (locale, values) =>
        MapEntry(locale, (values as Map).cast<String, String>()),
  );
  final output = <String, Object?>{};
  for (final locale in messages.keys) {
    final parts = locale.split('_');
    final language = parts.first;
    final localeName = Intl.canonicalizedLocale(locale);
    final fallback = DateFormat.localeExists(localeName)
        ? localeName
        : DateFormat.localeExists(language)
        ? language
        : 'en';
    final translations = <String, String>{};
    for (var length = 1; length <= parts.length; length++) {
      translations.addAll(messages[parts.take(length).join('_')] ?? const {});
    }
    output[locale] = pickerFormats(
      localeName,
      fallback,
      messages['en']!,
      translations,
    );
  }
  stdout.write(jsonEncode(output));
}

Map<String, Object?> pickerFormats(
  String locale,
  String fallback,
  Messages defaults,
  Messages messages,
) {
  final yearFormat = DateFormat.y(fallback);
  final decimal = NumberFormat.decimalPattern(fallback);
  final dayFormat = DateFormat.d(fallback);
  final weekdayFormat = DateFormat.E(fallback);
  final hourFormat = DateFormat('HH', fallback);
  final minuteFormat = DateFormat('mm', fallback);
  final timerMinute = DateFormat.m(fallback);
  final timerSecond = DateFormat.s(fallback);
  final monthSymbols = yearFormat.dateSymbols.MONTHS;
  final zero =
      yearFormat.dateSymbols.ZERODIGIT?.runes.single ?? '0'.codeUnitAt(0);
  final yearToken = String.fromCharCodes(List.filled(4, zero + 2));
  final yearTemplate = yearFormat.format(DateTime.utc(2222)).split(yearToken);
  if (yearTemplate.length != 2)
    throw StateError('Unexpected year format for $locale');
  final english = locale == 'en';
  List<String> range(int count, String Function(int) value) =>
      List.generate(count, value);
  List<String> labels(String key, String input, int count) => range(
    count,
    (index) => Intl.pluralLogic<String>(
      index,
      zero: messages['${key}Zero'],
      one: messages['${key}One'],
      two: messages['${key}Two'],
      few: messages['${key}Few'],
      many: messages['${key}Many'],
      other: messages['${key}Other'] ?? defaults['${key}Other']!,
      locale: locale,
    ).replaceFirst('\$$input', decimal.format(index)),
  );
  return {
    'digits': String.fromCharCodes(List.generate(10, (digit) => zero + digit)),
    'year': yearTemplate,
    'months': monthSymbols,
    'days': range(
      31,
      (index) => dayFormat.format(DateTime.utc(2024, 1, index + 1)),
    ),
    'weekdays': range(
      7,
      (index) => weekdayFormat.format(DateTime.utc(2024, 1, index + 1)),
    ),
    'medium': mediumTokens(fallback, english: english),
    'hours': range(
      24,
      (index) => english
          ? '$index'
          : hourFormat.format(DateTime.utc(2024, 1, 1, index)),
    ),
    'minutes': range(
      60,
      (index) => minuteFormat.format(DateTime.utc(2024, 1, 1, 0, index)),
    ),
    'timerMinutes': range(
      60,
      (index) => timerMinute.format(DateTime.utc(2024, 1, 1, 0, index)),
    ),
    'timerSeconds': range(
      60,
      (index) => timerSecond.format(DateTime.utc(2024, 1, 1, 0, 0, index)),
    ),
    'hourSemantics': labels('datePickerHourSemanticsLabel', 'hour', 24),
    'minuteSemantics': labels('datePickerMinuteSemanticsLabel', 'minute', 60),
    'timerHourLabels': labels('timerPickerHourLabel', 'hour', 24),
    'timerMinuteLabels': labels('timerPickerMinuteLabel', 'minute', 60),
    'timerSecondLabels': labels('timerPickerSecondLabel', 'second', 60),
  };
}

List<Object> mediumTokens(String locale, {required bool english}) {
  final formatter = DateFormat.MMMEd(locale);
  final pattern = english ? 'EEE MMM d' : formatter.pattern!;
  final split = RegExp(
    r"('(?:[^']|'')*'|([A-Za-z])\2*|[^A-Za-z']+)",
  ).allMatches(pattern).map((match) => match[0]!).toList();
  if (split.join() != pattern)
    throw StateError('Unhandled picker format for $locale');
  final tokens = split.map((token) {
    final field = switch (token[0]) {
      'E' || 'e' || 'c' => 'weekday',
      'M' || 'L' => 'month',
      'd' => 'day',
      _ => null,
    };
    if (field == null) {
      return token.startsWith("'")
          ? token.substring(1, token.length - 1).replaceAll("''", "'")
          : token;
    }
    // A single d, E, or M is also an intl skeleton. A literal suffix forces
    // the field to use the explicit pattern from the surrounding medium date.
    const marker = '\u0001';
    final part = DateFormat('$token$marker', locale);
    final count = field == 'weekday'
        ? 7
        : field == 'month'
        ? 12
        : 31;
    return {
      'field': field,
      'values': List.generate(count, (index) {
        final text = part.format(
          field == 'month'
              ? DateTime.utc(2024, index + 1)
              : DateTime.utc(2024, 1, index + 1),
        );
        if (!text.endsWith(marker))
          throw StateError('Date field suffix was lost');
        return text.substring(0, text.length - marker.length);
      }),
    };
  }).toList();
  if (!english) {
    final sample = DateTime.utc(2024, 2, 29);
    final pieces = tokens.map((token) {
      if (token is String) return token;
      final part = token as Map<String, Object>;
      final index = switch (part['field']) {
        'weekday' => sample.weekday - 1,
        'month' => sample.month - 1,
        _ => sample.day - 1,
      };
      return (part['values'] as List<String>)[index];
    });
    if (pieces.join() != formatter.format(sample)) {
      throw StateError('Date pattern mismatch for $locale: $pattern');
    }
  }
  return tokens;
}
