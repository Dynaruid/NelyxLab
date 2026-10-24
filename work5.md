# work5 — Flutter 방식의 TypeScript 프레임워크 반자동 이식과 Bun 도구 개발 계획

작성일: **2026-10-10 KST**. 검토 기준: Nelyx `8014f95c4b16501af980081c174f59da3a315759`, DorotiLab `d8d1e1796bcaf7be33361afdc0dc3b6cef627fea`의 실제 소스와 공개 upstream 자료. 작성 시작 시 `work5.md`는 비어 있는 미추적 파일이었다. Nelyx의 `.github/copilot-instructions.md`와 별도 `AGENTS.md`는 없었으며, Doroti의 저장소 지침도 확인했다.

구성 방식 수정일: **2026-10-11 KST**. 사용자 요청에 따라 반자동 이식 도구는 Doroti의 `tools/Doroti.DartToCSharp/`처럼 저장소 루트 `tools/`에 독립된 **Bun/TypeScript 프로젝트**로 구성한다.

**사용자 선택에 따라 기본 방식을 반자동 이식으로 정한다.** 도구가 Doroti/Flutter의 선택한 소스를 분석하고 TypeScript 초안·의존성 매핑·변경 diff를 만들면, 구현 담당자가 의미 차이와 플랫폼 경계를 검토·수정해 Nelyx 제품 소스로 채택한다. Widget·Element·RenderObject를 기존 프레임·자원 수명 위에 연결하는 순서로 진행한다.

**필요한 이식 도구는 작업을 진행하면서 만들어 간다.** 첫 symbol 묶음을 처리할 최소 기능부터 시작하고, 각 계층을 이식하며 반복되는 규칙을 추가한다. 처음부터 범용 C#/Dart compiler를 완성할 필요는 없다. 채택한 이식 도구·변환 규칙·원본 매핑은 유지하고, 임시 검증 코드·실험 출력은 검증 후 정리한다. ApolloVM 등 구체적인 구현 도구는 최초 실제 이식 결과로 선택한다.

도구 경로는 **`tools/Nelyx.FrameworkToTypeScript/`**, 실행·패키지 관리는 **Bun**, 주 구현 언어는 **TypeScript**로 정한다. SDK·앱에서 사용하는 제품 코드와 이 도구의 의존성·설치·lockfile을 나누고, 이식 결과는 검토 후 기존 `Nelyx/src/` 등에 채택한다.

이 문서는 설계와 실행 기록이다. **2026-10-11 W5-00~11의 선정 기능 구현·대표 target 검증·소비 확인·최종 정리를 완료했다.** 사용자 지시에 따른 PowerShell·Playwright 검사로 Chrome·Windows·Android emulator의 공유 화면과 Web Fast Refresh를 확인하고, 그 과정에서 발견한 순환 import와 DOM remount 수명 오류를 수정했다. 정리 후 제품 build/typecheck/Web build도 통과했다. 플랫폼의 물리 입력·한국어 IME·reader·scanout/서명 수락은 아래 개별 범위를 따르며 `PARTIAL/notVerified`를 유지한다.

## 1. 착수 당시의 공백과 목표

현재 Nelyx는 Flutter 방식의 프레임워크를 올릴 **호스트·렌더러·자원 수명 기반**을 갖춘 단계다. README의 설명과 실제 소스가 일치한다. 핵심 공백은 플랫폼 runner의 수보다 공통 UI 트리와 그 트리를 움직이는 시스템이다.

| 실제 확인한 소스 | 현재 기능 | W5에서 채울 부분 |
| --- | --- | --- |
| `Nelyx/src/hosting/runtime.ts` | AppSession·ViewRuntime, scene 생성, pending frame 교체, 제출·lease·종료 | View별 framework root, build/layout/paint 예약, 트리 수명 |
| `Nelyx/src/ui/types.ts`, `ui/frame.ts` | 불변 PaintFrame, rect/rrect/image/paragraph·2D transform·clip, 세대 확인 | layout/hit test/layer, 필요한 paint 연산의 점진적 확장 |
| `Nelyx/src/foundation/clock.ts` | `Clock.now()`와 timestamp 없는 `FrameClock.request()` 계약 | 단조 시간 기반 scheduler·ticker, 프레임당 갱신 병합 |
| `Nelyx/src/ui/text.ts` | paragraph 결과·UTF-16 범위·budget 확인 | TextPainter·RenderParagraph, 편집·선택·캐시 수명 연결 |
| `Nelyx/src/hosting/interaction.ts`, `ui/editing.ts` | 편집 binding과 제한된 semantics 계약 | pointer/keyboard/focus, 여러 editor, semantics 트리·action |
| `Nelyx/sdk/src/backends/react-native/interaction.ts` | native control 연결, surface당 editor 하나, composing/selection direction은 `unavailable` | 공통 위젯 입력 연결과 실제 native 편집 정보 관측 |
| `Nelyx/sdk/src/platforms/web/surface.tsx` | canvas와 별도 TextInput/button host | framework가 배치하는 입력·접근성 bridge |
| `sample/nelyx-testbed-app/src/app.ts` | 수동 좌표·PaintCommand로 장면 작성 | 같은 화면을 공통 Widget 트리로 표현 |

Doroti에는 실제 `Widget`, `Element`, `BuildOwner`, `PipelineOwner`, `RenderObject`, scheduler·gesture·scroll·편집 구현이 있다. 특히 `Doroti.Framework.Widgets/framework.cs`와 `Doroti.Framework.Rendering/object.cs`는 검토된 제품 C# 소스다. Material·Cupertino는 현재 `packages/Doroti.Material`, `packages/Doroti.Cupertino`에 따로 있다. 이 구조와 동작은 좋은 출발점이며, .NET·SkiaSharp·호스트 의존성까지 함께 가져오는 비용은 별도로 계산해야 한다.

**가장 먼저 만들 결과물:** TypeScript의 `StatefulWidget`, `Column/Row`, `Text`, 버튼으로 구성한 화면이 Nelyx의 layout·paint·hit test를 거쳐 기존 Skia surface에 표시되고, 버튼 클릭·창 크기 변경·닫기가 공통 코드로 동작한다. 화면을 완성하는 데 필요한 기반부터 구현한다.

## 2. 소스 이식·변환 선택지와 판단

| 선택지 | 얻을 수 있는 것 | 추가로 해결할 일 | 권장 사용 |
| --- | --- | --- | --- |
| Doroti C# 전체 → TypeScript 자동 변환 | 이미 정리된 알고리즘과 폭넓은 위젯 구현 활용 | CLR 타입·virtual dispatch·generic·delegate·extension·Dart runtime helper와 native port의 TS 의미 변환 | 선택한 제품 C#을 반자동 이식의 우선 입력으로 사용한다. 전체 무인 변환은 채택하지 않는다. |
| Flutter Dart 전체 → TypeScript 자동 변환 | upstream 원본과 갱신 추적이 직접 연결됨 | Dart 언어 의미, resolved symbol, `dart:ui`, scheduler·text·semantics·platform service 대체 | 선택한 symbol의 직접 이식 경로와 동작 기준으로 사용한다. 전체 framework의 일괄 도입은 뒤로 미룬다. |
| ApolloVM으로 Dart/C# → TypeScript 변환 | 기존 parser·공통 AST·generator 활용 가능 | 실제 Flutter 문법·library 해석·런타임 의미·출력 품질·Hermes 실행 확인 | 반자동 도구의 frontend/emitter 후보. 통과한 문법·의미 범위에서 사용하고 제품 runtime에는 넣지 않는다. |
| Dart 공식 JS/Wasm compiler | 공식 Dart 컴파일 도구 활용 | TS 공개 API·모듈 구조·Hermes/JSI·Flutter engine 서비스와의 연결 | Nelyx의 TS framework를 만드는 기본 도구로 선택하지 않는다. 별도 Dart 실행 제품을 원할 때 재검토한다. |
| 선택 소스의 자동 분석·변환 + 의미 검토·수정·채택 | 반복 코드 변환을 도구에 맡기면서 Nelyx의 타입·트리·host 계약에 맞출 수 있음 | 지원 규칙·미지원 진단·원본 매핑·수정 코드의 갱신 정책 | **채택한 기본 경로.** 순수 계산부터 시작해 상태·트리·위젯으로 확대한다. host 연결과 의미 차이는 담당자가 보완하고 반복되는 수정은 규칙으로 올린다. |

