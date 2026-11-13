# Work9 4부 — Android 부분 구현·Linux host 계획 요약

원문: 루트 `work9-4.md` · 작성: **2026-11-05 KST** · 갱신·종료: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work10 이관** · 종료 당시 Android **PARTIAL / stale/notVerified**, Linux **DEFERRED**. 기존 Android standalone 성공과 RN Android 실제 소스 이식 완료는 별개다.

## 범위와 소스 이식 계약

기본 2차는 Android W9-12-B·Linux W9-03이며 Windows/Web 기술 gate 후 진행한다. 11월 7일 사용자 요청으로 Android와 필요한 공통 영역만 앞당겨 구현했다. 이후 3차 iOS/macOS를 2차의 선행 조건으로 두지 않는다.

11월 8일 교정에 따라 Android는 **RN Android**, Linux는 **RNL**의 필요한 플랫폼 API 소스를 가져와 수정하고 기존 소비자를 교체한다. ReactContext/tag/module을 owned Activity/view·dispatcher·값/handle·JNI/Core port로 바꾸되 원본 OS 동작·예외/수명·출처/license를 보존한다. 자체 구현이나 회귀 사례 참고만으로 이식 gate를 통과하지 않는다.

## Android 구현과 당시 검증

| 영역 | 11월 7일 standalone 구현·확인 범위 |
| --- | --- |
| Host/owner | RN 없는 Activity/TextureView·JNI·Hermes App/Content/Render/UI, Graphite/Dawn/Vulkan·ANativeWindow/Surface 세대와 비동기 drain |
| 입력·접근성 | ACK 기반 InputConnection buffer·UTF-16/code-point/grapheme·Hangul composing·nested batch·stale connection, 게시 caret/selection·virtual semantics/action·password masking |
| 원래 TS 소비 | EditableText/Controller·formatter/undo·controlled refusal·최소 터치 영역, Material decoration 없는 TextField와 기본 CupertinoTextField |
| 서비스 | canonical asset/network/font·TextPainter·ImmutableBuffer·ImageDescriptor/PNG/GIF·readback과 bounded IO/credit |
| 복구·reload | 실제 Dawn device loss 뒤 이전 App/worker/GPU/ledger drain 후 새 generation/State. Activity당 복구 2회, RN/Metro 없는 개발 reload·준비 실패 시 기존 세대 유지·dispose 실패 명시 거부 |
| 공급·CLI | create/build/doctor/run/pack·source/hash/ABI 검사·arm64-v8a와 x86_64 6개 필수 library·16 KiB ELF alignment |

당시 공급 `19de18b7…`, ABI **2 / schema 4042167114**, Android **43 files**였다. min SDK **26**, compile/target **36**, NDK **27.1.12297006**, JDK **21**, Gradle **8.14.3**·AGP **8.13.1**, Hermes **0.14.1/HBC96**, Skia **154.1.0**·Dawn **m154a**를 고정했다. 개발 debug key는 제품 signing/store qualification이 아니다.

- **Pixel_5 / Android 13(API33) / x86_64 / host Vulkan**에서 설치·첫 GPU frame·C++ **466명령 = SDK**, fallback **0**을 확인했다. arm64-v8a는 cross-build이며 실기기 실행이 아니다.
- Data **56조건**, Original **22조건**, 공개 API corpus의 asset **20읽기**·network **14읽기**·decode **10회/animated 4 frames**, reload suite **4/4** PASS. 실제 loss 뒤 새 State 복구와 정상/실패 종료의 ledger·worker 회수도 확인했다.
- 당시 공통 Core **430/430**, Windows/Web host **17/17**, 개발 회귀 **7/7** 등은 그 공급의 기록이다. RN Android 수정 이식본이나 후속 공통 wire의 검증으로 복사하지 않는다.
- Android의 DOM 없는 strict 선언 입력은 통과했으나 원래 surface 대조는 **inputValid=false / compatible=false / originalSurfaceChanged 18건**이었다. Strict import 성공과 runtime 호환을 구분한다.

전체 원래 API/catalog·기본 InkSparkle·selection toolbar/handle·동기 editing geometry·custom/multiline·autofill/전체 OS 서비스·font 알림·제품 signing은 남았다. 이후 공통 wire 변경으로 Android 공급은 **stale/notVerified**가 되었으며 해당 차수에서 두 ABI 공급·설치/run과 RN 소스 이식을 다시 확인해야 한다.

## Linux 계획과 미착수 범위

RNL 원본과 기존 소비자를 고정하고 **GTK 4.22 이상**의 UI main context·IM/AT-SPI와 독립 Render owner를 연결한다. 기존 Vulkan DMA-BUF exporter/GdkTexture helper는 추출 출발점일 뿐 실제 v2 GTK 실행 근거가 아니다.

- GPU 완료 후 immutable DMA-BUF를 GDK로 넘기고 최종 texture release까지 FD/VkImage/lease를 유지한다. UI에서 GPU를 기다리거나 숨은 CPU readback·무제한 buffer를 켜지 않는다.
- Wayland/X11·scale/metrics·fourcc/modifier·resize/hide/close·late release·ledger 회수, GtkIMMulticontext의 UTF-8↔UTF-16·caret와 GtkAccessibleText의 text/action/caret/selection을 확인해야 한다. GTK 4.22는 계획에 포함한 편집 접근성 변경 API의 요구다.
- 배포판/glibc·GTK/Vulkan/font/ICU·rpath·독립 앱 공급과 RNL 실제 소스/소비자 이관은 **DEFERRED / notVerified**다. GTK control로 TS 디자인 컴포넌트를 대체하지 않는다.

두 성능 flag **false**, 물리 장치/IME/TalkBack·display/scanout **notVerified**와 [work10 후속 의무](../11/work10-summary.md#work9-잔여-의무-이관)를 유지한다. 당시 삭제 거부로 남았던 임시 출력은 제품 실패와 별도였으며 이번 보관에서 재검증·정리하지 않았다.

[work9 보관 목차](work9-summary.md) · [3부](work9-3-summary.md) · [5부](work9-5-summary.md) · [이력 목록](../../../README.md)
