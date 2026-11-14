# Work9-a — 단일 frontend·엔진 중심 구조 개편 요약

원문: 루트 `work9-a.md` · 작성·종료: **2026-11-08 KST** · 이관 갱신: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work9-b, 이후 work10 이관** · 구현: **PARTIAL**. 종료는 구조 개편·전체 API·제품 전환·레거시 삭제 완료가 아니다.

## 구조 개편의 결론

별도 `/v2` Widget/디자인 구현과 원래 framework adapter를 병행 확장하지 않고, **원래 TS Widget/Element/State·BuildContext/GlobalKey를 유일한 App frontend**, C++ v2를 유일한 제품 scene 실행 경로로 만드는 것이 목표였다.

- BuildOwner→native 설정→SceneWriter를 직접 연결하고 두 번째 Widget tree를 제거한다. TS는 구성·정책·명령 기록·callback을, C++는 최종 layout/geometry/hit/gesture/편집·scene·수명을 맡는다.
- SDK·CLI·config/template·sample의 분리된 부팅/빌드 경로를 하나로 이관한다. 원래 Material/Cupertino의 TS theme·State·controller를 유지하며 축소 `/v2` 사본으로 대체하지 않는다.
- **대체 구현 → 실제 소비자 이관 → 제품 확인 → 구 실행부/설정 삭제** 순서를 지킨다. 중립 Skia/Hermes/JSI·font/paragraph·OS 입력·compiler helper는 엔진/tooling 소유로 옮긴 뒤 유지하며 오래된 디렉터리라는 이유로 일괄 삭제하지 않는다.
- 원래 API **4 packages / 834 subpaths**·서명 의무를 보존한다. export 개수·폴더 이동·alias나 native ownership guard만으로 동기/custom/React/Renderer 주입 계약의 호환을 승인하지 않는다.

## 구현·검증한 범위

W9A-00~03의 소비자 대응·App 계약·공통 helper·직접 scene 연결을 구현했다. W9A-04~08은 부분 진행이며 09~12 전체 기술/제품 전환·후속 플랫폼·전역 삭제는 남았다.

| 범위 | 당시 실제 연결·확인 |
| --- | --- |
| App/scene | SceneWriter가 handle·diff·ACK/NACK·불확정 ACK·upload/event를 소유. `@nelyx/sdk/app`의 defineApp/launchApp이 공통 session 서비스 준비 뒤 원래 Widget mount |
| 공통 코드·도구 | Windows TSF/UIA·Vulkan/font/paragraph와 Android 입력 규칙의 엔진 소유 이관, compiler helper·신규 nelyx.json/template, 엔진 공급과 App bundle 빌드 분리 |
| Core/Source | 모듈 소유 Box/Flex/Stack·clip/transform 설정, TapRegion·Offstage·Block/Exclude/route semantics·Snapshot, 실제 Content constraints를 쓰는 LayoutBuilder |
| 목록·글꼴 | 원래 Sliver Element/State·Key/KeepAlive·공유 예산의 고정/가변 목록·숫자/index seek·padding/0높이/빈 목록/resize, Icon·CJK baseline·세 글꼴 자산 |
| 서비스·VM | 공개 Clipboard·Feedback와 취소/close, 한글/emoji 편집. Windows lexical TDZ 동등성은 미완료이며 JS 언어 전체 호환으로 확대하지 않음 |

마지막 **검증된** 목록 공급은 source **`f26ab2f1…` / ABI 2 / schema 855578348**, Windows/Web **343 files**, Android **52 files**였다. Web 두 profile 및 새 **8 packages** offline 설치 소비자의 목록 State **83생성/83dispose**, Windows HWND/App SDK의 OS pointer 목록 흐름 각 **28/28**과 정상 close 예약/메모리 **0**, worker join을 확인했다. TypeScript **7.0.2 / NodeNext / ES2022 / types=[] / skipLibCheck=false** 선언·CLI doctor/build/pack도 범위 내 PASS다.

Android x86_64 emulator에서는 원래 controls/편집·clipboard/feedback·세 글꼴과 정식 stop을 구간 확인했다. 이후 목록/TapRegion/route 등의 Android는 두 ABI compile/hash까지만 확인한 범위를 구분한다. Emulator/합성 OS 입력은 실기기·물리 IME/reader·성능 수락이 아니다.

## 종료 당시 미검증 변경과 공급 불일치

MouseRegion/exclusive Tooltip 정책·retained pointer path, Wrap·Flex baseline·positioned Stack과 codec/Core 변경을 작성했다. Source schema **3719990506 / layout 192 bytes**, 당시 source **`32b5f2ec…`**로 바뀌었으나 dist는 위 **f26ab2f1… / schema 855578348**이었다.

Core package build·전체 타입과 C++ **5 units /W4 /WX compile-only**는 PASS였지만 실제 protocol·Source/Core 수치·설치 소비·Windows/Web/Android 동작은 **notVerified**다. 마지막 검증 공급의 원래 Gallery **878 modules**는 Web 두 profile 모두 `_RenderExclusiveMouseRegion`에서 명시 실패했다. 새 코드가 이 차단을 해소했다고 판정하지 않았다.

## 남은 의무와 후속

위 초안의 의미/수명·공급 일치를 먼저 검증하고, 중앙 render 분기·마지막 TS 실행 소비자·전체 디자인/semantics·TapRegion 동기 재진입·SDK 환경/font/lifecycle/VM·reload/loss·공통 target descriptor·Testbed/Demo 전체로 확장하도록 [work9-b](../09/work9-b-summary.md)에 이관했다. 기존 W9-00~14·W9A-00~12의 미완료를 재번호로 완료 처리하지 않는다.

전체 **compatible=false**, 두 성능 flag **false**, 물리/display/scanout **notVerified**, Linux·iOS/macOS **DEFERRED**를 유지한다. 최종 의무 대응은 [work10](../11/work10-summary.md#work9-잔여-의무-이관), 이후 중단·보관한 후속은 [work11 요약](../14/work11-summary.md)이다.

[work9 보관 목차](../05/work9-summary.md) · [이력 목록](../../../README.md)
