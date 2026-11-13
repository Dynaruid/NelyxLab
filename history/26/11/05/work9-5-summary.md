# Work9 후속 5부 — iOS·macOS host 계획 요약

원문: 루트 `work9-5.md` · 작성: **2026-11-05 KST** · 갱신·종료: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work10 이관** · iOS/macOS: **DEFERRED / 구현 미착수 / notVerified**. 아래는 설계 의무이며 Apple build/run·기기 검증이나 이식 실적이 아니다.

## 차수와 공통 계약

Windows/Web 1차 → Android/Linux 2차 → **iOS/macOS 3차**다. 착수 조건은 Android와 Linux 모두의 W9-13 기술 완료이며 Apple prototype/toolchain·공급을 앞선 차수의 선행 조건으로 요구하지 않는다. 물리·성능·기본값 전환은 대상별 W9-14에서 별도 수락한다.

11월 8일 교정에 따라 **iOS는 RN iOS, macOS는 RNM(React Native macOS)의 실제 플랫폼 API 소스**를 선별 복사·수정한다. 원본 revision/hash·dependency/license·가져온 함수·Nelyx 수정·기존 소비자 교체·일반 앱 동작을 함께 확인한다. 참고만 한 자체 구현, 기존 RN runner 실행, macOS 성공을 iOS 완료로 대체하지 않는다.

Material/Cupertino의 원래 TS Widget/State·theme·controller·callback·route 정책을 유지한다. UIKit/AppKit/Objective-C++는 host/OS adapter, C++는 공통 engine/provider이며 UIKit/AppKit control이나 C++ Widget로 디자인 패키지를 복제하지 않는다.

## iOS — W9-12-B(iOS)

- RN TextInput/keyboard/delegate·접근성·clipboard·환경·scene/lifecycle을 UIKit의 owned UIView/UIViewController·Core port로 수정 이식한다. RN bridge/root lookup 대신 명시적인 scene/view 소유권을 사용한다.
- **UIView/UITextInput endpoint**의 동기 text/selection mirror·UITextPosition/Range·tokenizer와 Core edit revision/ACK를 연결한다. 보이는 caret/range geometry는 게시 paragraph에서 얻고 stale rect를 현재 값으로 반환하지 않는다.
- 선택/자동수정·중복 알림·observer·재진입·조합 종료·focus와 UIAccessibilityElement/container·custom action·VoiceOver·입력 carrier 중복 노출을 검사한다.
- CADisplayLink·keyboard/scene observer·delegate·Metal completion·surface/App generation을 함께 회수한다. Multi-scene·background/foreground·close와 늦은 callback을 실제 앱에서 확인해야 한다.

## macOS — W9-04

- RNM의 **AppKit 원본** 입력/NSTextInput·focus·접근성·clipboard·환경·window/lifecycle 소스를 owned NSWindow/NSView·UI dispatcher·Core port로 이식한다. Template의 RNM **0.83.0**은 원본 선정 출발점이지 새 host 공급 검증값이 아니다.
- Main thread는 NSApplication/window/layer를, Render owner는 Skia Metal recorder/queue·drawable/GPU 완료를 소유한다. UI blocking 없이 frame credit·late completion·resize/hide/close 수명을 관리한다.
- Point/backing pixel·flipped/screen 좌표·Retina/다중 display·live resize·occlusion을 같은 metrics/publication에 맞춘다. NSEvent의 precise scroll/phase/momentum은 engine 관성과 이중 적용하지 않는다.
- NSTextInputClient의 UTF-16 marked/selected range·candidate rect·조합/clipboard와 NSAccessibility의 text/action/focus/bounds를 같은 Core revision에 연결한다.
- macOS **14 이상 NSView display link**는 계획상 첫 clock 후보이며 현재 지원·독립 frame pacing이 검증됐다는 뜻이 아니다.

## 공급·미완료 의무

착수 때 최저 OS·Xcode/SDK/compiler·Hermes/Skia·target triple을 고정한다. iOS device/simulator와 macOS arm64 binary를 섞지 않으며 일반 create/build/run/doctor/pack·framework/rpath·fonts/ICU/license·signing/entitlement·설치 identity·손상 거부를 대상별 확인한다. 로컬 unsigned 실행과 제품 signing/notarization도 별도 gate다.

Generation reload·device/context loss·기존 reader/Metal hold·autorelease·display link·App dispose/close drain, 원래 TS 디자인 전체 소비와 W9-05~11 corpus·W9-13/14가 모두 미완료다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display/scanout **notVerified**를 [work10 후속 의무](../11/work10-summary.md#work9-잔여-의무-이관)로 이월한다.

[work9 보관 목차](work9-summary.md) · [4부](work9-4-summary.md) · [이력 목록](../../../README.md)
