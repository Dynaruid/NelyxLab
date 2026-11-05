# work9-4 — 4부: Android·Linux 호스트

작성·검토: **2026-11-05 KST** · 상태: **DEFERRED / 2차·Windows/Web 1차 완료 후 착수 / 구현 미착수·notVerified**

[전체 목차](work9.md) · [이전: 3부](work9-3.md) · [후속: 5부 iOS·macOS](work9-5.md)

**범위:** 원문 §11.4·§5. Android standalone host·OS 입력/접근성·RN 코드 분리와 Linux GTK4/DMA-BUF·IM/AT-SPI·공급을 다룬다. 기존 절 번호와 단계 ID를 유지한다.

**개발 순서:** Windows/Web 1차 → **4부 Android·Linux 2차** → 후속 5부 iOS·macOS 3차다. 4부의 W9-12-B(Android)·W9-03은 Windows/Web 1차 완료 후 착수하며, iOS/macOS 구현·Apple toolchain·공급을 기다리지 않는다.

**공통 계약과 완료 조건:** [2부 §11.2의 mirror/ACK·입력 수명](work9-2.md#112-중립-adapter와-상태-계약), [§11.6의 M0–M4](work9-2.md#116-도입-순서와-의존성-gate), [§11.7의 공통 corpus](work9-2.md#117-공통-입력수명-검증-corpus)를 Android에 적용한다. Android와 Linux 각각의 W9-05–11 corpus·[W9-13/14](work9-3.md#123-단계별-범위와-완료-조건)를 연결하고 API·host·공급 통합을 마친 뒤 5부에 착수한다. 물리 입력·성능 수락은 대상별로 남긴다.

## Android 호스트

### 11.4 Android — 기존 Nelyx OS 코드를 먼저 분리

**2차 W9-12-B(Android) / DEFERRED.** 아래 추출과 RN 의존성 제거는 Windows/Web 1차 완료 후 Linux와 같은 4부에서 수행한다. iOS·macOS 구현이나 Apple 공급을 이 단계의 완료 조건으로 요구하지 않는다.

1. `NelyxInputConnectionView`의 OS buffer/IME·keyboard·geometry·close 처리를 추출한다. RN Context/map/event/ViewManager를 일반 Android Context·고정 native 값 타입·v2 input port/JNI로 교체한다. 기존 v1 RN wrapper는 같은 중립 helper를 사용할 수 있도록 공급 경계를 정하며 현재 v1 경로를 먼저 삭제하지 않는다.
2. Commit/composing/selection/batch/delete와 hardware key를 Core 입력으로 연결한다. UTF-16 길이·`deleteSurroundingTextInCodePoints`의 code-point 수·grapheme 삭제를 구별하고 `newCursorPosition`, nested batch, 오래된 connection과 조합 종료 중 App 변경을 검사한다.
3. RN의 IME 예외 처리·focus·keyboard inset·Activity/service 로직은 필요한 기능 단위로만 이식한다. Root/tag 조회는 owned Activity/view·engine handle로 바꾸며 ReactHost·ReactContext·UIManager나 RN event dispatch가 필요한 실행 경로를 남기지 않는다.
4. Semantics는 Core node 세대와 Android accessibility virtual node/action으로 연결한다. RN ViewGroup의 접근성 구현이나 화면에 없는 native text control의 존재로 전체 C++ semantics tree·range/action이 제공된다고 가정하지 않는다.
5. Native surface·device/resize/background/foreground·close/drain을 연결한다. Frame 수요는 Android Choreographer에서 host clock 계약으로 전달하며 JS/RN frame scheduler를 필요로 하지 않는다. GPU owner와 App/Content 독립성은 기존 native 계약을 적용한다.

초기 대상은 arm64-v8a 최소 scene·입력·InputConnection·접근성·공급/drain이다. Emulator와 실기기·IME별 자동/물리 결과는 각각 기록하며 전체 Testbed·디자인 제품 수락과 구분한다.

## 5. Linux — GTK4 호스트

**2차 W9-03 / DEFERRED.** 아래 설계는 보존하며 GTK prototype·toolchain·DMA-BUF 추출은 Windows/Web 1차 작업에 포함하지 않는다.

**GTK4 UI와 독립 Render worker 사이에 immutable GPU frame을 전달한다.** GTK widget·window·IM·접근성 객체는 UI main context에서 관리하고 App/Hermes·Content/layout·Render/GPU owner는 분리한다. GTK 객체를 Render thread에서 임의로 조작하지 않는다. [GTK threading 규칙](https://docs.gtk.org/gtk4/section-threading.html)

저장소에는 이미 [DMA-BUF exporter](Nelyx/skia/native/platforms/vulkan/dmabuf.inc)와 [GdkTexture import helper](Nelyx/skia/packages/rn/native/linux/DmaBufTexture.h)가 있다. RN/JSI 수명을 제거한 공통 계층으로 추출해 재사용을 검토한다. 해당 소스는 출발점이며 v2의 실제 GTK4/GPU 실행 증거는 아직 없다.

로컬 [Flutter Linux GTK 설정](reference/flutter-master/engine/src/flutter/shell/platform/linux/config/BUILD.gn)은 `gtk+-3.0`을 사용한다. Flutter의 owner·frame·입력 책임 분리는 참고하되 GTK3 widget/접근성 코드를 GTK4 구현으로 간주하지 않고 아래 GTK4 공개 계약으로 다시 연결한다.

1. UI에서 GDK display의 지원 fourcc/modifier를 조회하고 Render device와 교집합을 고정한다. 기본 후보는 기존 ARGB8888 경로다. Alpha·stride/offset·color state·물리 크기와 scale을 명시하고 Wayland/X11 및 driver별 실제 import를 확인한다.
2. Render가 GPU frame을 완성하고 외부 consumer가 읽어도 되는 상태로 넘긴 뒤 UI가 `GdkDmabufTextureBuilder`로 texture를 만든다. 기존 exporter의 동기 GPU 완료 대기는 **Render owner**에서만 허용하며 UI를 막지 않는다. GPU copy/대기·할당 비용은 계측 대상이고, DMA-BUF라는 이유로 전체 경로를 zero-copy나 저지연으로 판정하지 않는다.
3. Custom GtkWidget의 snapshot 또는 GtkPicture가 준비된 texture를 GTK scene에 연결한다. Engine publication 후보·GTK 채택·GPU 완료를 구분하고 입력은 해당 host publication의 geometry를 사용한다. GTK snapshot 실행이나 frame-clock callback을 물리 scanout 증거로 쓰지 않는다.
4. Frame lease는 GDK의 최종 texture release까지 FD·VkImage·memory를 보유한다. Reference 해제 callback은 engine/App callback에 재진입하지 않고 해당 GPU owner로 회수를 전달한다. Resize·hide·import 실패·close에서 GDK reference와 늦은 callback을 먼저 정리할 수 있도록 pump와 Render drain 순서를 고정한다.
5. Core frame hold·최신 게시 대기·GDK consumer hold와 exporter의 별도 제한을 한 ledger에 연결한다. 기존 exporter의 **4096축/64 MiB** 제한과 v2 provider의 크기/예산 차이는 W9-03 착수 때 조정한다. 큰 창에서 숨은 CPU readback이나 무제한 buffer를 켜지 않으며 초과는 명시적 거부다.
6. Keyboard·pointer·`GtkEventControllerScroll`·focus·clipboard를 canonical input으로 변환한다. `GtkIMMulticontext`의 preedit/commit/surrounding/delete/cursor-location을 Core editing revision에 연결하고 UTF-8 byte/문자 offset과 UTF-16을 각 API 규약대로 변환한다. IME가 소비한 key를 다시 일반 text로 적용하지 않는다.
7. Semantics node의 GtkAccessible peer와 formatted text용 GtkAccessibleText를 구성한다. GTK label만 갱신한 것을 전체 tree/text/action 지원으로 세지 않는다. AT-SPI 질의·action·focus·stale node·게시 range bounds를 실제 peer에서 검사한다.

`GdkDmabufTextureBuilder`는 GTK 4.14부터 제공되며 format 지원과 FD 수명 처리가 필요하다. 이 계획의 초기 최소는 4.16으로 두고 사용 API의 도입 버전도 함께 검사한다. [DMA-BUF builder](https://docs.gtk.org/gdk4/class.DmabufTextureBuilder.html), [build/release 계약](https://docs.gtk.org/gdk4/method.DmabufTextureBuilder.build.html), [IMContext](https://docs.gtk.org/gtk4/class.IMContext.html), [AccessibleText](https://docs.gtk.org/gtk4/iface.AccessibleText.html)

`GtkGLArea`는 OpenGL framebuffer를 GTK에 통합하는 별도 방식이다. 현재 Graphite/Vulkan renderer를 그 안에 바로 연결할 수 있다고 가정하지 않는다. DMA-BUF prototype이 실패하면 실패한 capability·환경을 기록하고 Linux gate를 미완료로 유지한다. GL provider 추가는 owner·Skia 공급·기능 동등성을 다시 설계하는 명시적 대안이다. [GtkGLArea 계약](https://docs.gtk.org/gtk4/class.GLArea.html)
