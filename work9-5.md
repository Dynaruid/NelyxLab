# work9-5 — 후속 5부: iOS·macOS 호스트

> 2026-11-07: 사용자 요청으로 본문의 독립 테스트·감사·실험 명령을 폐기했다. 이전 검증 기록과 미완료 판정은 보존하며, 현행 확인·정리 기준은 [전체 목차의 정리 안내](work9.md)를 따른다.

작성: **2026-11-05 KST** · 재검토: **2026-11-06 KST** · 상태: **DEFERRED / 3차·Android/Linux W9-13 기술 완료 후 착수 / 구현 미착수·notVerified**

[전체 목차](work9.md) · [이전: 4부 Android·Linux](work9-4.md)

**범위:** 원문 §11.5·§6. iOS UIKit/UITextInput과 macOS AppKit/Metal host·입력/접근성·Apple 공급을 후속 설계로 보존한다. 기존 절 번호와 W9-12-B(iOS)·W9-04를 유지한다.

**착수 순서:** Windows/Web 1차 → Android/Linux 2차(4부) → **iOS/macOS 3차(후속 5부)**다. 이 부의 prototype·toolchain·RN 예외 처리 추출·Apple 배포를 앞선 두 차수의 완료 조건으로 두지 않는다.

착수 조건은 Android와 Linux **모두의 W9-13 기술 완료**다. W9-14의 물리·성능 수락과 기본값 전환은 대상별로 별도 유지한다. [완료·차수 전환 기준](work9-3.md#125-차수-전환과-완료-판정)

**공통 계약과 완료 조건:** Android 단계에서 마련한 중립 helper와 [2부 §11.2·§11.6–11.7](work9-2.md#112-중립-adapter와-상태-계약)을 대상별로 확장한다. iOS·macOS 각각의 W9-05–11 corpus·[W9-13/14](work9-3.md#123-단계별-범위와-완료-조건)를 실제 Apple 환경에 연결한다. 앞선 플랫폼의 통과나 AppKit의 성공을 UIKit의 성공으로 복사하지 않는다.

**디자인 패키지 구현:** iOS/macOS에서도 `packages/cupertino`·`packages/material`은 같은 **TypeScript Widget/State·theme·callback·controller·컴포넌트 동작**을 유지하고 C++ engine을 사용한다. [1부 §1.1](work9-1.md#11-typescript-디자인-패키지와-c-엔진의-책임)과 [2부 §8.2](work9-2.md#82-디자인-패키지의-typescript-구현-유지)를 적용한다. UIKit/AppKit·Objective-C++·Metal의 구현 범위는 OS adapter와 공통 engine/provider이며, Cupertino 디자인 패키지를 UIKit Widget 사본이나 C++ 컴포넌트로 바꾸는 작업은 포함하지 않는다.

두 target 모두 2부 §10의 generation reload·세대 차단·loss/재시작·close 계약을 해당 host/CLI에 적용한다. iOS는 W9-12-B, macOS는 W9-04에서 시작하고 W9-13에서 전체 기능과 통합한다. 기존 Apple runner의 기능을 새 standalone host의 완료 증거로 대신하지 않는다.

## iOS 호스트

### 11.5 iOS — UIKit 입력 endpoint와 RN 예외 처리 이식

**3차 W9-12-B(iOS) / DEFERRED.** 아래 UIKit host·RN 예외 처리 이식은 Android/Linux 2차 통합 완료 이후 macOS와 같은 후속 5부에서 수행한다.

1. UIApplication/scene·owned UIView/UIViewController·Metal surface를 만드는 자체 host를 공급한다. 서비스의 `RCTKeyWindow`·RN root lookup은 해당 scene/view의 명시 소유권으로 바꾸고 multi-scene·background/foreground·close를 검사한다.
2. 첫 입력 endpoint는 Core에 연결한 **UIView/UITextInput**으로 계획한다. UITextPosition/UITextRange·marked/selected range·tokenizer/selection 질의·UIKeyboard와 clipboard를 구현하고, 네이티브 동기 버퍼와 Core revision을 [§11.2](work9-2.md#112-중립-adapter와-상태-계약) 계약으로 연결한다. 보이는 글자·caret/selection geometry는 Core paragraph를 사용한다.
3. RN delegate adapter에서 선택/자동수정·중복 알림·입력 종료 순서의 OS 처리를 이식한다. UITextField/UITextView 전용 delegate/RCT protocol이 필요한 부분은 Nelyx endpoint에 맞게 다시 구현하거나 비교 사례로 남긴다. Native text control의 자체 layout/selection rect를 Core geometry의 대체값으로 사용하지 않는다.
4. UIAccessibilityElement/container·text range·custom action·focus를 Core semantics에 연결한다. 입력 carrier와 semantics peer가 같은 항목을 중복 노출하지 않도록 하고 VoiceOver focus·게시 bounds·삭제 node를 확인한다.
5. CADisplayLink·keyboard/scene observer·delegate·Metal completion과 App/View generation의 수명을 함께 정리한다. RN 전용 teardown marker·JS 이벤트 응답 없이 정상 종료하고 늦은 callback을 거부하는 실제 .app을 검증한다.

원래 TypeScript AnimationController/Ticker·Cupertino/Material 전환 정책과 listener는 App에서 실행하고 host clock의 frame 시각을 연결한다. Engine의 준비 scene 합성은 이 App callback과 분리한다. UIView/UITextInput·접근성 peer는 OS 연결을 맡으며, UIKit control의 자체 theme/State로 두 디자인 패키지의 동작을 대체하지 않는다. 명시적 platform view는 W9-11의 별도 계약을 따른다.

UITextInput의 동기 질의·UIKit text/selection 변경 알림·delegate 재진입도 mirror/ACK corpus에 포함한다. Core geometry가 없는 새 revision에 이전 range rect를 현재 값으로 반환하지 않는다. Scene을 닫거나 background로 전환하는 동안 input/keyboard/display callback·surface 세대를 차단하고, 복귀 때 현재 scene/metrics로 재게시한다. 여러 scene의 focus·편집·close가 서로 영향을 주지 않는지 확인한다.

최소 host/입력/편집/semantics·공급은 target별 W9-12-B(iOS)에 포함한다. UIKit/Metal 실행은 실제 iOS 환경에서 확인하며 simulator와 device arm64·signing 조건을 구별한다. W9-13에서는 원래 TypeScript 디자인의 theme/State·controlled callback·변경 거부/취소·dispose와 C++ 실제 작업을 함께 검증한다. macOS AppKit의 성공을 iOS의 성공으로 보고하지 않는다.

## 6. macOS — AppKit 호스트

**3차 W9-04 / DEFERRED.** 아래 설계는 보존하며 Android/Linux 2차 통합 완료 이후 iOS와 같은 후속 5부에서 착수한다. AppKit/Metal prototype과 Apple 공급은 Windows/Web 1차나 Android/Linux 2차 완료의 선행 조건이 아니다.

**NSApplication/NSWindow/NSView와 Objective-C++ adapter를 사용한다.** macOS host를 React Native macOS나 Mac Catalyst 경로의 완료로 대체하지 않는다. 기존 [Apple Skia view](Nelyx/skia/packages/rn/apple/SkiaView.h)의 Metal 수명·공급 코드는 RN/Fabric과 분리할 수 있는 부분만 추출한다.

| 작업 | 고정할 계약·완료 증거 |
| --- | --- |
| UI·surface | Main thread가 NSApplication·NSWindow·layer-backed NSView/CAMetalLayer와 이벤트를 소유. Render owner는 고정 Skia Metal context/recorder·command queue를 소유. Drawable 획득 지연과 GPU 완료 대기를 UI 밖에서 처리하고 layer 변경/resize는 main thread에서 직렬화 |
| Geometry | AppKit point·backing pixel·engine 논리 좌표, flipped view·screen 좌표를 한 adapter로 변환. Retina/다중 display·live resize·occlusion/miniaturize·zero-size·restore에서 metrics/device/publication 정합성 유지 |
| Pointer·scroll | NSEvent pointer/key·precise scrolling delta·phase/momentumPhase·magnify/rotate를 canonical stream으로 변환. OS momentum과 engine friction 중 한 소유자를 선택해 이중 관성을 방지하고 cancel·재접촉·capture 이탈을 검사 |
| 편집 | NSView의 NSTextInputClient/NSTextInputContext를 Core document에 연결. marked text·selected/marked range·insertText·명령 key·candidate rect·조합 종료·clipboard를 구현. NSRange의 UTF-16과 게시 paragraph identity를 보존 |
| 접근성 | NSAccessibility peer의 role/value/action/focus·text range·screen bounds를 같은 semantic snapshot에서 제공. App 동기 응답을 기다리지 않고 최신 비시각 값과 게시 geometry의 차이를 표현 |
| TypeScript 디자인 소비 | 원래 Material/Cupertino Widget/State·theme·controller·route/overlay를 App에서 실행하고 C++ engine의 layout/paint/input 연산에 연결. NSView는 host 역할을 유지하며 NSControl이나 C++ 디자인 Widget로 원래 구현을 대체하지 않음. 실제 설치 앱에서 원래 callback·controlled 값/NACK·스타일 변경·dispose를 검사 |
| 수명·공급 | .app bundle의 engine/Hermes/Skia·fonts/ICU·license·rpath·code signing 조건을 고정. App dispose·autorelease/Metal completion·display link 해제·window close의 순서를 검증. 로컬 unsigned 실행과 배포용 signing/notarization은 별도 gate |

두 Apple host의 Metal provider는 drawable/frame credit·pixel format/color space·metrics/device 세대와 GPU completion hold를 명시한다. Drawable 획득 실패/지연·숨김·resize·close에서 유한 대기/취소 정책을 사용하고 UI thread를 막지 않는다. 이전 세대 completion이 새 surface를 게시하거나 해제하지 않으며, 마지막 GPU/OS consumer hold가 끝나기 전에 layer/device/provider를 파괴하지 않는다.

3차 착수 때 iOS 최저 OS·device/simulator ABI와 macOS deployment target·Xcode/SDK/compiler·Hermes/Skia 공급을 **target triple별로** 고정한다. `arm64` 이름이 같아도 iOS device·simulator·macOS binary를 섞지 않는다. 각 일반 앱의 create/build/run/doctor/pack·framework/rpath·signing/entitlement·설치본 identity와 손상 거부를 W9-13에 연결하며 개발 Mac의 source 경로·외부 설치에 의존하지 않는지 확인한다.

두 디자인 패키지는 TypeScript/JS·선언·자산으로 공급하고 native engine/provider/host binary와 build target은 공통 공급에 둔다. 디자인 패키지 아래에 C++/Objective-C++ Widget 구현이나 native target을 추가하지 않는다. 기존 engine capability 안의 theme/상태별 스타일 변경은 TypeScript 패키지/adapter 갱신으로 반영하며, Apple native 재컴파일을 디자인 변경의 필수 단계로 만들지 않는다. 이번 경계 수정으로 기존 **DEFERRED / 구현 미착수 / notVerified**나 W9-13/14 판정은 바꾸지 않는다.

macOS 14 이상의 NSView display link를 첫 clock 경로로 검토한다. Display 이동·숨김에 따른 callback 변화와 main run-loop의 resize mode를 반영하고 Render owner에는 버전 있는 frame 수요를 전달한다. API 존재만으로 독립 raster나 frame pacing을 수락하지 않는다. [AppKit macOS 14 Display Link](https://developer.apple.com/documentation/macos-release-notes/appkit-release-notes-for-macos-14), [NSView displayLink](https://developer.apple.com/documentation/appkit/nsview/displaylink(target:selector:))

Metal view와 IME range의 기준은 [custom Metal view](https://developer.apple.com/documentation/metal/creating-a-custom-metal-view), [NSTextInputClient의 screen rectangle](https://developer.apple.com/documentation/appkit/nstextinputclient/firstrect(forcharacterrange:actualrange:))이다. macOS 14를 최소로 둔 것은 이번 계획의 선택이며 현재 공급의 지원 확인 결과는 아니다.
