// SPDX-License-Identifier: BSD-3-Clause
import 'dart:convert';
import 'dart:io';

// One exhaustive classification pass reproduces the pinned WordBoundary
// predicate without depending on the product host's ICU/RegExp Unicode version.
void main() {
  final predicate = RegExp(r'[\p{Space_Separator}\p{Punctuation}]', unicode: true);
  final ranges = <List<int>>[];
  int? start;
  var matches = 0;
  for (var codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    if (predicate.hasMatch(String.fromCharCode(codePoint))) {
      start ??= codePoint;
      matches++;
    } else if (start != null) {
      ranges.add([start, codePoint - 1]);
      start = null;
    }
  }
  if (start != null) ranges.add([start, 0x10ffff]);
  print(jsonEncode({'runtime': Platform.version, 'codePoints': 0x110000, 'matches': matches, 'ranges': ranges}));
}