Flutter는 framework, engine, embedder의 책임을 나누며 UI 트리 아래에도 text·입력·플랫폼 서비스가 필요하다. 따라서 framework의 문법 변환이 끝나도 Nelyx의 엔진 연결은 구현해야 한다. 이 점이 전체 변환을 먼저 하지 않는 설계 근거다. [Flutter architecture](https://docs.flutter.dev/resources/architectural-overview)

`dart compile js`는 배포용 JavaScript와 source map을 만들고 `wasm`은 WebAssembly를 만든다. 그것이 유지보수할 TypeScript 소스나 Nelyx의 native renderer adapter를 자동으로 제공한다는 뜻은 아니다. 후자는 이번 구조에 대한 판단이며, 공식 compiler의 기능 부재를 주장하는 것이 아니다. [Dart compile](https://dart.dev/tools/dart-compile)

### ApolloVM은 어느 정도 고려할 것인가

확인한 공개 package는 `apollovm 2.31.0`, 저장소 revision은 `9dc34407f82d76fb320a6a478ac9d74db8407947`이다. Dart·C#·JavaScript·TypeScript 등을 공통 AST로 해석·변환하는 기능을 제공한다. 문서에는 module import도 있으므로 단순 수식 parser로만 취급하지 않는다. 이 snapshot의 Dart SDK 요구는 `>=3.10.0 <4.0.0`, 라이선스는 Apache-2.0이다. [프로젝트](https://github.com/ApolloVM/apollovm_dart/tree/9dc34407f82d76fb320a6a478ac9d74db8407947), [package](https://pub.dev/packages/apollovm/versions/2.31.0), [pubspec](https://github.com/ApolloVM/apollovm_dart/blob/9dc34407f82d76fb320a6a478ac9d74db8407947/pubspec.yaml)

다만 공개 언어 지원 목록만으로 Flutter 전체 framework의 의미 보존을 판단할 수 없다. 확인한 Dart grammar는 annotation을 읽은 뒤 버리며, TypeScript generator가 있다는 사실도 mixin·생성자·동등성·scheduler 의미의 보장을 대신하지 않는다. **이 프로젝트에 적합한 범위를 아직 실행으로 확인하지 못했다**는 판단이다. 원본 parser/generator를 기준으로 W5-01에서 확인한다. [Dart grammar](https://github.com/ApolloVM/apollovm_dart/blob/9dc34407f82d76fb320a6a478ac9d74db8407947/lib/src/languages/dart/dart_grammar.dart), [TS generator](https://github.com/ApolloVM/apollovm_dart/blob/9dc34407f82d76fb320a6a478ac9d74db8407947/lib/src/languages/typescript/ts/typescript_generator.dart)

실험을 통과하면 반자동 이식 도구의 **개발 시점 frontend/emitter**로 사용한다. 자동 변환 범위를 순수 함수로 고정하지 않고 실제로 통과한 클래스·알고리즘·위젯 구조까지 넓힌다. 미지원 symbol은 진단과 함께 보완 대상으로 분리하고 필요한 부분을 직접 이식한다. ApolloVM·Dart VM·Wasm 실행기를 앱에 추가하거나 매 프레임 VM 경계를 통과하는 구조는 W5 범위에 넣지 않는다.

### Doroti의 변환기를 재사용한다면

Doroti의 도구는 실제로 `Dart analyzer → typed Dart IR → Core IR → C# IR` 구조다. analyzer package는 현재 `analyzer: 9.0.0`을 고정하고, Core IR에는 equality·identity·microtask 등의 intrinsic 표현이 있다. C#으로 출력된 소스를 다시 Dart 취급하거나 C# printer만 교체하면 된다고 가정하지 않는다.

반자동 도구의 Dart 입력 경로로 **resolved Dart frontend/IR 재사용과 TypeScript lowering·AST emitter 추가**를 W5-01부터 검토한다. 원본 Dart를 선택했다면 C#을 중간 출력으로 거칠 필요가 없다. 다만 현재 IR과 orchestration은 Doroti compiler 내부 타입이며 FlutterBinding에도 Doroti 전용 매핑이 있다. 독립적으로 재사용 가능한 라이브러리인지, protocol 경계로 분리해야 하는지 먼저 확인한다. 새 TS backend는 아직 존재하지 않는다.

필요한 frontend·IR·변환 규칙부터 재사용하거나 작게 구현하고, 이식 도구를 실제 작업과 함께 발전시킨다. 기존 compiler 전체, analyzer cache·receipt·adoption/rebase 관리 체계를 Nelyx에 복제하지 않는다. Dart analyzer는 문법 AST뿐 아니라 분석 API를 제공하므로 resolved symbol이 필요한 선택 영역의 후보로 삼는다. [Dart analyzer](https://pub.dev/packages/analyzer)

### 반자동 이식에서 도구와 담당자가 맡을 일

| 공정 | 도구의 역할 | 담당자의 역할 |
| --- | --- | --- |
| 입력 선택·분석 | 고정된 source revision에서 선택 파일/symbol과 의존성을 추출하고 TS 목적지에 매핑 | 이번 계층에 필요한 범위를 정하고 primary source·port 경계를 선택 |
| TS 초안 생성 | 지원하는 타입·선언·method body·import를 AST 기반으로 변환하고 원본 위치·미지원 진단 제공 | equality·dispatch·generic·async·상태 수명과 API 모양을 검토·보완 |
| host·renderer 연결 | 이미 정한 service port와 이름·타입 매핑 적용 | scheduler, text/IME, semantics, GPU lease와 native 수명 연결 구현 |
| 확인·채택 | 기존 제품 build/typecheck와 변경 diff를 사용할 수 있게 출력 구성 | 실제 동작·실패·dispose를 확인하고 reviewed TS를 제품 경로에 채택 |
| 다음 이식·upstream 갱신 | 같은 규칙을 재사용하고 원본 변경·기존 TS 수정의 충돌 후보를 표시 | 필요한 수정만 반영하고 반복되는 보완을 변환 규칙으로 일반화 |

초기 primary input은 **Doroti의 검토된 제품 C#**을 우선한다. Flutter Dart는 원래 동작을 확인하고 직접 변환이 더 적합한 symbol의 입력으로 사용한다. 한 symbol을 양쪽에서 각각 생성해 제품에 중복 반영하지 않는다. C# frontend는 Roslyn syntax/semantic 분석을 우선 검토하고, Dart frontend는 기존 analyzer/IR 또는 실제 확인을 통과한 ApolloVM 경로를 선택한다. 두 frontend를 처음부터 모두 완성할 필요는 없다.

도구의 기본 흐름은 다음과 같다. 초안에 미지원 코드가 있으면 해당 채택을 막고 source 위치와 이유를 보고한다. 임의의 `any`, 빈 method, 기본값 반환으로 동작하는 것처럼 만들지 않는다.

```text
선택한 source·symbol·원본 pin
        ↓
분석·의존성/port 매핑 → 지원 규칙으로 TS 초안 생성
        ↓
원본과 TS diff·미지원 진단 → 의미 검토·수정·native 연결
        ↓
제품 typecheck/build·대표 동작 확인
        ↓
reviewed TS 채택 + 최소 원본/규칙 매핑 보존
        ↓
반복 규칙을 도구에 반영 → 임시 검증 코드·초안·dump 정리
```

도구는 이식하는 개발자가 Bun CLI로 명시적으로 실행한다. 일반 SDK build·CLI 생성 앱·앱 실행은 reviewed TS를 사용하며 Bun·Dart/.NET/ApolloVM이나 임시 원본 경로를 요구하지 않는다. 이식 과정의 코드 검토·채택은 구현 담당자가 수행한다.

### 도구를 점진적으로 만드는 순서

1. **W5-01:** `tools/Nelyx.FrameworkToTypeScript/`의 Bun 프로젝트·CLI 진입점·자체 typecheck부터 만든다. 원본 선택·source hash, 최소 타입/선언/수식 변환, TS 초안과 미지원 위치·직접 import 출력까지 첫 실제 symbol 묶음으로 사용한다.
2. **W5-02~04:** notifier·key·constraints·Element/State를 이식하면서 property/constructor·generic·상속·dispatch·collection·callback 매핑을 필요한 순서로 추가한다. 반복이 확인된 수정을 규칙으로 남긴다.
3. **W5-05~09:** gesture·physics·scroll·편집·design widget의 반복 패턴과 service port 매핑을 확장한다. OS·GPU 연결은 명시적 수동 port로 유지한다.
4. **해당 source를 처음 갱신할 때:** 이전 pin의 변환 초안, 새 pin의 초안, 현재 reviewed TS를 임시로 비교해 필요한 변경을 제안한다. 수정된 제품 소스를 자동 덮어쓰지 않는다. rename·삭제·미지원 변경은 담당자 검토로 보낸다.

도구 완성률이나 자동 변환 비율을 목표로 삼지 않는다. 작은 symbol 묶음을 분석·생성·검토·채택하는 한 사이클을 끝내고 다음 묶음에 재사용할 수 있으면 초기 도구로 충분하다. 미지원 symbol은 직접 보완하되 반자동 공정은 계속 사용한다.

## 3. 제품 구성과 소유권

기존 package 이름과 책임을 유지한다. framework는 먼저 플랫폼 독립 `@nelyx/core`의 직접 subpath로 제공하고, 새 package 분리는 배포상 필요가 생길 때 판단한다. 다음은 착수 때 정한 경로다. 기능이 생긴 모듈만 실제 구현했고 빈 계층은 만들지 않았다.

W5는 현행 RN/Hermes host, native Graphite와 Web CanvasKit/Ganesh/WebGL2 경로 위에서 진행한다. framework 구현과 RN·Skia 버전 업그레이드, Deno 재도입, 렌더러 교체를 한 작업으로 묶지 않는다.

```text
Nelyx/
├─ src/
│  ├─ foundation/              # 기존 코드 + notifier·key·collection 보조
│  ├─ ui/                      # 기존 frame/text/editing 계약 + geometry·input 계약
│  ├─ hosting/                 # 기존 AppSession/ViewRuntime·서비스 소유권
│  └─ framework/
│     ├─ scheduler/            # frame phase·ticker·post-frame
│     ├─ rendering/            # RenderObject·RenderBox·PipelineOwner·sliver
│     ├─ painting/             # Canvas facade·TextPainter·layer·decoration
│     ├─ widgets/              # Widget·Element·State·BuildOwner·기본 위젯
│     ├─ gestures/             # hit path·pointer routing·gesture arena
│     ├─ physics/              # simulation·scroll physics
│     ├─ animation/            # controller·curve·tween
│     ├─ semantics/            # 의미 트리 생성·action routing
│     ├─ material/             # 공통 기반 이후 선택한 Material 위젯
│     └─ cupertino/            # 공통 기반 이후 선택한 Cupertino 위젯
├─ sdk/src/                   # framework와 플랫폼 서비스를 연결하는 composition
├─ sdk/native/                # 실제 OS 입력·접근성·window·host 연결
├─ sdk/tooling/               # 기존 CLI·Metro·template
├─ skia/                      # 기존 renderer·text·GPU 자원·retirement
├─ eng/                       # 실제 build/prepare/pack 도구
└─ upstream/                  # 실제 채택 source의 pin·출처·license·symbol 매핑

tools/Nelyx.FrameworkToTypeScript/
                             # Bun/TypeScript 기반 독립 개발 도구

sample/nelyx-testbed-app/src/  # 공유 main()·Widget 화면·앱 상태
sample/nelyx-testbed-app/<platform>/runner/
                             # 플랫폼 등록·설정·native project
```

빈 폴더·placeholder API를 먼저 만들지 않는다. 코드가 생기는 단계에서 해당 경로와 package export만 추가한다. 내부 source는 `.ts` 직접 import, 배포 ESM/선언은 `.js` 경로를 유지한다. barrel/re-export 집계와 `any`로 미지원 의미를 숨기는 계층을 만들지 않는다.

반자동 도구의 유지할 소스는 저장소 루트의 `tools/Nelyx.FrameworkToTypeScript/`에 둔다. W4에서 제품 build·CLI를 `Nelyx/` 안으로 모은 책임 구분은 유지하고, 이번 사용자 요청에 따른 소스 이식 개발 도구를 `tools/`에 구성한다. 제거한 `tools/nelyx/` 검증 체계를 복원하지 않는다.

원본 revision/hash, 선택 symbol, TS 목적지, 변환 도구/규칙 revision과 필요한 port 매핑은 `Nelyx/upstream/framework-imports.json` 같은 **하나의 작은 이식 명세**로 관리한다. 이 파일은 실제 소스 갱신에 쓰는 입력·출처 기록이며 검증 receipt가 아니다. 도구의 분석·매핑 로직과 제품별 명세를 분리하고, 초안·상세 source map·AST/IR dump·미지원 상세 목록은 임시 작업 경로에 둔다.

### Bun 도구 프로젝트 구성

Doroti 변환기의 frontend·IR·lowering·backend·진단 분리를 참고하되, CLI·선택 처리·매핑·변환 orchestration·TS 출력·변경 비교는 Bun에서 실행하는 TypeScript로 작성한다. 다음은 단계 진행에 따라 채울 제안 구조다. 처음에는 `src/main.ts`와 첫 변환에 필요한 모듈만 만들고 빈 계층을 미리 만들지 않는다.

```text
tools/Nelyx.FrameworkToTypeScript/
├─ package.json                 # private: true, Bun scripts·도구 자체 의존성
├─ bun.lock                     # 도구 전용 의존성 고정
├─ tsconfig.json                # strict·noEmit·Bun 타입·.ts 직접 import
├─ README.md                    # 설치·입력 선택·초안·채택·변경 비교 사용법
└─ src/
   ├─ main.ts                   # 실제 CLI 진입점
   ├─ application/              # 선택·분석·초안·채택 흐름
   ├─ frontends/                # 채택한 C#/Dart 분석 adapter
   ├─ ir/                       # source span·symbol·type을 가진 최소 중간 표현
   ├─ lowering/                 # 필요한 의미 변환·재사용 규칙
   ├─ backend/typescript/       # TypeScript AST 구성·직접 import 출력
   ├─ mapping/                  # 원본·목적지·service port 연결
   ├─ adoption/                 # reviewed TS 반영·원본 갱신 diff
   └─ diagnostics/              # 미지원 의미·원본 위치·오류
```

- **실행·설치:** 자체 `package.json`과 `bun.lock`을 가진 private 도구로 구성한다. 최초 설치로 lock을 만든 뒤 추적하고, 재설치는 `bun install --frozen-lockfile`을 사용한다. Bun과 parser/emitter 의존성의 exact version은 구현 시 실제 조합을 확인해 고정한다. `bunfig.toml`은 필요한 설정이 생길 때 추가한다. [Bun install](https://bun.sh/docs/pm/cli/install)
- **의존성 경계:** 도구는 root npm workspace에 추가하지 않는다. 기존 root/SDK/runner의 npm·Node 구성과 `package-lock.json`은 유지하며, 도구 의존성은 도구의 package와 lock에서 관리한다. 도구 디렉터리에서 설치·실행했을 때 root workspace와 lock을 변경하지 않는지 확인한다. Bun의 workspace 지원 자체를 사용 금지하는 것이 아니라 이 도구를 독립 프로젝트로 구성하는 결정이다. [Bun workspaces](https://bun.sh/docs/pm/workspaces)
- **TS 실행·타입 확인:** Bun에서 `.ts` source를 실행하고 자체 `check:types` script는 고정된 TypeScript의 `tsc --noEmit`을 사용한다. Bun 타입은 도구의 `@types/bun`으로 제공하고 source는 `.ts` 직접 import한다. Bun 실행 성공, 도구 typecheck, 생성된 SDK의 ESM/선언 확인을 각각 수행한다. [Bun TypeScript](https://bun.sh/docs/runtime/typescript)
- **언어 분석:** Bun은 도구 runtime·패키지 관리·CLI orchestration을 맡고, C#/Dart 의미 분석은 frontend가 맡는다. Roslyn·Dart analyzer·ApolloVM을 채택하면 필요한 helper만 명시적 subprocess adapter로 연결하고 JSON 기반의 작은 입력/출력 계약을 정한다. 해당 helper의 .NET/Dart 요구 사항은 도구 README에 명시한다. 도구 전체를 .NET 앱으로 바꾸거나 Doroti UI/runtime 프로젝트를 참조하지 않는다.
- **출력·배포:** `src/main.ts`는 CLI이며 barrel이 아니다. tool source·Bun 타입·helper가 SDK export·앱 bundle·CLI template에 포함되지 않게 한다. source 진단용 map은 임시 출력에 두고, 채택한 TS의 일반 JS/선언·source map은 기존 제품 build가 만든다. Bun 단일 실행 파일 배포나 공개 npm package는 초기 필수 범위가 아니다.

아래는 **W5-01에서 구현할 명령 형태의 예시**다. 아직 존재하는 도구 명령으로 안내하지 않는다. `draft`는 CLI의 초안 생성 subcommand, `check:types`는 도구 자체의 타입을 확인하는 package script로 둔다.

```powershell
Set-Location tools/Nelyx.FrameworkToTypeScript
bun install --frozen-lockfile
bun run check:types
bun run ./src/main.ts draft --selection ../../Nelyx/upstream/framework-imports.json --output ../../.tmp/work5/import
```

처음에는 source 선택과 `draft`부터 구현하고, 실제 채택·upstream 갱신이 필요해지는 단계에서 반영·변경 비교 명령을 추가한다. 매번 모든 frontend·명령·프로젝트 계층을 한꺼번에 만들지 않는다.

```text
공유 TS 앱의 Widget tree
        ↓
View별 BuildOwner → Element/State
        ↓
PipelineOwner → RenderObject → layout / paint / semantics
        ↓
불변 PaintFrame + ResourceLease
        ↓
기존 SDK 플랫폼 adapter → Skia renderer → native GPU / Web canvas

OS 입력·IME·접근성 ↔ SDK 서비스 port ↔ View별 입력·focus·semantics owner
```

- **AppSession:** 앱 공통 서비스·자산 저장소와 종료를 소유한다. 여러 View의 트리·focus·scroll 상태를 하나로 합치지 않는다.
- **ViewRuntime/framework root:** BuildOwner, PipelineOwner, scheduler 상태, focus·gesture·semantics와 controller를 View별로 소유한다. 한 View를 닫아도 다른 View의 상태가 살아 있어야 한다.
- **SDK:** View에 text/input/clock/clipboard/semantics capability를 주입하고, native 등록·해제·close/loss 연결을 담당한다. 공통 framework에 RN·DOM·OS 타입을 넣지 않는다.
- **Skia:** paint 명령 재생과 native 자원/GPU 수명을 담당한다. Widget·navigation·앱 정책을 역참조하지 않는다.
- **React/RN:** 현재 surface·OS control 연결을 유지한다. Nelyx Widget 트리의 reconciliation과 layout은 Nelyx가 소유한다. 두 시스템이 같은 자식 UI 트리의 상태·layout을 동시에 소유하게 하지 않는다.

## 4. 먼저 고정할 의미와 구현 경계

### 트리·상태·프레임

- Widget은 불변 설정, Element는 지속 identity와 BuildContext, State는 mutable UI 상태, RenderObject는 layout·paint·hit test를 담당한다.
- TS generic은 runtime에서 지워지므로 key·widget type을 class 이름 문자열에 의존시키지 않는다. 안정된 type token과 명시적 key equality 정책을 정한다. 같은 타입·key의 갱신에서 Element/State를 유지한다. Flutter의 `canUpdate`가 비교하는 의미를 참조한다. [Widget.canUpdate](https://api.flutter.dev/flutter/widgets/Widget/canUpdate.html)
- dirty build는 부모부터, layout·paint dirty는 해당 경계부터 처리한다. build 중 재진입, dispose 후 setState, 중복 key, 잘못된 parent data를 실제 제품 오류로 진단한다.
- 기존 `requestFrame()`은 현재 호출 즉시 scene을 생성한다. W5에서는 invalidate를 모으고 host frame tick에서 `build → layout → paint → semantics`를 수행하도록 연결한다. busy 제출 재시도는 완성된 frame을 재사용하며 build를 반복하지 않는다.
- `Clock.now()`와 host FrameClock을 조합해 monotonic timestamp를 제공한다. framework마다 별도 `requestAnimationFrame` loop를 추가하지 않는다. post-frame callback, ticker 취소와 close 이후 callback 차단을 포함한다.
- Element 삭제와 GPU 자원 해제를 분리한다. paragraph/image를 tree가 놓아도 제출된 frame의 lease는 retirement/drain까지 유효해야 한다. pending snapshot 교체와 native가 인수한 recording의 폐기를 혼동하지 않는다.
- viewport·renderer·native context·surface 세대를 유지한다. 새 metrics는 View의 layout도 무효화하며 이전 세대의 frame을 제출하지 않는다.

### 렌더링·텍스트·입력

- 최소 RenderBox부터 시작한다. constraints는 bounded/unbounded 축을 표현할 수 있어야 하고, 최종 size·PaintFrame은 유효한 유한 좌표여야 한다. 기존 `Rect`와 별개로 호환되지 않는 geometry 체계를 중복 생성하지 않는다.
- 먼저 기존 rect/rrect/paragraph/image·clip·2D transform으로 가능한 화면을 만든다. path·stroke·opacity·saveLayer·shadow·filter·4×4 transform은 소비 위젯에 필요할 때 core 계약과 RN/Web·대응 native 재생 경로를 함께 확장한다. resource 열거·frame byte budget·ABI/직렬화·patch/생성본도 같은 변경에 맞춘다. 미지원 연산을 조용히 생략하지 않는다.
- RenderParagraph는 실제 TextLayoutService 결과로 크기·baseline·overflow를 정하고 **그 paragraph를 그대로 그린다.** 문자열 길이 추정으로 layout하지 않는다. 캐시 key에는 font/resource 세대·width·locale·direction·scale·style을 포함하고 eviction과 lease 반환을 구현한다.
- pointer 계약에는 id, device 종류, buttons, 좌표, timestamp, wheel/pan 신호, cancel을 포함한다. logical/physical 좌표·transform·clip을 맞춰 hit path를 계산한다. native editor 위에 그려진 위젯이 입력을 중복 수신하지 않게 한다.
- 첫 화면의 버튼 hit test부터 공통 트리로 처리한다. 편집기는 초기에는 native control bridge를 재사용하되 위치·focus·수명은 framework 결과에 연결한다. 기존 editor 하나 제한과 composing 미관측을 먼저 해소해야 여러 TextField와 완전한 IME를 제공할 수 있다.
- semantics는 공통 트리에서 생성하고 플랫폼에 bounds·role·state·action을 전달한다. Skia로 보이는 버튼에 대응하는 native/DOM semantics를 제공한다. DOM/RN control과 중복으로 읽히거나 activate가 두 번 발생하지 않게 한다.

### 이식 코드·갱신 정책

- 최초 범위는 Flutter 방식의 선택한 API·동작이다. Dart 앱·pub package의 직접 실행 호환성을 W5 완료 조건으로 넣지 않는다.
- reviewed TS 제품 source를 최종 편집 원본으로 삼는다. generator는 별도 임시 경로에 초안을 쓰고 기존 제품 파일을 덮어쓰지 않는다. 채택 시 원본 symbol·hash·규칙 revision·TS 목적지를 작은 이식 명세에 남긴다.
- 수동 수정은 reviewed TS 자체에 유지한다. 반복되는 수정은 도구 규칙이나 명시적 service port 매핑으로 올린다. 전체 generated-base/manual-snapshot/effective 트리 또는 수정 내용을 복제한 patch 계층을 추가하지 않는다.
- 가져온 파일에는 실제 source revision/path와 변경 요점을 남긴다. Nelyx 작성 코드는 BSD-3-Clause, Flutter/Doroti 유래 코드와 ApolloVM을 실제 재배포할 경우에는 각각 원래 license/notice를 보존한다.
- local `reference/flutter-master`에는 `.git`이 없었다. 디렉터리 이름이나 Doroti header의 `56b8e1a8`만으로 현재 snapshot revision을 확정하지 않는다. 실제 이식 전에 exact commit과 선택 파일 hash를 확보한다.
- upstream 변경은 채택한 파일·symbol만 반자동 비교한다. 이전 원본·도구 revision으로 변환 기준을 재구성하고 현재 reviewed TS의 수정과 대조한다. 매번 전체 master를 재생성하거나 전체 qualification을 실행하지 않는다.

## 5. 단계별 작업

모든 이식 단계는 **선택·자동 분석/초안 → 의미 검토·수정/연결 → 해당 변경 확인 → reviewed TS 채택·규칙 반영 → 임시 검증 구성 정리·짧은 기록**으로 마친다. 처음 만든 작은 도구를 단계마다 사용·확장한다. 도구 자체의 구현이 필요한 기능 이식을 오래 막으면 해당 symbol만 보완하고 다음 묶음을 진행한다. 각 단계의 임시 확인 파일·설정·dependency 정리는 6절을 따른다.

### W5-00 — 착수 기준과 이식 범위 확정

- [x] 구현 시점의 diff·W4 완료 기록·README·현행 source를 다시 확인하고 사용자 변경을 보존한다. 삭제된 W1~W3 checkpoint를 진행 전제로 삼지 않는다.
- [x] 최초 화면에 필요한 symbol과 의존성을 선정한다. 기본값은 notifier/key, scheduler, box layout, Widget/Element/State, text, tap이다.
- [x] 각 symbol의 primary input을 Doroti 제품 C# 또는 Flutter Dart 중 하나로 정하고 TS 목적지·기존 service port·자동 변환/직접 보완 범위를 작은 이식 명세에 기록한다.
- [x] Flutter/Doroti source의 정확한 revision·license·선택 파일 hash를 확보한다. 오래된 compiler README의 경로·명령은 존재 여부를 재확인한다.
- [x] `ApplicationDefinition.createScene()`, startup, `ViewRuntime.requestFrame()`, SDK bootstrap의 실제 연결 위치를 확정한다. tree factory와 view별 서비스 주입을 별도로 설계한다.

완료 기준: 첫 Widget 화면까지 필요한 symbol과 반자동 이식 묶음·목적지·host 연결이 정해진다. 전체 transpiler의 완성은 선행 조건이 아니다.

### W5-01 — 첫 반자동 이식 도구와 도구 선택

- [x] `tools/Nelyx.FrameworkToTypeScript/`에 private Bun/TypeScript 프로젝트, `src/main.ts`, 자체 `package.json`·`bun.lock`·strict tsconfig·README를 만든다. root npm workspace에 추가하지 않고 독립 설치·타입 확인·실행을 연결한다.
- [x] 후보 비교의 초기 탐색 예산은 **2~3 개발일 이내**를 기본으로 잡고, 이후에도 구현에 필요한 도구를 단계마다 개발한다. 일정 보장이 아니며 처음부터 모든 언어 기능을 완성하지 않는다.
- [x] 다음 네 부류를 Flutter Dart 원본·Doroti C#·검토된 TS의 의미 비교 대상으로 고른다: spring/tolerance 수치 로직, ChangeNotifier의 재진입·해제, constraints/geometry, key·상속·mixin·생성자 의미를 포함한 작은 트리 사례. 첫 초안 생성·채택은 가장 작은 묶음부터 끝낸다.
- [x] Roslyn 기반 C# 입력, ApolloVM의 고정 snapshot, 필요한 경우 Doroti analyzer/IR 재사용을 대표 symbol로 비교한다. 실제 추출·의존성·TS lowering·수동 보완 비용을 기록하고 첫 frontend/emitter 경로 하나를 선택한다. 실행하지 못한 후보는 `notVerified`로 남긴다.
- [x] 선택한 source·symbol·목적지 명세를 읽고 필요한 의존성을 추출하는 최소 Bun CLI를 `tools/Nelyx.FrameworkToTypeScript/`에 만든다. source 위치·hash·규칙 revision과 직접 import를 유지한다. 분석 helper가 필요하면 도구 소유 adapter로 연결한다.
- [x] 지원하는 타입·선언·method body를 TS 초안으로 생성하고, 미지원 구문·의미·native 의존성을 위치와 함께 보고한다. 전체 Material·Flutter SDK·Doroti Runtime을 자동으로 끌어오지 않는다. 정규식 기반 소스 구조 변환을 하지 않는다.
- [x] 담당자가 TS 초안의 의미·port 경계를 수정하고 제품 소스로 채택하는 첫 사이클을 완료한다. 초안과 제품 출력 경로를 구분하고 기존 reviewed TS의 자동 덮어쓰기를 막는다.
- [x] parse 성공, TS typecheck, 실행 결과, 값/identity·callback 순서·예외·dispose 동작을 각각 확인한다. 실제 생성 TS를 JS로 emit하고 ESM과 기존 Metro/Hermes 경로에서 소비할 수 있는지도 구분한다.
- [x] 도구 디렉터리에서 Bun의 고정 lock 설치·자체 typecheck·초안 생성을 확인하고 root npm lock/workspace에 변경이 없는지 확인한다. 제품 build·소비 앱이 Bun이나 분석 helper를 요구하지 않는지도 구분한다.
- [x] Dart/C#의 integer 나눗셈·나머지·동등성, named/default parameter, runtime type·generic, Future/microtask·listener 재진입 의미를 TS에 어떻게 보존할지 확인한다. 정규식 치환과 syntax 출력만으로 의미 보존을 판정하지 않는다.
- [x] `~/`, Dart package URI, .NET namespace·runtime helper, 잘못된 `.ts/.js` 선언 import, barrel, blanket `any`, silent stub이 출력에 남지 않는지 확인한다.
- [x] 선택한 도구·규칙·작은 이식 명세·사용법을 남기고, 후보별 결론·수정 비용·미지원 범위를 이 문서에 짧게 기록한다. 탈락한 prototype·생성 초안·임시 검증 파일·실험 의존성만 정리하고 W5-02로 진행한다.

완료 기준: `tools/Nelyx.FrameworkToTypeScript/`의 Bun CLI로 작은 실제 source 묶음의 **분석 → TS 초안 → 검토·수정 → 확인 → 채택**을 반복할 수 있다. 자동 생성의 범위와 직접 보완한 범위를 구분한다. 생성/검토/수정 비용이 큰 기능은 자동화 범위를 줄이고, 반복되는 변환을 다음 단계에서 도구에 추가한다. **선택하지 않은 compiler/VM은 정리하고, 채택한 개발용 도구와 규칙·Bun package/lock은 유지한다.** 일반 npm runtime dependency에 변환기를 넣지 않는다.

### W5-02 — foundation·scheduler·View 연결

- [x] key·Listenable/ChangeNotifier/ValueNotifier 후보를 반자동으로 이식하고 equality·type token·재진입·error reporting 의미를 검토·보완한다. property/constructor·callback 매핑의 반복 수정을 도구에 반영한다. .NET/Dart runtime 전체를 복제하지 않는다.
- [x] host clock 기반 frame phase·dirty 예약·post-frame·visibility·cancel을 구현한다. 애니메이션 시간 단위와 frame timestamp를 명시한다.
- [x] View별 framework controller/root factory와 서비스 주입을 기존 AppSession/ViewRuntime에 연결한다. 공유 session에 Element/State를 보관하지 않는다.
- [x] `requestFrame`의 invalidation과 snapshot 생성·submit을 나눈다. `busy`/stale/zero-size·미확정 제출과 기존 lease ownership을 보존한다.
- [x] 기존 PaintCommand 앱 경로는 전환 기간에 동작하게 하고, Widget 경로의 factory/종료 계약을 명시한다. app startup cleanup과 tree teardown이 GPU drain보다 자원을 먼저 파괴하지 않게 한다.

확인·완료 기준: 같은 tick의 여러 변경이 한 번의 build 예약으로 모이고, close 이후 tick이 트리나 renderer를 사용하지 않는다. 서로 다른 두 View의 예약·종료가 분리된다.

### W5-03 — RenderObject·최소 layout·painting·text

- [x] PipelineOwner, RenderObject/RenderBox와 constraints/layout 계산을 반자동으로 이식한다. parent data·attach/detach, dirty propagation과 RenderView를 기존 host에 연결하고 반복되는 타입·collection·method 변환 규칙을 추가한다.
- [x] BoxConstraints, Size/Offset/Rect 보조, RenderPadding/ConstrainedBox/Flex/Stack, align·clip·2D transform을 구현한다.
- [x] PaintingContext/Canvas facade를 기존 PaintCommand에 연결한다. 임의의 Skia/native handle이 Element나 PaintFrame으로 새지 않게 한다.
- [x] TextPainter·RenderParagraph를 기존 text service에 연결한다. text/style/width 변경 시 cache를 무효화하고 paragraph/font/image의 실제 자원 수명을 연결한다.
- [x] intrinsic/baseline·overflow·unbounded flex 등 최초 지원 의미와 오류 조건을 명시한다. 이후 repaint boundary/layer 확장 지점을 확보한다.

확인·완료 기준: padding·flex·text·clip이 constraints와 resize에 따라 맞게 배치된다. 한글/RTL/emoji의 측정·paint가 같은 paragraph를 쓰고, 교체·닫기 이후 불필요한 paragraph가 누적되지 않는다.

### W5-04 — Widget·Element·State와 기본 위젯

- [x] Widget, BuildContext/Element, Stateless/StatefulWidget, State와 BuildOwner를 반자동으로 이식한다. 상속·generic·virtual dispatch와 상태 수명 의미를 검토·보완하고 재사용 가능한 규칙을 도구에 반영한다.
- [x] mount/update/rebuild/deactivate/unmount, keyed children 갱신, State lifecycle과 InheritedWidget dependency 갱신을 구현한다. GlobalKey의 reparent 의미를 축소하면 지원 범위를 명시한다.
- [x] RenderObjectWidget의 create/update/dispose를 연결하고 Text, SizedBox, Padding, Align, Row/Column/Flex, Stack, DecoratedBox, Clip/Transform, Image를 필요한 순서로 제공한다.
- [x] 중복 key·dispose 후 setState·reentrant build·잘못된 render child 연결을 source/context가 있는 제품 오류로 보고한다.

확인·완료 기준: 같은 타입/key의 상태가 rebuild·reorder에서 유지되고, 제거된 State는 한 번 dispose된다. inherited 값 변경이 해당 의존 분기를 갱신한다. Root 교체와 View 닫기가 Element/render tree를 해제한다.

### W5-05 — pointer·hit test·gesture와 기본 focus

- [x] SDK의 공통 pointer/keyboard port와 Web·Windows·Android adapter를 연결한다. capture·cancel·hover·wheel과 좌표/세대 변환을 포함한다.
- [x] pointer router·gesture arena·tap/drag recognizer를 반자동으로 이식하고 native 입력 port를 직접 연결한다. RenderObject hit test를 paint transform·clip과 일치시키며 반복되는 event·callback 매핑을 도구에 반영한다.
- [x] GestureDetector/Listener, focus의 기본 소유권과 키보드 activate를 연결한다. 터치 drag·스크롤·버튼 tap의 승자 결정과 취소를 정의한다.
- [x] 공통 버튼의 pointer와 semantic activate가 같은 앱 action을 호출하게 한다. OS control overlay와 pointer 소유권을 조율한다.

확인·완료 기준: 변환·clip된 버튼의 보이는 영역과 hit 영역이 일치하고, drag 후 잘못된 tap이 발생하지 않는다. focus 이동·cancel·View 닫기 후 늦은 입력이 이전 State에 전달되지 않는다.

### W5-06 — 첫 공통 Widget 화면과 P0 완료

- [x] sample의 첫 화면을 StatefulWidget·Row/Column·Text·Image·버튼으로 교체한다. 앱이 수동 좌표 계산이나 직접 PaintCommand로 기본 UI를 작성하지 않게 한다.
- [x] platform runner는 surface 등록·옵션·host 연결을 담당하고, 앱 상태·layout·action을 `src/`에 유지한다. 기존 실제 editor 사용 흐름은 bridge와 함께 보존한다.
- [x] Web와 Windows에서 표시·입력·resize·정상 종료를 확인한다. Android는 사용 가능한 emulator에서 같은 공유 화면을 확인하고 물리 기기 결과와 구분한다. 실제 Chrome/AMD WebGL2와 Windows native surface·WM_CLOSE exit 0, Android Pixel_5 화면·입력으로 확인했으며 자동화 입력과 물리/한국어 IME 수락을 구분한다.
- [x] 변경된 core/SDK의 typecheck·build와 해당 runner bundle을 확인한다. 삭제한 W4 테스트 체계나 broad `npm run check`를 복원하지 않는다.
- [x] 이 단계의 임시 확인 구성을 정리하고 아래 진행표에 범위별 결과를 기록한다.

**P0 완료 기준:** Nelyx의 공통 UI 트리가 실제 surface에 연결되어 상태 변경부터 layout·paint·hit test까지 동작한다. renderer/host가 준비됐다는 상태에서 공통 프레임워크가 작동하는 상태로 넘어가는 첫 관문이다. TextField·전체 플랫폼 qualification은 별도다.

### W5-07 — animation·scroll·가상화

- [x] Ticker, AnimationController, Tween/Curve, simulation을 반자동으로 이식하고 host visibility·TickerMode·dispose와 연결한다. 필요한 수치·collection·async 의미의 보완을 규칙으로 추가한다.
- [x] ScrollController/Position/Activity/Physics, drag·wheel·fling·overscroll과 viewport를 구현한다.
- [x] sliver 기반 lazy list·cache extent·keep-alive·scroll offset 보존과 재배치를 구현한다. 모든 list item을 먼저 build하는 구현을 가상화로 기록하지 않는다.
- [x] repaint boundary와 layer의 수명·재사용을 도입한다. GPU resource cache의 항목·메모리 상한과 eviction을 실제 제품 코드로 관리한다.

확인·완료 기준: 긴 목록의 build/layout 범위가 viewport와 cache 범위에 제한되고, 사라진 ticker·item·layer가 남지 않는다. resize·목록 변경·View 종료에서 scroll/animation이 올바르게 중단·복원된다. 측정한 CPU/GPU 시간과 실제 scanout/FPS를 구분한다.

### W5-08 — focus·편집·IME·semantics 확장

- [x] FocusNode/Scope, traversal, Actions/Shortcuts, clipboard·selection·text input action을 구현한다.
- [x] TextEditingController/EditableText의 공통 로직을 반자동으로 이식하고 native editor session을 직접 연결한다. editor 하나 제한을 surface 내부의 focus 대상 session 관리로 바꾸고, 여러 TextField의 교체·blur·remount를 다룬다.
- [x] UTF-16 offset·grapheme·selection 방향·composing revision, programmatic replace와 native event의 순서를 유지한다. native bridge가 관측하지 못하는 composing을 `none`으로 위장하지 않는다. grapheme 단위 사용자 편집은 native editor에 맡기며 별도 TS segmentation API는 제공하지 않는다. 아래 플랫폼별 관측 한계와 실제 IME 수락은 별도다.
- [x] caret·selection geometry, scroll-to-caret·IME candidate 위치·keyboard inset을 layout 결과와 연결한다. 기능별 native 지원이 필요하면 SDK/native port에서 구현한다. Android 관측 geometry/insets와 native caret reveal을 구현하고, 지원하지 않는 port는 `unavailable`로 표현한다. 후보창 배치·선택 편집은 실제 native control이 소유한다.
- [x] role/state/value/children·focus·scroll/action을 가진 semantics tree를 제공하고 플랫폼 bridge를 연결한다. hide/merge/exclude·bounds 변경·닫기 시 삭제를 포함한다.

확인·완료 기준: 여러 입력 필드의 focus·선택·붙여넣기·조합·종료가 분리되고, 공통 위젯이 플랫폼 semantics에 대응한다. 한국어 실제 IME와 TalkBack/Narrator/VoiceOver는 가능한 target에서 따로 확인하며, 합성 문자열 주입과 semantics 객체 생성만으로 PASS 처리하지 않는다.

### W5-09 — 앱 시스템과 Material·Cupertino

- [x] Overlay·Navigator/Route의 push/pop 결과·Back·dialog/focus 복원을 구현한다. route/overlay 전환과 controller·resource·semantics 수명을 연결한다.
- [x] MediaQuery·Directionality·Theme·Localizations·text scale·safe area·keyboard inset을 공통 inherited 데이터로 제공한다. 초기 locale·fallback·문자열 선택을 정한다.
- [x] 공통 기반을 쓰는 Material의 theme/text/button/scaffold/text field/dialog/list를 먼저 반자동 이식한다. 이후 Cupertino의 theme/button/navigation/text field/dialog/list를 대응시킨다. 반복되는 constructor·style·widget 조합 변환을 도구에 추가하고 실제 layout·gesture·편집 의미를 검토한다.
- [x] design widget이 자체 pointer·layout·editing 시스템을 다시 만들지 않게 한다. icon/font/license·asset 준비를 기존 공급 경로에 연결한다.
- [x] state restoration·deep link는 초기 navigator 이후 범위로 따로 명시한다. 선택하지 않은 Flutter widget을 빈 stub이나 native control 이름 alias로 지원 목록에 올리지 않는다.

확인·완료 기준: sample에서 목록→상세→dialog→입력의 흐름이 공통 코드로 구성되고, Back·focus·theme/locale 변경과 자원 정리가 이어진다. Material/Cupertino의 완료는 선정한 위젯 목록과 동작 범위로 한정한다.

### W5-10 — 개발 흐름·template·소비 API 완성

- [x] 공유 `src/index.ts`의 `main()`이 Widget 앱을 만들고 플랫폼 API가 붙이는 경로를 sample/template에 반영한다. 생성 앱에 SDK 구현·실험 스크립트를 복사하지 않는다.
- [x] 직접 module export·타입·source map·README 예제를 정리하고 설치한 CLI package만으로 앱을 생성할 수 있게 한다.
- [x] `tools/Nelyx.FrameworkToTypeScript/README.md`에 Bun 설치·고정 lock·선택 입력·초안 생성·의미 검토·채택·필요 시 upstream 변경 비교 사용법을 정리한다. 앱 소비자가 Bun·이 도구·분석 helper나 DorotiLab checkout을 요구하지 않는지 확인한다.
- [x] Metro가 공유 src 변경을 감지해 갱신 delta와 새 bundle을 전달하는지 확인한다. 설치된 package만 사용하는 임시 Web 소비 앱의 실제 watch/HMR protocol로 확인했다.
- [x] framework root remount·이전 owner의 dispose/drain을 실제 host에서 확인한다. Web의 실제 Metro/React Refresh 수정·복원마다 새 State/editor/canvas와 이전 WebGL context 해제·font 수 유지로 확인했다. React Fast Refresh가 Nelyx State를 자동 보존한다고 안내하지 않는다. native full reload는 아래 기존 qualification 범위를 유지한다.
- [x] state-preserving reassemble은 type/key·State shape·controller·native lease 호환성이 확인된 범위에만 도입한다. 불가능하면 명시적 root remount/프로세스 재시작을 사용한다.
- [x] stock RNW full reload·private unload supplier 문제는 기존 미해결 항목으로 유지하고, framework reassemble 성공을 native Core reload 성공으로 확대하지 않는다.
- [x] 개발자용 build/layout 오류 정보와 tree 확인은 실제 제품 기능으로 필요한 최소 범위만 구현한다. 별도 inspector 앱·검증 dashboard는 후속 범위다.

확인·완료 기준: 템플릿 앱이 저장소 private source 없이 동일 API로 생성·build된다. 지원하는 remount/reassemble의 상태 유지·dispose 범위가 문서와 일치한다.

### W5-11 — 외부 소비 확인·최종 정리·인계

- [x] 임시 외부 앱 하나로 packed core/SDK/Skia/CLI의 export·선언·asset·license·template 포함을 확인한다. 첫 화면 또는 새 기능에 필요한 target만 실행하며 6-target 소비 harness를 다시 만들지 않는다.
- [x] 실제 수행한 플랫폼·build mode·engine/provider·입력 방식과 실패·미수행 항목을 이 문서에 기록한다.
- [x] 6절 기준으로 임시 source·dependency·native flag·JSI/global hook·generated 복사본·스크립트·raw 결과를 정리한다. 제품 build input·license·실제 기능 소스는 보존한다.
- [x] 채택한 이식 도구·변환 규칙·source/symbol 매핑은 유지한다. 실제 첫 upstream 갱신이 있었다면 reviewed TS의 수동 수정을 보존하는 변경 비교를 확인하고, 없었다면 해당 기능의 확인 상태를 구분한다.
- [x] 정리 후 정상 제품 build/typecheck 및 영향을 받은 대표 흐름을 한 번 확인한다. 삭제된 검증 코드가 prepare/patch/template 생성으로 복원되지 않는지 확인한다.
- [x] root와 package README에 현재 Widget API·사용법·실제 제약만 반영하고, 남은 기능 작업·qualification 범위를 이 문서에 인계한다.

완료 기준: 공통 framework·선정 위젯·앱 개발 경로가 구현되고, 그 기능을 검증하기 위한 임시 운영 체계는 남지 않는다. 미확인 target·물리 입력·서명·성능이 남으면 해당 수락 상태는 `PARTIAL/notVerified`다.

## 6. 검증 비대화를 방지하는 운영·정리 기준

W4의 검증 전용 구성 제거 결정을 유지한다. **기능의 정확성은 확인하고, 기능 확인을 위해 만든 임시 체계는 단계 종료 때 제거한다.** 결과 기록을 위해 새로운 docs/validation·report/index/checkpoint 체계를 만들지 않는다.

현행 공통 제품 확인 명령은 `npm.cmd run check:types`와 `npm.cmd run build:sdk`다. CLI·Metro를 바꿀 때는 각각 `check:cli-types`, `check:metro-types`를 추가하고, native/bundle 명령은 해당 runner README의 현재 명령을 사용한다. 이름이 같은 과거 `npm run check` 체계나 삭제된 validator를 실행 조건으로 되살리지 않는다.

반자동 도구를 변경할 때는 `tools/Nelyx.FrameworkToTypeScript/`에서 자체 `bun run check:types`와 필요한 실제 선택 소스의 초안 생성을 확인한다. 이것을 SDK의 npm 검사 사슬에 합치지 않는다. 임시 의미 확인에는 필요한 경우 Bun의 실행·assertion 기능을 쓰되 영구 검증 workspace·receipt 수집 체계를 추가하지 않는다.

| 구분 | 보존 | 정리 |
| --- | --- | --- |
| 제품 동작 | frame/resource 수명·ABI/cohort/hash·budget·generation·GPU drain·실제 오류 cleanup | 시험만을 위한 실패 주입·강제 pause·synthetic capability·public test API |
| 개발·빌드 | 기존 compiler typecheck·build/prepare/bundle/pack, 실제 사용자용 오류 정보 | 회차별 audit/receipt 수집·baseline promotion·중복 validator·검증 dashboard |
| 예제·소비 앱 | 사용자에게 필요한 Widget 화면·정상 입력/scroll/navigation 예제 | PASS 버튼·global probe bridge·fixture 화면·외부 소비 harness |
| 이식 도구 | `tools/Nelyx.FrameworkToTypeScript/`의 Bun/TS source·package/lock·변환 규칙·최소 사용법·source/symbol/port 매핑·출처·license | 탈락한 frontend/emitter prototype·덤프·실험 전용 SDK/종속성·생성 초안 복제 |
| 기록 | 이 문서의 짧은 결과·명령·제약, README 사용법, 실제 채택 source pin/notice | raw log/screenshot/trace·JSON receipt·중복 summary·검증용 manifest |

1. **유지할 도구와 임시 소유 경로를 구분한다.** 이식 도구·규칙·Bun package/lock은 `tools/Nelyx.FrameworkToTypeScript/`, 초안·검증 출력은 기존 ignore의 `.tmp/work5/<stage>/` 등에 둔다. 필요하면 외부 임시 앱을 하나 만든다. 별도 test workspace·공용 검증 package를 추가하지 않는다.
2. **변경별 확인을 수행한다.** 순수 로직은 작은 임시 assertion·fake clock으로 값/순서/해제를 확인하고, UI는 실제 sample과 필요한 target으로 확인한다. assertion은 구현을 그대로 반복하지 않고 key reorder·stale generation·편집 revision 같은 관찰 가능한 의미를 확인한다.
3. **범위를 제한한다.** typecheck·해당 package build·대표 흐름이 통과하면 같은 검사를 계속 반복하지 않는다. 반복 lifecycle은 보통 30회 이내, 사용·문제 재현에 필요한 경우에만 확대한다. 실행에는 시간 제한을 두며 Doroti 도구의 테스트를 실행하면 그 저장소 지침의 20분 timeout을 따른다.
4. **삭제 전에 요점을 남긴다.** source revision, 실제 실행 명령·환경, 기대/관찰 결과, 오류와 미수행 범위를 아래 표에 짧게 기록한다. 원시 결과를 삭제한 뒤에도 파일이 남아 있다고 안내하지 않는다. 재현에 꼭 필요한 입력은 작은 값·절차로 문서화한다.
5. **검증 전용 분기를 제품에서 제거한다.** TS/public type, native export·JSI 등록·CMake flag, patch·generator, template, emitted JS/선언·tarball까지 함께 정리한다. 반자동 도구도 임시 test hook을 다시 출력하지 않게 한다. 재사용하는 분석·변환·매핑 기능은 보존한다. `__DEV__`·숨은 flag로 옮기는 것으로 마무리하지 않는다.
6. **명시적 목록으로 정리한다.** 해당 단계에서 만든 파일·설정·dependency·임시 앱만 preview하고 확정 목록을 사용한다. 실행형 정리 도구를 쓰면 기본 preview와 명시적 `-Execute`, 절대 경로·workspace 경계·link 확인을 적용한다. 작업 중인 사용자 파일·다른 프로젝트·마지막 native 공급 입력을 삭제하지 않는다.
7. **정리된 제품을 확인한다.** 잔존 import/script/flag·생성 경로를 확인하고 정리로 영향받은 build와 대표 흐름을 다시 확인한다. 임시 emulator/server·포트 연결·외부 앱·정리 도구도 소유한 것만 종료·제거한다.

오류가 발견되면 원인·수정·재현 절차를 기록한 다음 다시 확인한다. 실패 원인을 지우고 다음 단계의 성공으로 덮어쓰지 않는다. 아직 조사가 필요한 임시 자료는 당장 삭제하지 않고 **이유·소유 경로·정리 조건**을 이 문서에 적되, 이를 제품 build의 입력으로 사용하지 않는다. 단계 종료 상태는 `PARTIAL`이며 조건이 해소되면 정리를 마친다.

이 방식은 자동 회귀 체계를 상시 보유하는 것보다 동일 버그의 재발을 빨리 발견하기 어렵다는 비용이 있다. 보완책은 안정된 핵심 계약·작은 실제 예제·문서화된 재현 절차다. 영구 regression suite 도입은 향후 정책 변경으로 다루며 W5에서 W4의 제거 결정을 조용히 되돌리지 않는다.

## 7. 우선순위·의존성과 완료 판정

| 순서 | 목표 | 선행 조건 |
| --- | --- | --- |
| P0: W5-00~06 | `tools/`의 최소 Bun 반자동 이식 도구와 실작동하는 Widget·Element·RenderObject 화면 | 기존 host/renderer. 지원하지 않는 symbol은 직접 보완하고 도구를 점진적으로 확장 |
| P1: W5-07~08 | animation·scroll·가상화, 여러 editor·focus·semantics | P0의 트리·frame·input 경계 |
| P1: W5-09~11 | 앱 시스템·선정 Material/Cupertino·template·소비·정리 | 공통 입력·scroll·편집 시스템 |
| 후속 확대 | 선택 위젯 확대, deep link/restoration, inspector, 이식 자동화 범위 확대, 추가 target 수락 | 해당 공통 기반과 실제 필요성 |

W5-00 → W5-01 → W5-02 → W5-03 → W5-04 → W5-05 → W5-06 순으로 최초 관문을 만든다. 이후 W5-07~11을 수행한다. 각 단계의 구현·확인·정리가 모두 끝나야 그 단계를 완료 처리한다. **W5-06의 P0 완료와 W5 전체 완료는 구분한다.**

전체 완료에는 실제 이식에 재사용한 도구·규칙·최소 매핑, 공통 트리, frame/layout/paint, key/state, pointer/gesture, 선정 animation/scroll, 여러 editor·focus·semantics, 선정 navigation/design widget, CLI/template 소비, 임시 구성 정리가 필요하다. 도구가 모든 Dart/C# 문법을 지원해야 하는 것은 아니다. 선택 widget 목록은 W5-09 착수 시 실제 범위로 확정해 결과와 함께 남긴다. 미구현 위젯을 목록에서 조용히 제외해 완료로 바꾸지 않는다.

플랫폼 수락은 코드 구현과 별도다. 우선 Web·Windows, Android emulator로 변경 기능을 확인한다. Linux는 현행 native compile 범위와 GPU 실행 제외 방침을 유지한다. Apple은 이 Windows 환경의 source 구성만으로 native build/runtime/Metal/signing을 입증하지 않는다. 물리 입력·한국어 IME·스크린 리더·scanout/FPS·서명·clean-machine acceptance는 실제 수행할 때만 PASS를 기록한다.

### 현재 진행표

| 범위 | 구현 | 확인 | 임시 구성 정리 | 남은 항목 |
| --- | --- | --- | --- | --- |
| W5-00~01 범위·최소 Bun 반자동 도구 | Roslyn/Bun, 24 symbol pin/분석, Tolerance 자동 초안 채택 | frozen lock·strict typecheck·실제 분석·출력 보호 PASS-scoped | 정리 완료 | 선택하지 않은 ApolloVM/Dart IR 실행 notVerified; 실제 upstream 갱신 없음 |
| W5-02~06 P0 공통 UI 트리 | View별 root·scheduler·Widget/Element/State·RenderBox·text·gesture·공유 sample | 타입·ESM build·WASM sample, 실제 Chrome/Windows 표시·입력·resize·종료와 Android emulator 공유 화면 PASS-scoped | 정리 완료 | 물리 입력·추가 target qualification notVerified |
| W5-07 animation·scroll | Ticker/controller/spring·TickerMode, ScrollPosition/Activity의 clamping physics, fixed extent lazy sliver·bounded keep-alive·repaint cache, bounded page viewport·nested wheel | hidden 시간·spring·item State/eviction·목록 범위/종료·경계 wheel 전달·resize clamp PASS-scoped | 정리 완료 | 물리 scroll/scanout/FPS notVerified |
| W5-08 focus·편집·semantics | FocusNode/Scope·Actions/Shortcuts·ID별 editor·Android native snapshots/geometry/insets·native caret reveal·semantics tree | revision/composing/selection/late event, native epoch reset·binding 교체·focused resize의 합성 확인 PASS-scoped | 정리 완료 | Windows composing/direction/geometry, 실제 한국어 IME·후보창·reader 수락 notVerified |
| W5-09~10 앱 시스템·개발 흐름 | Overlay/Navigator·inherited app data·선정 Material/Cupertino·sample/template·직접 public subpaths | 실제 Web/Windows/Android detail/dialog/Back·입력/focus 복원, Web edit→remount/이전 context 해제 PASS-scoped | 정리 완료 | native Fast Refresh/full reload 전체 수락·state-preserving reassemble notVerified/미지원 |
| W5-11 소비·정리·인계 | 설치된 CLI와 자체 공급 archive를 사용하는 외부 앱 하나 | packed 소비 typecheck/Web bundle·실제 Refresh, 최신 source 일치·49 exports·정리 후 build/types/Web build PASS-scoped | 정리 완료 | 플랫폼 qualification은 별도 |
| 플랫폼 qualification | Web·Windows·Android source/build와 실제 UI 자동화 | 위 P0·개별 UI flow의 scope만 PASS-scoped | 해당 없음 | 물리/한국어 IME·reader·scanout/FPS·production signing·clean machine은 notVerified |

결과 값은 `PASS`, `PARTIAL`, `FAIL`, `SKIPPED`, `notVerified`를 구분한다. 계획 작성·typecheck·bundle·emulator 입력·물리 기기·GPU retirement·화면 scanout은 각각 다른 증거다. W4의 구조 정리 완료나 Doroti의 기존 동작을 W5 전체 완료의 근거로 사용하지 않는다.

## 8. 구현 시 참조할 실제 소스

아래 Doroti 경로의 기준 root는 `C:\Users\parti\Labo\DorotiLab`이다. 확인한 파일을 시작점으로 필요한 의존성만 따라간다. 과거 migration/generated·validation 폴더가 현재도 존재한다고 가정하지 않는다.

| 주제 | Doroti 기준 소스 | Nelyx 적용 |
| --- | --- | --- |
| key·상태·트리 | `Doroti/src/Doroti.Framework.Foundation/key.cs`, `Doroti/src/Doroti.Framework.Widgets/framework.cs` | TS key/type identity·Element·State·BuildOwner |
| layout·paint | `Doroti/src/Doroti.Framework.Rendering/object.cs`, `box.cs`, `flex.cs` | PipelineOwner·RenderBox·constraints·paint bridge |
| scheduler·ticker | `Doroti/src/Doroti.Framework.Scheduler/binding.cs`, `ticker.cs` | host clock에 연결하는 View별 예약 |
| gesture | `Doroti/src/Doroti.Framework.Gestures/arena.cs`, `binding.cs` | pointer routing·arena·취소 |
| animation·scroll | `Doroti/src/Doroti.Framework.Physics/spring_simulation.cs`, `Doroti/src/Doroti.Framework.Widgets/scroll_position.cs`, `scrollable.cs`, `scroll_view.cs` | 순수 계산 선별 이식·scroll 수명 |
| focus·편집 | `Doroti/src/Doroti.Framework.Widgets/focus_manager.cs`, `editable_text.cs` | SDK input/IME port와 공통 위젯의 경계 |
| semantics | `Doroti/src/Doroti.Ui/SemanticsTreeSnapshot.cs`, `Doroti/src/Doroti.Framework.Semantics/semantics.cs` | 공통 snapshot·native action bridge |
| 앱 시스템·디자인 | `Doroti/src/Doroti.Framework.Widgets/navigator.cs`, `localizations.cs`, `packages/Doroti.Material/src/`, `packages/Doroti.Cupertino/src/` | 공통 시스템 위의 선정 위젯 |
| semantic compiler | `tools/Doroti.DartToCSharp/README.md`, `analyzer/pubspec.yaml`, `src/Core/Ir/`, `src/Core/Lowering/Flutter/FlutterBindingRegistry.cs` | 반자동 도구의 선택 frontend/IR·port 매핑 재사용 |

Flutter 원본은 Nelyx의 `reference/flutter-master/packages/flutter/lib/src/`에서 `widgets/framework.dart`, `rendering/object.dart`, `gestures/arena.dart`, `scheduler/binding.dart`, `physics/spring_simulation.dart`를 확인했다. exact revision은 W5-00에서 확보한다. 동작 판단에는 [Flutter architecture](https://docs.flutter.dev/resources/architectural-overview), [RenderObject API](https://api.flutter.dev/flutter/rendering/RenderObject-class.html), [Widget.canUpdate](https://api.flutter.dev/flutter/widgets/Widget/canUpdate.html)를 함께 참조한다.

현재 상태: **루트 `tools/Nelyx.FrameworkToTypeScript/`의 Bun/TypeScript 도구 / 반자동 분석·변환 + 의미 검토·수정·채택 / 재사용 도구·규칙·최소 매핑 유지 / 선정 기능 구현과 실제 Web·Windows·Android emulator 대표 검증 완료 / 최종 정리 완료·플랫폼 qualification PARTIAL**.

### 2026-10-11 실행 기록

- 착수 트리는 clean, Nelyx source 기준은 `c63106bff9d4aace353bac8b4a5394bf82a3cdd1`이다. W4 완료 기록·README·실제 bootstrap/createScene/ViewRuntime을 다시 읽었다. `.github/copilot-instructions.md`와 저장소별 `AGENTS.md`는 없다. Doroti의 현재 HEAD는 `d8d1e1796bcaf7be33361afdc0dc3b6cef627fea`이며 선택 source 경로의 working diff는 없다. Flutter의 revision 불명 reference는 직접 이식 입력으로 사용하지 않았다.
- `Nelyx/upstream/framework-imports.json`에 24개의 Doroti symbol·정확한 파일 SHA256·제품 목적지·수동 port 범위를 기록했다. Doroti/Flutter notices를 core의 배포 대상 `licenses/`에 보존했다. API는 선택한 동작의 TS adaptation이며 Flutter/Dart 앱 호환성이나 전체 위젯 parity를 뜻하지 않는다.
- 도구 선택: Roslyn syntax/semantic JSON → Bun TS lowering → TypeScript AST printer. 최초 자동 출력은 `Tolerance`의 numeric fields/get-only storage/default constructor이며 CLR ToString을 명시적으로 제외했다. 나머지는 분석된 AST/dependency를 보고 host 포트와 JS identity/콜백/수명을 직접 보완했다. 깊은 AST의 JSON 64-depth 오류를 실제 실행에서 발견해 512로 수정했다. ApolloVM과 Doroti resolved Dart IR는 실행 `notVerified`, 의존성/VM/prototype을 추가하지 않았다.
- 도구 명령: 도구 폴더에서 `bun install --frozen-lockfile`, `bun run check:types`, `bun run port ../../Nelyx/upstream/framework-imports.json C:/Users/parti/Labo/DorotiLab ../../.tmp/work5/all-ports`. Bun 1.4.3, TypeScript 5.9.3, .NET SDK의 Roslyn/.NET 10 targeting pack 조합. root npm workspace/lock 변경 없이 24 symbol 분석·초안 생성 PASS-scoped. 초안 자동 덮어쓰기와 제품 경로 출력은 금지한다.
- 제품 명령: `npm.cmd run check:types`, `npm.cmd run build:sdk`, Web 공급/설치 후 runner `check` 및 `build`가 PASS-scoped. 최신 source의 ESM/선언/map 및 타입 확인도 PASS-scoped다. broad `npm run check`나 제거된 W4 validator는 복원하지 않았다.
- 임시 `.tmp/work5/` assertion으로 notifier 재진입·key reorder/State identity·dirty 병합·busy snapshot 재사용·tap/drag 취소·dispose 후 setState 차단을 확인했다. 공유 sample은 실제 text API를 대체한 임시 service로 paragraph producer/lease 해제, viewport/cache 범위의 list, counter/theme/locale, detail/dialog/Back, 두 editor, resize/close를 확인했다. 이 확인은 실제 Skia shaping/GPU/화면 증거가 아니다. 상세의 Cupertino Back 버튼에서 unbounded Text 오류를 발견해 명시적 너비를 주고 재확인했다.
- 선정 Material: `MaterialApp`, `Scaffold`, `FilledButton`, `TextField`, `ListTile`, `AlertDialog`, `showDialog`. 선정 Cupertino: `CupertinoTheme`, `CupertinoButton`, `CupertinoNavigationBar`, `CupertinoPageScaffold`, `CupertinoTextField`, `CupertinoListTile`, `CupertinoAlertDialog`. 공통 Widget/layout/gesture/editor 위의 실제 조합이며 stock 디자인 사양·transition·모든 상태 parity는 후속 범위다.
- 현재 제약: GlobalKey reparent, intrinsic layout, flex baseline alignment, variable-height sliver, full Material/Cupertino, restoration/deep links, state-preserving reassemble은 제공하지 않는다. Text는 bounded width가 필요하고 지원 paint는 기존 rect/rrect/image/paragraph/clip/affine이다. lazy list는 명시적 viewport 높이와 고정 item extent를 사용한다. repaint cache는 boundary당 최대 4096 PaintCommand이며 GPU texture cache가 아니다.
- Android에는 SDK 소유 `NelyxTextInput`/Kotlin package와 native snapshot bridge를 추가했다. UTF-16 anchor/focus, composing span, focus, native revision을 한 snapshot으로 전달하고 native revision을 확인한 replace만 수락한다. 실제 native compile/runtime는 아래 최신 결과로 판단하며 합성 snapshot assertion을 실제 한국어 IME 성공으로 기록하지 않는다. Windows 및 다른 stock RN editor의 composing/direction/geometry, DOM composing range/geometry는 `unavailable`을 유지한다. Android의 native Layout geometry·inset 관측은 아래 추가 묶음에 구현했다. native editor가 실제 caret·selection·IME 후보·사용자 grapheme 편집을 소유한다.
- 브라우저 도구 inventory가 비어 있고 IAB 생성도 `Browser is not available: iab`으로 실패했다. 따라서 최신 Widget sample의 Web 표시/입력/resize는 `notVerified`다. 착수 시 adb 기기가 없어 기존 Pixel_5 AVD를 소유 emulator-5580으로 시작했다. 이후 나타난 사용자 물리 기기는 사용하지 않았다. Windows native 공급 입력은 현행 pin을 사용했다. Apple native build/runtime/signing과 Linux GPU 실행은 범위 밖/notVerified를 유지한다.
- 첫 묶음의 임시 자료 소유 경로는 `.tmp/work5/`와 이 작업에서 연 local HTTP server(8095)였다. 해당 assertion·초안·분석 출력·server는 첫 cleanup에서 정리했다. 추가 묶음은 아래 별도 정리 결과로 판단한다.
- 추가 확인: spring의 세 damping 경우 초기 위치/속도·수치 미분, hidden 시간 제외 animation, 독립 native editor revision·late event, observed composing/방향과 native ack 이전 비낙관적 상태, affine hit/clip/singular transform, immutable unique semantics tree가 임시 assertion PASS-scoped. Semantics는 text/image/group/list와 children·state/value·action·merge/exclude를 표현하고 DOM/native 컨트롤 트리에 연결한다. reader 수락과는 구분한다.
- Windows 최초 x64 Release native/Hermes build PASS-scoped. 이후 wheel bridge compile에서 WinRT Input 정의 header 누락(`C3779 GetCurrentPoint/Handled`)을 발견해 명시적 include 후 x64 Release/Hermes native build PASS-scoped를 확인했다. Android 첫 Release build는 GraalVM JDK 21 `JdkImageTransform/jlink`에서 FAIL; 설치된 Temurin 21.0.11로 process-local `JAVA_HOME`을 지정한 Release x86_64 Vulkan 빌드에서 SDK editor Kotlin compile을 포함해 PASS-scoped를 확인했다. APK 설치·cold start는 성공하고 startup/ReactNativeJS 로그에 fatal이 없었으나 표시/입력을 입증하지 않는다. 사용자/시스템 JDK 설정은 변경하지 않았다.
- 외부 소비는 Temp의 앱 하나를 설치된 CLI API로 생성했다. 첫 archive 선택에서 이전 공급물이 섞인 것을 발견해 현행 runner manifest의 정확한 archive reference로 교정하고 소비 앱 자체 supply로 복사했다. 교정 후 core/SDK/Skia/Metro/CLI install·runner typecheck·Web static bundle PASS-scoped. core ESM/선언/map, Doroti/Flutter notice와 작은 이식 명세 포함도 확인했다. 실제 브라우저 실행은 notVerified이다.
- `compare` CLI는 선택 manifest의 추가/삭제/변경/목적지 변경과 reviewed TS hash를 읽기 전용으로 보고한다. 같은 pin 비교의 변경 0/제품 쓰기 0을 확인했다. 실제 upstream 변경 채택은 아직 없으며 이전/새 초안과 reviewed TS의 의미 검토는 개발자가 수행한다. root npm lock 변경 없음.

- 추가 수명 확인: 같은 AppSession의 두 View가 State·예약·종료를 독립적으로 처리하고, native paragraph가 font lease를 renderer retirement까지 유지한다. lazy list의 unkeyed item State가 slot 이동에서 다른 item으로 전이되지 않도록 keyed wrapper를 적용했다. inherited 값을 didChangeDependencies에서 읽는 cached child의 갱신도 확인했다. update/deactivate 예외 중 새 child와 기존 subtree의 teardown을 계속하도록 수정하고 임시 assertion PASS-scoped를 확인했다.
- Cache 정책은 live list/cache/keep-alive 합계 256 item, keep-alive 최대 64, repaint boundary당 4096 command다. Web GrDirectContext는 32 MiB cache limit을 실제 설정한다. native Graphite context/recorder의 기존 32 MiB cache budget을 유지하며 전체 GPU memory나 pinned frame 자원의 상한으로 해석하지 않는다.
- 최종 재검증 중 Windows 명령에 잘못 전달한 Android용 `--architecture` 옵션이 CLI에서 거절됐다. 옵션을 제거한 정상 Windows Release 명령으로 재실행했다. 이 오류는 native compile 실패와 구분한다.
- 첫 묶음 시점에는 caret/selection geometry·관측 keyboard inset port가 없어 W5-08 구현을 미완료로 남겼다. 추가 묶음에서 Android 관측 port와 Web 환경 정보를 연결했다. 별도 TS grapheme 편집기를 만들지 않고 native editor의 사용자 편집을 보존한다. 플랫폼별 실제 IME/reader 수락은 여전히 notVerified다.

- Text input action을 공통 EditingOptions/EditableText에서 DOM Enter/enterKeyHint, stock RN onSubmitEditing/returnKeyType, Android IME action으로 연결했다. Android action은 새 native revision snapshot에 포함되고 active composing·중복 revision·detached token에서 제출 callback을 실행하지 않는다. sample 첫 필드의 Next가 두 번째 FocusNode를 요청한다. 임시 assertion PASS-scoped, SDK editor Kotlin compile 및 최신 Android Release build도 PASS-scoped다.
- Mounted TextEditingController의 programmatic replace는 bridge에 요청한 뒤 native snapshot acknowledgement를 기다린다. 요청 전 값으로 rollback하는 observer 예외 방식 대신, 관측된 값만 controller에 반영한다. 실제 EditableText mount/update로 controller 교체와 old command 해제를 확인했다.
- 실제 CanvasKit 0.41.0 WASM과 bundled NotoSansKR로 TextPainter layout/cache, Korean range/hit, RTL/emoji layout과 paragraph/font lease retirement를 확인했다. Korean unresolved glyph는 0, emoji는 1이다. 현재 sample font의 emoji coverage는 불완전하며 이 결과는 WebGL/Skia 화면·GPU/scanout 증거가 아니다.

- 첫 묶음의 packed 공급을 npm ci로 설치한 Web/Windows/Android runner typecheck와 Web static bundle, Windows x64 Release/Hermes/Vulkan 및 Android x86_64 Release/emulator-Vulkan native build가 PASS-scoped였다. 당시 Windows exe SHA256은 `477b290b3796c14049d943b415bb091a09d7f2970b819c779cd2e4a343d8aef0`, Android APK는 `10ccd4197561a05f574c107359732d95f9b4e1ff01e74866c44d236f6dd361e0`이다. 당시 Android cold start 770 ms·process 생존·fatal 부재는 추가 묶음의 runtime 증거로 승계하지 않는다. APK signing은 local development key이며 production signing이 아니다.
- 외부 Temp 소비 앱 하나를 현행 runner manifest의 정확한 archive로 최종 갱신하고 설치된 CLI template src로 맞췄다. 자체 공급 archive만으로 install·typecheck·Web static build PASS-scoped다. Core의 49개 직접 export에 ESM/선언이 존재하며 Node ESM Widget 생성·ScrollPosition 상태, license·이식 명세 포함도 확인했다. SDK/native UI callback은 현재 immutable semantics snapshot에서만 action을 실행해 제거/교체된 control의 늦은 callback을 차단한다.
- 브라우저/앱 연결을 재확인했으나 inventory는 여전히 apps=[]/browsers=[]다. 실제 Web/Windows 조작·표시와 Android 화면/IME/reader 수락은 실행하지 못했다. 임시 assertion 11개는 마지막 변경 후 PASS-scoped이며 검증용 파일·raw 로그·초안은 아래 소유 allowlist로 정리한다.

- 위 구현 묶음의 임시 23개 소유 경로(초안/분석/11 assertion/raw 로그/외부 소비 앱 등)를 preview 후 -Execute allowlist로 제거했다. cleanup script도 제거했고 ignored scratch에는 파일이 없다. 소유 emulator PID/AVD/port를 확인해 테스트 앱 force-stop과 emulator 종료를 수행했다. 기존 AVD·native 공급·제품 build cache·Bun 도구/lock은 보존했다. 정리 뒤 build:sdk·check:types·sample Web build 및 diff whitespace 확인 PASS-scoped, root npm lock 변경 없음.
- 추가 묶음에서 W5-08의 caret/selection geometry·keyboard/safe-area inset port를 구현했다. Android API 30 이상에서 surface와 WindowInsets/visible frame의 실제 겹침을 측정해 이미 resize된 surface에 keyboard 높이를 두 번 빼지 않는다. 이전 Android는 application safe area와 unavailable keyboard를 명시한다. Web은 CSS safe area와 VisualViewport occlusion을 제공하며 IME 감지 성공으로 해석하지 않는다. text scale도 native/application 출처를 표시한다. 근거 API: [WindowInsets](https://developer.android.com/reference/android/view/WindowInsets), [Layout](https://developer.android.com/reference/android/text/Layout), [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
- Android control-local caret insertion strip·selection Region rectangles를 같은 native revision에 전달한다. 최대 256 selection rect, immutable validated geometry, 실제 control size와의 일치 확인을 적용한다. focused editor가 native bringPointIntoView와 공통 scroll ancestor의 showOnScreen을 사용하고, keyboard/inset/text-scale resize 때 semantics를 발행하기 전에 배치를 다시 계산한다. Offstage route는 reveal하지 않는다. native cursor drawable·IME 후보창 자체를 TS로 재구현하지 않는다.
- native control remount는 native counter epoch만 재시작하고 논리 revision/selection은 보존한다. ID별 binding generation과 token 검증으로 아직 붙어 있는 이전 control의 늦은 이벤트를 거절한다. 새 control은 initialValue(text/anchor/focus)를 원자적으로 받고, 새 port가 연결되면 queued focus를 적용한다. DOM binding 교체도 새 input element로 composition 수명을 분리한다. blur 시 마지막 focus를 보존해 route pop에서 복원한다.
- `SingleChildScrollView`의 bounded page viewport·clamping과 nested wheel 소비를 추가했다. 안쪽 scroll이 실제 이동했을 때만 wheel을 소비하고 경계에서는 바깥 scroll로 전달한다. Text는 MediaQuery/Localizations/Directionality/Theme의 값에 의존하며, 기본 maxLines를 실제 text contract의 유효 상한 128로 수정했다. 실제 WASM 샘플이 기존 maxLines=0 오류를 발견했으므로 과거 fake text assertion만으로 이 계약을 확인했다고 보지 않는다.
- 추가 임시 assertion 4개가 PASS-scoped다: geometry/environment·cached/page editor reveal·nested wheel/resize clamp, semantics callback 중 State 변경의 정확히 한 번 follow-up frame, native counter epoch/세대 교체·late event/focus, 실제 CanvasKit 0.41 WASM의 공유 sample 전체 흐름. 마지막 흐름은 실제 font/image decode와 누적 62 paragraph 생성, counter/animation/theme/locale·list→detail→dialog→Back·native remount focus·synthetic keyboard/textScale=2 resize·font/image retirement를 확인했다. renderer는 즉시 retirement하는 대역이므로 GPU/표시/물리 입력 증거가 아니다.
- 최신 archive와 현재 core/SDK source의 byte 일치를 확인하고 세 runner를 npm ci로 다시 설치했다. 공통 check:types·Web runner check/build, 설치된 CLI로 생성한 외부 앱 하나의 자체 archive install/check/Web build, core 49 public module의 ESM/선언/map·license/manifest 포함이 PASS-scoped다. Native Release 결과와 최종 cleanup은 아래에 별도로 기록한다.
- 추가 묶음의 최신 Windows x64 Release/RNW 0.83.2/Hermes 0.83.10/Graphite-Vulkan native build가 PASS-scoped다. exe SHA256은 `bf558982f0e440c5b5acf03250373d0938ceb486fc156a7508154ffe83abbc90`이며 CLI가 배포 디렉터리 897 files/268356903 bytes를 구성했다. 제품 qualification은 여전히 notVerified다. UI inventory를 다시 조회해 apps=[]/browsers=[]를 확인했고 IAB·Chrome·Edge를 사용할 수 없어 실제 Web/Windows 표시·입력·resize·정상 종료와 Metro edit→remount의 host 수락은 남아 있다.
- 추가 묶음의 최신 Android x86_64 Release/Hermes/emulator-Vulkan build가 SDK Kotlin geometry/environment port를 포함해 PASS-scoped다(Temurin 21.0.11, 3m23s, 116 tasks). APK SHA256은 `880b620c1d08d356e83b0bf1c4e2a340fda9d7e463b6102e1ad13461099f85a6`이다. 소유 Pixel_5/emulator-5580에 설치하고 cold start 949 ms·process 4446 생존·Running NelyxTestbed/startup 로그를 확인했다. runner는 처리된 오류도 cause chain과 함께 console.error로 남기며 확인한 프로세스의 ReactNativeJS/AndroidRuntime 로그에 오류가 없었다. 이는 표시·첫 프레임·실제 한국어 IME·접근성·정상 drain 종료의 수락을 입증하지 않는다.
- 추가 묶음은 정확한 11개 소유 경로(4 assertion, 3 raw log, wrapper/생성 script/PID, 외부 소비 앱)를 preview 후 -Execute allowlist로 제거했고 cleanup script도 제거했다. 소유 emulator 5864/Pixel_5/5580의 PID·command line·AVD를 확인해 테스트 앱 force-stop과 emulator 종료를 수행했다. 종료가 2초보다 오래 걸려 추가 대기 후 process 소멸을 확인했으며 강제 tree kill은 하지 않았다. 기존 AVD와 제품 공급/빌드 입력·cache·도구/lock은 보존했다. ignored scratch는 비어 있다.
- 추가 묶음 정리 후 `npm.cmd run build:sdk` → `npm.cmd run check:types` → sample Web runner `build`가 모두 PASS-scoped다. prepare/CLI 생성 이후에도 scratch가 비어 있고 제품 파일에 삭제된 assertion/cleanup script 참조가 없다. `git diff --check` PASS, root package.json/package-lock.json 변경 없음. 변경은 working tree에 있으며 commit/push는 수행하지 않았다.
- 남은 실행 조건: 연결 가능한 Web browser와 Windows UI surface로 W5-06의 실제 표시·입력·resize·정상 종료 및 W5-10의 Metro edit→root remount/dispose를 확인해야 한다. Android 화면·한국어 IME/selection/candidate·TalkBack, Windows Narrator, 물리 입력·scanout/FPS·production signing·clean-machine acceptance도 실제 수행 전에는 notVerified다. UI 도구의 빈 inventory와 provider unavailable은 소스/빌드 실패와 구분하며, 추가 소스 변경 없이 같은 빌드를 반복하는 것으로 해당 수락을 대체하지 않는다.
- 연속 작업에서 UI inventory는 다시 apps=[]/browsers=[]였다. W5-10 중 UI와 독립적인 Metro 변경 감지를 추가 확인했다. 같은 소유 외부 앱 경로를 설치된 CLI와 현행 runner의 정확한 5개 archive로 재생성하고 Web 개발 server를 사용했다. 공유 `src/app.ts`의 label을 수정→복원할 때 각각 non-initial HMR update(수정 module 1개, shared src sourceURL)를 수신했고, HTTP bundle의 marker/hash 변경도 확인했다. 원본 bytes 복원, error event 부재, awaited Metro/HTTP/WebSocket close, port 8097 재bind가 PASS-scoped다. React/Skia 코드를 실행하거나 UI를 관측한 검사는 아니므로 실제 framework remount·dispose/drain 수락은 계속 미확인이다.
- 이 Metro 확인의 임시 setup/check source와 같은 외부 소비 앱을 3-path allowlist preview 후 -Execute로 정리하고 cleanup script도 제거했다. 제품 source와 dependency는 변경하지 않았다. 정리 후 Web runner check와 diff whitespace가 PASS-scoped다. root npm lock/workspace 변경 없음, owned scratch는 다시 비어 있다. 이 시점에는 목표를 active/PARTIAL로 유지했다.
- 당시 blocked audit: 원래 goal turn과 두 번의 continuation에서 같은 UI 연결 부재를 재확인했다. 당시 inventory도 apps=[]/browsers=[]였다. 미체크 항목은 W5-06 실제 표시·입력·resize·정상 종료/Android 화면과 W5-10 실제 host framework remount·이전 owner dispose/drain이었다. 구현/합성 계약/WASM/Metro protocol/번들/native build·Android process startup 증거를 해당 수락으로 확대하지 않고 목표를 blocked로 기록했다. 아래 사용자 지시 후 PowerShell·Playwright 검증으로 이 연결 제한을 해소했다.
- 이후 사용자가 PowerShell·Playwright 사용을 지시해 직접 UI 자동화로 재개했다. Python Playwright 1.63.0은 `uv run --no-project --with playwright`의 임시 환경에서 사용하며 root/npm 소비 앱 dependency에 추가하지 않았다. 실제 Chrome 154.0.8037.98에서 최초로 `Padding is not a constructor`를 발견했다. basic→app-data→basic 순환 import가 Metro의 초기 값 참조를 남긴 원인이므로 safeArea 조합을 basic으로 이동하고 sample/template 직접 import를 수정했다. Node/Bun ESM·WASM 대역 검사의 PASS를 Metro host runtime PASS로 확대할 수 없었던 실제 사례다.
- 실제 Chrome/CanvasKit WebGL2/ANGLE AMD Radeon 780M D3D11에서 canvas pointer 카운터·theme/locale·lazy wheel·상세/dialog/Back, 두 DOM editor의 native input/selection 방향·Next, 420×720/960×640/760×1000 resize를 확인했다. DPR 1과 최종 수정 후 DPR 2 모두 PASS-scoped이며 DPR 2 physical backing은 1520×2000이다. 공개 SDK closeAllWebApplications를 실제 bundle의 확인된 module export로 호출해 canvas/input 0, WebGL context lost, 등록 font 1→0을 확인했다. UI pixels도 확인했으며 scanout/FPS·물리/한국어 IME 수락은 아니다.
- 실제 Web Fast Refresh는 처음에 Skia 화면만 remount하고 DOM editor/semantics가 사라져 FAIL이었다. dispose가 React 소유 placeholder를 임시 semantics 그룹 안에 남긴 채 그룹을 제거해 다음 surface가 detached parent에 control을 붙인 원인이었다. 원래 부모와 sibling을 보존해 teardown 때 placeholder를 복원하도록 수정했다. 수정 후 외부 packed 소비 앱의 source 수정→복원에서 React Refresh update 3, reload 0, errors 0; 매번 State/counter/editor 초기화, canvas 1, 이전 canvas detached/context lost, CSS font 수 1 유지가 PASS-scoped다. state 보존 reassemble은 제공하지 않는다.
- Windows x64 Release/Hermes/Graphite-Vulkan에서 실제 window pixels와 UI Automation tree를 확인했다. 소유 PID·exe·start time·관측 HWND·foreground를 검증하고 OS mouse로 counter 0→1, theme/locale, native TextBox 값→공통 상세/dialog 표시, Back 시 editor 값/focus 복원, wheel Item 1~4→4~8, 1200×1500/900×700 resize 후 focused editor 노출을 확인했다. WM_CLOSE 뒤 소유 process query handle로 exit code 0을 관측했다. 최초 Process.ExitCode의 빈 출력은 증거로 쓰지 않고 OpenProcess/GetExitCodeProcess로 다시 확인했다. GPU drain의 별도 driver receipt·Narrator·물리 IME는 미확인이다.
- 소유 Pixel_5/emulator-5580/PID 15748에서 최신 core 순환 참조 수정 APK의 실제 공유 화면을 screencap과 UI hierarchy로 확인했다. native tap counter 0→1, 두 번째 editor의 ASCII native input과 실제 Latin IME 표시, 줄어든 surface에서 focused editor bounds 유지, 상세/editor/dialog로 controller 값 전달과 Back 시 focus/값 복원이 PASS-scoped다. 실제 한국어 composing·TalkBack·물리 Android 결과와 구분한다. 이 UI 묶음의 최종 archive/build hash와 cleanup은 아래에 기록한다.
- Android touch drag 후 화면은 home을 유지하고 viewport 항목이 Item 1~5에서 6~11로 바뀌어 목록 이동과 잘못된 tap 억제를 확인했다. 모든 target의 최종 installed core/SDK source bytes가 현재 source와 일치하며 외부 소비 core 49 exports의 ESM/선언/map·notice/manifest와 safeArea 직접 구현도 PASS-scoped다. 최신 Web bundle SHA256은 `061852b839939cdcdfa809fc97d03ad00d18401d2243bbd1c44ae0ed512b6401`이다.
- 최종 Windows x64 Release는 exe SHA256 `7a01b9ca9c264fe12cba447523c6885b0ea528cdb260fa636f00c03bda79a2fd`, 897 files/268356799 bytes다. 동일 binary에서 다시 화면/counter/resize와 cooperative WM_CLOSE exit 0을 확인했다. 최종 Android x86_64 Release는 APK SHA256 `65de26905bac3c3582ef1c4ac0577758d4211cdc74dfff12bea165d010441830`, 3m23s/116 tasks이며 다시 설치한 실제 화면에서 tap counter 0→1과 오류 로그 부재를 확인했다(cold startup 787 ms는 첫 프레임 시간이 아니다). 공통 check:types·외부 소비 앱 check가 PASS-scoped다. build receipt 자체의 runtime/qualification notVerified는 별도 UI 증거로 덮어쓰지 않고 이 문서에서 수락 scope를 구분한다.
- UI 추가 묶음의 44개 소유 경로(25 screenshot, 4 raw log, 10 임시 script, 4 metadata, 외부 소비 앱 하나)를 preview 후 -Execute allowlist로 제거하고 cleanup script도 제거했다. emulator 내부 생성 hierarchy도 host SHA256과 일치함을 확인해 해당 파일만 제거했다. 소유 emulator 15748/Pixel_5/5580은 정상 요청으로 종료했고 기존 AVD·제품 공급/build cache·Bun 도구/lock은 보존했다. 두 Web server와 Metro/HTTP/WebSocket 종료 ACK, Windows cooperative close를 확인했으며 ignored scratch는 비어 있다. 영구 UI 검증 suite나 report tree를 추가하지 않았다.
- 최종 정리 후 `npm.cmd run build:sdk` → `npm.cmd run check:types` → sample Web runner `build`가 모두 PASS-scoped이며 Web bundle hash도 위 실제 UI 검사본과 같다. scratch/외부 소비 앱 부재, 삭제한 UI helper의 제품 참조 부재, diff whitespace, root package/lock 불변을 다시 확인했다. W5-00~11의 선정 구현·대표 검증·소비·정리 항목은 완료하며, 향후 source 갱신·추가 위젯/target·물리 IME/reader·scanout/FPS·배포 signing/clean machine은 현재 증거에 맞춰 별도 범위로 유지한다. 변경은 working tree에 있고 commit/push는 수행하지 않았다.
