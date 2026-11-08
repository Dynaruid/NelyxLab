# work9-a — v2 엔진 중심 구조 개편과 레거시 제거 계획

작성·갱신: **2026-11-08 KST** · 상태: **PAUSED / 구조 개편 PARTIAL**

이 문서는 현재 소스와 패키지·빌드·실행 경로를 검토한 **구조 개편 실행 계약**이다. W9A-00–03을 중심으로 제품 구현을 시작했다. 현재 진행과 검증 범위는 §11에 기록한다. 기존 구현의 **PARTIAL**, 전체 API의 **compatible=false**, 물리 입력·표시의 **notVerified**, 두 성능 수락 flag의 **false**를 유지한다.

[기존 work9 목차](work9.md) · [공통 소유권](work9-1.md#11-typescript-디자인-패키지와-c-엔진의-책임) · [API·디자인 경계](work9-2.md) · [통합·완료 기준](work9-3.md) · [Android·Linux](work9-4.md) · [후속 iOS·macOS](work9-5.md)

## 1. 검토 결론

**대규모 구조 개편이 필요하다. 목표는 기존 TypeScript 프레임워크를 v2의 유일한 App 프런트엔드로 개편하고, C++ v2 엔진을 유일한 제품 실행 경로로 만드는 것이다.** 현재의 별도 `/v2` Widget 체계를 계속 확장하면서 기존 구현을 어댑터로 따라붙이는 방식은 이중 유지보수를 키운다.

개편의 중심은 다음 다섯 가지다.

1. **Widget/Element/State/BuildContext/GlobalKey를 한 체계로 통합한다.** 기존 프레임워크의 클래스 정체성·수명·상속 계약을 기준으로 삼고, 별도 v2 Widget 프레임워크는 내부 scene 전송 기능을 추출한 뒤 제거한다.
2. **TypeScript 렌더 실행과 C++ 렌더 실행의 중복을 없앤다.** TypeScript에는 구성·정책·명령 기록을 남기고, 최종 layout·geometry·hit-test·gesture 판정·편집 document·scene 실행은 v2가 소유한다.
3. **SDK·CLI·설정·템플릿·샘플을 한 부팅 경로로 묶는다.** 현재의 구 SDK/RN 경로와 별도 v2 경로를 종료하고, 일반 생성·빌드·실행·개발 reload·pack이 같은 엔진을 사용하게 한다.
4. **Material/Cupertino의 원래 TypeScript 구현을 사용한다.** 두 패키지의 Widget/State/theme/controller/컴포넌트 정책을 유지한다. C++에는 공통 엔진 연산과 provider만 둔다.
5. **삭제는 대체 구현과 실제 소비자 이관 뒤에 수행한다.** 디렉터리 이름이 오래됐다는 이유로 삭제하지 않고, 실행 기능·공급 의존성·공개 계약을 기준으로 삭제한다. 최종 상태에는 선택 가능한 구 렌더러나 두 번째 Widget 런타임이 남지 않는다.

기존 W9-00–14는 기능·플랫폼·수락 기준으로 유지한다. 이 문서의 **W9A-00–12**는 그 구현을 정리하는 구조 개편 순서다. 기존 전체 API 보존 목표나 W9-13/14의 완료 조건을 자동으로 낮추지 않는다.

## 2. 현재 소스에서 확인한 구조적 문제

아래는 **2026-11-08 개편 전 소스 정적 검토 기준선**이다. 경로 이동·구현 이후의 현재 대응은 §6.0·§11을 따른다. 기존 문서의 실행 기록은 과거 증거이며 이번에 재실행한 결과가 아니다.

| 관찰 | 소스 근거 | 개편에 미치는 영향 |
| --- | --- | --- |
| 일반 CLI와 v2 CLI가 분리됨 | [CLI main](Nelyx/sdk/tooling/cli/src/main.mjs)은 `--engine v2`에서 별도 runner로 진입한다. 이를 생략한 create/build/run은 기존 경로를 사용한다 | v2 기능이 늘어도 일반 개발 경로의 레거시가 줄지 않는다. CLI·config·template·run을 함께 전환해야 한다 |
| v2 내부에도 두 Widget 체계가 존재함 | [widgets.ts](Nelyx/runtime/engine-client/widgets.ts)는 Widget/State/GlobalKey/BuildContext를 다시 정의한다. [original.ts](Nelyx/runtime/engine-client/original.ts)는 기존 BuildOwner/Element를 별도로 만들고 다시 v2 WidgetHost로 전달한다 | 하나의 앱이 두 종류의 tree identity·reconcile·scheduling을 거친다. transport 갱신과 Widget lifecycle을 분리해야 한다 |
| 기존 Widget 연결이 중앙 변환기에 집중됨 | [original.ts](Nelyx/runtime/engine-client/original.ts)는 1,200행 이상이며 render class/prototype 분기와 미지원 hook 거부를 포함한다. [original-* 모듈](Nelyx/runtime/engine-client/)에 control·gesture·focus·text·image 연결이 분산돼 있다 | 새 RenderObject/컴포넌트마다 중앙 허용 분기와 별도 bridge를 고쳐야 한다. 모듈이 자신의 native 설정을 제공하는 방식으로 바꿔야 한다 |
| Core가 두 실행 모델을 함께 포함함 | [rendering/object.ts](Nelyx/src/framework/rendering/object.ts)에 TS PipelineOwner/layout/paint/hit-test와 native ownership guard가 공존한다. [hosting/runtime.ts](Nelyx/src/hosting/runtime.ts)에는 기존 AppSession/ViewRuntime/Renderer 계약이 남아 있다 | native guard만 늘리면 구 실행 코드와 결합이 계속된다. 재사용할 설정·수명 코드와 제거할 실행 코드를 분리해야 한다 |
| 디자인 패키지도 이중 구현임 | [Material v2](packages/material/src/v2.ts)·[Cupertino v2](packages/cupertino/src/v2.ts)는 축소된 별도 클래스와 기본 스타일을 갖는다. 원래 [Switch](packages/material/src/switch.ts)·[Slider](packages/material/src/slider.ts)·[CupertinoSwitch](packages/cupertino/src/switch.ts)는 별도 구현이다 | `/v2`의 간단한 클래스를 정식 컴포넌트로 확대하면 원래 theme/State/확장 계약과 두 벌이 된다 |
| SDK의 기존 백엔드가 여전히 제품 경로임 | [Windows application](Nelyx/sdk/src/platforms/windows/application.ts)·[Android application](Nelyx/sdk/src/platforms/android/application.ts)은 RN registration을 사용한다. [Web application](Nelyx/sdk/src/platforms/web/application.ts)은 React/AppRegistry 경로다. [native-engine.ts](Nelyx/sdk/src/runtime/native-engine.ts)는 별도 GraphiteRenderer를 조립한다 | v2 runtime 파일만 정리해서는 RN·구 renderer·서비스 registry가 없어지지 않는다 |
| 빌드·공급의 경계가 뒤섞임 | [루트 scripts](package.json)의 `build:sdk`는 기존 Skia 패키지·provider 생성·CLI 준비를 묶는다. [engine build](Nelyx/engine/tools/build.mjs)는 Core/디자인/SDK와 Testbed v2 App 번들까지 빌드하며 광범위한 소스 identity를 묶는다. [provider 생성](Nelyx/eng/generate-providers.mjs)은 RN cohort를 포함한다 | 엔진 빌드가 예제 UI·구 공급 모델에 결합돼 있다. 실제 실행 입력은 보존하면서 엔진 공급과 앱 번들 생산을 분리해야 한다 |
| 대표 샘플과 기본 템플릿이 기존 경로임 | [Testbed entry](sample/nelyx-testbed-app-2/src/index.ts)·[Demo entry](sample/nelyx-demo-app/src/index.ts)·[기존 template](Nelyx/sdk/tooling/cli/templates/nelyx-app/src/index.ts)는 ApplicationDefinition을 반환한다. [Testbed Web main](sample/nelyx-testbed-app-2/web/runner/main.ts)은 React 기반이다. [Android v2 sample](sample/nelyx-engine-v2-android/src/app.ts)은 축소 v2 Widget을 사용한다 | 별도 v2 scene의 성공이 일반 갤러리·템플릿 이관을 뜻하지 않는다. 기존 화면·기능을 유지하며 앱 전체를 옮겨야 한다 |
| v2가 구 위치의 중립 코드를 실제로 사용함 | [Windows interaction](Nelyx/engine/platform/windows/interaction.hpp)은 `sdk/native/windows-hermes`의 편집/UIA 코드를, [Android Gradle](Nelyx/engine/platform/android/project/app/build.gradle)은 `sdk/native/android/shared`를 사용한다. [CMake](Nelyx/engine/CMakeLists.txt)는 `skia/native`의 paragraph/Vulkan/font 코드를 링크한다 | `sdk/native`·`skia` 전체 삭제는 현재 v2를 깨뜨린다. 필요한 공통 부분을 먼저 엔진 소유로 이관해야 한다 |
| v2의 import 허용 정책도 경로에 결합됨 | [graph 검사](Nelyx/sdk/tooling/cli/src/engine-v2-graph.mjs)·[import 정책](Nelyx/sdk/tooling/cli/src/engine-v2-data-api.mjs)은 `dist/v2`, `original-elements`, 구 `hosting` 구현 등을 구분한다 | 폴더 이동·alias만으로 경계가 완성되지 않는다. 실제 번들 입력·중복 Core identity 거부를 새 단일 구조에 맞춰 유지해야 한다 |

규모 참고: 네 package manifest의 export key는 Core **539**, Material **190**, Cupertino **45**, SDK **78**, 합계 **852**개다. 내부 subpath도 포함한 단순 manifest 집계이며 호환 API 수나 레거시 수가 아니다. [원래 공개 표면](Nelyx/engine/schema/public-api.json)의 **525/189/44/76 = 834 subpath**와 구분한다. `Nelyx/src` 전체나 모든 기존 export를 삭제 대상으로 간주하면 안 된다.

또한 v2는 현재도 미지원 기능을 명시적으로 거부하며 구 TS renderer로 자동 fallback하지 않는다. 문제는 **동시에 유지되는 제품 경로와 구현 중복**이다. 기존 fail-closed 동작은 개편 후에도 보존한다.

## 3. 유지·개편·제거의 경계

| 분류 | 대상 | 처리 원칙 |
| --- | --- | --- |
| 유지 | Foundation/math/value API, 원래 Widget/Element/State/Inherited/Key, theme/controller/localization, assets/icons, 라이선스·출처 | 재사용 가능한 TypeScript 구현과 객체 정체성을 유지한다 |
| 개편 | RenderObject/painting/gesture/scheduler의 v2 연결, framework→scene 변환, SDK App bootstrap·서비스 | public 의미와 정책을 유지하면서 엔진 설정·transaction·관측으로 연결한다 |
| 이관 후 유지 | Skia/CanvasKit supplier·patch·lock, Hermes/JSI, paragraph/font/Vulkan, OS 입력/접근성, compiler/asset helper | 실행 의존성을 엔진·공통 tooling 소유로 옮긴다. RN 유래 이름이나 JSI 사용만으로 레거시로 분류하지 않는다 |
| 전환 중에만 유지 | 기존 SDK bootstrap·React/RN surface·구 runner·기존 template, 축소 `/v2` Widget/디자인 API | 기존 소비자와의 전환을 위해 한시적으로 남긴다. 신규 기능·신규 앱의 기반으로 확장하지 않는다 |
| 최종 제거 | TS의 별도 최종 layout/paint/hit-test pipeline, 중복 Widget runtime, 구 렌더러/registration, 불필요한 공급 cohort·export·dependency·script | 마지막 소비자와 native/build 의존성이 사라진 단계에서 소스·배포 산출물·설정을 함께 제거한다 |

`Nelyx/src/runtime`의 owner transaction/dependency/depth queue, `hosting`의 resource·서비스 타입처럼 v2도 사용하는 코드는 디렉터리 단위로 삭제하지 않는다. 제품 실행 경로에서 맡는 역할을 기준으로 남기거나 이관한다.

### 3.1 TypeScript와 C++의 최종 책임

| 소유자 | 맡을 책임 | 경계 |
| --- | --- | --- |
| TypeScript framework·디자인 | Widget 구성, Element/State lifecycle, Inherited/theme, controller·controlled value·validation, callback·route 정책, 스타일과 paint 명령 구성 | Material/Cupertino 컴포넌트를 C++로 복제하지 않는다. 원래 State를 우회하는 adapter 전용 상태 머신도 만들지 않는다 |
| TypeScript scene compiler·session | typed node/paint 설정, handle 연결, ACK 기준 diff, NACK/재시도, publication 관측, App 측 reference/staging 수명 | 두 번째 Widget tree를 만들지 않는다. 엔진이 확정하지 않은 geometry를 현재 geometry로 꾸미지 않는다 |
| C++ Content/Core | 최종 layout·geometry·hit-test·gesture/capture·scroll physics·편집 document·scene 준비·스케줄링·자원 권한 | App callback을 동기 호출해 layout이나 UI owner를 대기시키지 않는다 |
| 엔진 provider·Render | paragraph/path/image/shader 처리, native paint 실행·record/raster·GPU 수명·게시 | Native Skia와 Web CanvasKit binding의 차이는 provider 구현이다. Web TypeScript glue 자체를 레거시 renderer로 취급하지 않는다 |
| OS/Web host | surface·clock·입력 carrier·IME·clipboard·접근성·환경·종료 | OS 코드에 Widget/theme/컴포넌트 정책을 넣지 않는다 |

App 로컬의 **동기 C++/Wasm paragraph·이미지 서비스**는 이 구조와 양립한다. 현재 [AppTextLayoutService](Nelyx/runtime/engine-client/original-text.ts)와 [Web App service](Nelyx/engine/platform/web/app-text.ts)가 그 예다. 이를 TS layout fallback이나 미구현 서비스로 잘못 분류하지 않는다. 장면 전체의 최종 geometry 권위는 Content에 유지하고, 로컬 query의 font cohort·quota·handle·수명은 명시적으로 관리한다.

## 4. 목표 구조와 단일 실행 흐름

기존 package 이름을 우선 유지한다. 구조 정리만을 위한 새 package 분할은 늘리지 않는다. 아래는 **개편 후 배치안**이며 아직 존재하지 않는 경로는 구현 단계에서 만든다.

```text
Nelyx/
  src/
    foundation/ math/ services/ ui/    원래 공통 API와 값·서비스 계약
    framework/                        유일한 TypeScript Widget/Element/State 체계
    runtime/
      app/                            BuildOwner·App frame 연결
      scene/                          native 설정·scene compiler·transaction writer
      engine/                         packet/client/handle/publication
      services/                       App 측 엔진 서비스 계약·reference 수명
  sdk/
    src/
      app/                            유일한 define/launch/close/reload 조립
      services/                       asset/font/image/network 등 App service 연결
      platforms/                      target별 bootstrap descriptor·host 연결
    tooling/
      shared/                         compiler·asset·package 입력 공통 도구
      cli/                            하나의 create/doctor/build/run/dev/pack
  engine/
    schema/ bindings/ core/           protocol 원본·C ABI·공통 C++ 실행
    render/                           Skia/CanvasKit provider
    platform/                         Windows/Web/Android 및 후속 host·OS helper
    vendor/                           엔진에 필요한 supplier metadata·출처
    tools/                            엔진 공급 생성
packages/
  material/src/                       유일한 TypeScript Material 구현
  cupertino/src/                      유일한 TypeScript Cupertino 구현
```

일반 앱의 흐름은 **원래 Widget → 하나의 BuildOwner/Element tree → native 설정 → scene transaction → C++ Content → provider/Render → host 게시**다. 입력은 **host 수집 → C++ geometry/gesture/edit 판정 → generation이 있는 App 이벤트 → 원래 State/controller/callback**으로 돌아온다.

- 현재 `WidgetHost`의 ACK 기반 node diff·명령 순번·불확정 ACK 처리·upload 수명은 먼저 **Widget 비의존 transaction writer**로 추출한다. 그 위에 기존 BuildOwner가 만든 설정을 직접 전달한다.
- 현재 Original bridge의 `원래 Element → 별도 v2 Widget → 별도 Element` 중간 단계를 없앤다. 최종 scene snapshot은 엔진 문서 전송 모델이며 별도 UI framework가 아니다.
- 각 표준 RenderObject·디자인 painter는 자신이 소유한 모듈에서 typed native 설정을 제공한다. 중앙의 클래스 이름/prototype allowlist를 계속 확장하는 구조를 끝낸다. 미등록 사용자 subclass를 표준 구현으로 오인하지 않게 한다.
- C++ protocol과 capability·schema 생성은 [protocol.json](Nelyx/engine/schema/protocol.json)을 단일 원본으로 유지한다. ABI/schema가 달라지면 host·Wasm·client·앱 공급을 함께 갱신한다.
- `@nelyx/sdk/app` 같은 일반 App entry로 통합한다. 함수명·옵션은 W9A-01에서 확정한다. `/engine-v2-original`을 선택해야 원래 Widget이 동작하는 사용 방식은 종료한다.
- 기존 import는 같은 클래스·서명·동작이 유지되는 범위에서 forwarding한다. 특히 축소 `material/v2`와 원래 Material은 생성자가 다르므로 단순 re-export로 호환을 가장하지 않는다. 소비자 이관과 버전 전환을 거쳐 제거한다.

## 5. 삭제보다 먼저 확정할 API·실행 계약

전체 API 호환은 아직 완료되지 않았다. 구조 정리는 원래 API를 다시 구현하는 작업과 구 실행기를 제거하는 작업을 연결해야 한다. 지원되지 않는 API를 export 목록에서 지워 호환률을 높이는 방식으로 처리하지 않는다.

| 항목 | 보존·전환할 계약 | 삭제/전환을 막는 조건 |
| --- | --- | --- |
| Widget·State·Key | 원래 constructor·상속·context·reparent·Inherited 알림·init/update/deactivate/activate/dispose, listener 재진입·예외 시 정리 | 별도 v2 State로 우회하거나 class identity가 달라지는 경우 |
| 표준 RenderObject | configuration/parent data·native invalidation을 유지하고 공통 C++ node/paint 연산으로 연결 | 같은 node가 TS와 C++에서 각각 최종 layout/paint/hit-test를 수행하는 경우 |
| 동기 text API | 현재 구현된 App 로컬 C++ paragraph layout/hit/range/line 질의, font revision·resource retention을 보존 | 모든 query를 Promise로 바꾸거나 stale 결과를 동기 정답으로 반환하는 경우 |
| scroll·editing·geometry | App 소유 의도·즉시 read/listener 계약과 엔진 확정 값·publication·ACK/NACK/취소 순서를 API별로 구분 | 원래 동기 geometry가 미해결인데 다음 frame snapshot으로 호환 처리하는 경우 |
| custom layout/paint/hit-test | 표준 metadata, 명시 native extension, App에서 기록 가능한 공통 draw 명령 등 실제 지원 방식을 hook별로 정의 | 임의 JS 동기 subclass를 Content에서 실행할 수 있다고 가정하거나 TS renderer를 숨겨 유지하는 경우 |
| 기존 SDK host API | AppDefinition·서비스 API와 React component/직접 Renderer 주입 API를 구분해 대응표 작성 | 새 App entry로 의미가 보존되지 않는 기존 API가 누락되거나 조용히 무시되는 경우 |

보존 방식이 미해결인 항목은 **미완료**다. API 단절이 필요한 항목은 변경 대상·이유·대체 호출·플랫폼 영향·버전 전환을 구체적으로 기록하고, 기존 호환 목표와의 관계를 확정한 뒤 해당 삭제를 진행한다. 이번 구조 검토만으로 원래 공개 계약 폐기를 결정하지 않는다.

[public-api.json](Nelyx/engine/schema/public-api.json)의 원래 834 subpath와 서명 hash는 비교 기준으로 유지한다. 새 표면은 별도로 대응시키며 원래 파일을 현재 v2 export로 덮어쓰지 않는다. 기존 문서의 마지막 전체 API 미통과 기록도 이번 정적 검토의 성공으로 변경하지 않는다.

현재 SDK [tsconfig](Nelyx/sdk/tsconfig.build.json)는 DOM·React Native ambient types를 함께 포함하고 `skipLibCheck=true`다. 현행 `check:types` 성공만으로 Native 설치 소비자의 DOM/RN 없는 선언 호환을 입증할 수 없다. 개편 후에는 공통 App/client를 **ES2022·types=[]**, 브라우저 entry를 **DOM 포함 별도 환경**으로 나누고, 실제 공급 compiler·조건부 export·NodeNext와 `skipLibCheck=false`로 소비 선언을 확인한다.

## 6. 실행 단계와 의존성

우선순위는 경계 확정 → 공통 의존성 분리 → 단일 frontend 수직 연결 → 기능 이관 → 제품 전환 → 실제 삭제다. 각 단계의 현재 상태는 §11을 따른다.

| 단계 | 선행 | 작업과 산출물 | 완료 조건·기존 work9 연결 |
| --- | --- | --- | --- |
| **W9A-00 기준선 정리** | 없음 | 현재 export·진입점·소비자·build/native 의존성을 이 문서에 대응시킨다. 유지/이관/삭제·후속 플랫폼 보류를 구분한다 | 삭제 후보마다 마지막 소비자와 대체 위치가 명확함. W9-00 |
| **W9A-01 계약 확정** | 00 | §5의 동기 API·custom hook·controller와 일반 App entry/config의 계약을 확정한다 | 원래 호출·실행 owner·ACK 전후 의미·미해결 의무가 구체적임. W9-06-A |
| **W9A-02 공통 의존성 추출** | 01 | 구 위치에서 사용 중인 native OS/Skia helper와 compiler/asset 도구를 중립 위치로 이관한다 | v2 Windows/Web/Android 공급이 새 위치로 빌드되며 helper 중복 사본·옛 경로 의존성이 없음. W9-01/02/06 |
| **W9A-03 단일 frontend 수직 연결** | 02 | transaction writer를 WidgetHost에서 추출하고 원래 BuildOwner에서 직접 scene을 생성한다. 최소 App을 새 entry로 연결한다 | 같은 원래 Widget/State/Key로 Text·layout·버튼·스크롤·편집기 한 경로가 실행됨. 두 번째 Widget/Element tree 없음. W9-06-B |
| **W9A-04 Core 실행 개편** | 03 | 표준 RenderObject·layer·sliver/list·gesture·focus·scheduler를 native 설정/명령/관측으로 연결하고 TS 실행 코드를 순차 제거한다 | 지원 클래스마다 layout·paint·hit-test 권위가 하나이며 미지원 subclass는 명시 실패. W9-06/07/09/10/11 |
| **W9A-05 디자인 단일화** | 04의 필요한 연산 | 원래 Material/Cupertino theme·State·controls·text field·form·route/overlay·painter·localization·assets를 이관한다 | 실제 원래 클래스와 기본값이 실행됨. 축소 `/v2` 컴포넌트에 의존하지 않음. 전체 catalog의 미완료가 추적됨. W9-08 |
| **W9A-06 SDK 서비스 단일화** | 03·04의 필요한 서비스 | Data/Original App bootstrap을 하나로 합치고 asset/font/text/image/network·platform 서비스와 lifecycle을 동일 session에 연결한다 | App 모델별 service owner 중복 없음. 시작 실패·취소·늦은 resolve·reload·close에서 실제 자원 회수. W9-09/11/12 |
| **W9A-07 빌드·CLI·템플릿 연결** | 02·03·06 | 엔진 공급/앱 번들 생산을 분리하고 하나의 target descriptor·설정·CLI·새 template으로 연결한다 | v2 후보 경로에서 create/doctor/build/run/dev/pack이 같은 공급과 App entry를 사용. 기본값 전환은 10단계에서 수행. W9-00/12/13 |
| **W9A-08 대표 앱 이관** | 04·05·06·07 | Testbed·Demo의 기존 화면·상태·탐색을 보존해 이관하고 Android sample도 원래 Widget 체계로 옮긴다 | 실제 갤러리·장면·상세·입력·자산이 같은 경로로 동작. engine build가 샘플 UI를 필수 입력으로 사용하지 않음. W9-08/12/13 |
| **W9A-09 제품 통합 확인** | 08 | Windows/Web 두 profile·Android의 실제 생성/설치/화면·입력·reload·loss·종료와 선언 소비를 확인한다 | W9-13 기술 판정과 W9-14 물리/성능 판정이 분리돼 있고 실패/미검증이 남김없이 드러남 |
| **W9A-10 전환 대상의 기본값 변경·삭제** | 09와 대상별 전환 gate | 수락한 대상의 일반 CLI·sample·template을 v2 기본값으로 바꾸고 마지막 구 소비자·중복 Widget·불필요 export/dependency를 삭제한다 | 지원 대상의 create/build/run/dev/pack 실제 graph에 구 runtime·RN renderer가 없음. API·기술·제품 전환 gate 통과 |
| **W9A-11 후속 플랫폼 종료 조건 충족** | 기존 work9 차수 기준 | Linux·iOS·macOS를 같은 frontend와 native host로 연결하고 구 RN runner/API의 대체를 마친다 | Linux는 4부, Apple은 그 후 5부 조건 충족. 기존 지원을 중단해야 한다면 별도 명시 결정이 있어야 함. W9-03/04/12-B/13/14 |
| **W9A-12 저장소 전체 레거시 제거** | 10·11 | 남은 임시 격리 경로·구 공급/빌드/템플릿을 삭제하고 문서·생성 소유권·배포 파일 목록을 확정한다 | 저장소·배포 package에 재실행 가능한 구 엔진/두 번째 Widget 체계가 없음. 원래 API 미해결을 삭제로 숨기지 않음 |

W9A-05와 06은 04에서 필요한 엔진 연산이 준비된 묶음부터 진행할 수 있다. 디자인 전체 완료를 기다리며 자산/서비스의 독립 이관을 막지 않는다. 각 삭제는 자기 소비자의 완료 조건을 충족한 뒤 수행한다.

### 6.0 기준선 대응과 확정한 실행 계약

| 기존 소비자·계약 | 현재 대체와 마지막 소비자 | 잔여 삭제 조건 |
| --- | --- | --- |
| 원래 framework → `original.ts` → `WidgetHost` | `runtime/app/host.ts`의 원래 BuildOwner가 `SceneNode` 설정을 만들고 `SceneWriter`로 직접 전송한다. SceneReference는 native handle identity이며 Widget/Element/State/Key가 아니다. Box/Flex/Stack·clip·transform 14종은 원래 모듈이 exact-prototype 설정을 등록한다 | paragraph/image·control/layer의 남은 중앙 분기와 `runtime/app/*` 기능은 W9A-04에서 모듈 소유 설정으로 이관 |
| 별도 v2 Widget·State·GlobalKey | 기존 `WidgetHost`는 전환 중인 data frontend만 담당하고 공통 writer를 사용한다 | Testbed `src/v2-app.ts`·`v2-scene.ts`, 축소 Material/Cupertino `/v2`, list/navigation/graphics의 data frontend 소비자 이관 후 삭제 |
| SDK OriginalRoot·App별 host 등록 | `@nelyx/sdk/app`의 `defineApp`·`launchApp`; `app-session.ts`가 하나의 service session을 만들고 native host 준비 후 원래 Widget을 mount | 기존 `engine-v2` launcher는 전환 중인 data App 호출만 호환한다. 신규 App은 일반 entry 사용 |
| SDK 공통 asset/buffer/image/network 수명 | 두 launcher가 같은 session의 `EngineV2Assets`·buffers·images·text backend를 사용한다 | public platform 서비스·reload/loss와 전체 SDK host API 대응은 W9A-06/09에서 확인 |
| SDK platform message·clipboard·OS 환경 | 원래 App은 기존 `PlatformMessageConnection`·`PluginPlatformMessagePort`의 단일 messenger를 사용한다. 공통 `clipboard-service.ts`는 구 `installOsServices`와 같은 채널 구현이며, Windows UI·Android HostView UI·Web Main의 실제 clipboard에 v2 transport로 연결한다. 원래 RenderObject feedback은 accepted semantics 조상을 통해 같은 OS owner로 전달하고 Android sound/haptic도 UI에서 실행한다 | 일반 접근성 announce·다른 OS 채널·환경/font/lifecycle 관측·VM globals·reload/loss는 W9A-06/09의 잔여 작업. 구 renderer 재연결 없이 요청/byte 한도와 stop/cancel/drain을 유지 |
| 엔진 공급에 포함됐던 Testbed App·자산 | 공급은 host/provider/protocol/font만 만든다. 일반 실행 명령이 App package를 준비하고 `sample/nelyx-testbed-app-2/engine-v2`의 기존 후보 장면을 별도 App bundle로 빌드한다 | 실제 Testbed/Demo catalog 이관은 W9A-08. 현재 후보의 data Widget·축소 디자인 소비자는 여전히 삭제 전 |
| Windows TSF/UIA·trackpad·paragraph/font/Vulkan | `engine/platform/windows/interop`·`input`·`engine/render`; 구 SDK/Skia 파일은 엔진 소유 helper의 현재 package projection만 include | 구 host 전체 삭제는 지원 target별 이전 소비자 종료 후. 중립 helper 자체는 보존 |
| Android 공통 UTF-16 입력 규칙 | `engine/platform/android/shared`; standalone 공급은 Java를 프로젝트에 포함하고 기존 SDK template은 준비한 helper projection을 사용 | Android 실제 공급·IME/accessibility·종료 확인. Kotlin/RN host는 전환 전 유지 |
| Metro에 있던 TypeScript compiler helper | 기존 `@nelyx/tooling-contracts/typescript-compiler`로 이동. 엔진/package build는 해당 구현을 직접 사용하고 Metro export는 forwarding | RN bundling·asset helper·Static AOT·이전 CLI 전체의 종료는 W9A-07/10 이후 |
| BrowserPlatformEnvironment | `sdk/src/platforms/web/environment.ts`; 구 browser backend 경로는 같은 클래스 forwarding | 다른 SDK backend의 마지막 재사용 helper를 분리한 뒤 전체 backend 삭제 |
| Android sample의 별도 v2 controls | 일반 App entry와 원래 Material/Cupertino·TextEditingController·AnimationController를 사용하는 `src/app.ts` | 기본 InkSparkle·전체 form/route/catalog·실기기 확인은 미완료. `original.ts`는 같은 entry forwarding |

일반 App의 확정 계약은 다음과 같다.

- `defineApp(AppDefinition)`의 `build(AppContext)`는 **원래 Widget** 또는 그 Promise를 반환한다. `launchApp`은 packet/view·공통 services를 준비한 후 font binding/catalog → user build → 원래 BuildOwner → SceneWriter → 활성화 관측 → ready 순서로 실행한다. 서비스 준비 실패·취소에서도 공통 disposer가 이미 설치되어 있다.
- `State.setState`·Inherited/theme·controller의 App 값은 기존 원래 구현대로 즉시 바뀐다. 문서 ACK는 node/config 채택이며, publication·표시 완료를 뜻하지 않는다. NACK 뒤에는 이전 accepted scene과 해당 font/image holder를 유지한다. 불확정 ACK는 query/retry로 terminal을 확정하기 전에 handle/resource를 재사용하지 않는다.
- 동기 TextPainter/paragraph 질의는 App 로컬 C++/Wasm backend에 남긴다. 동기 geometry는 기존처럼 미지원이며 stale snapshot을 정답으로 반환하지 않는다. ScrollController·편집 controller의 App intent와 엔진 관측은 기존 bridge 계약을 보존한다.
- 임의 JS layout/paint/hit-test override와 미등록 RenderObject subclass는 명시 실패한다. 공통 native 연산·명령 기록·명시 extension을 연결하기 전에는 지원 또는 전체 API 호환으로 판정하지 않는다. 중앙 allowlist의 제거는 W9A-04의 별도 의무다.
- 새 config는 `nelyx.json`의 `schema: "nelyx.app/1"`·상대 `entry`·`assets`·선택 `supply`를 사용하며 renderer는 v2 하나다. 이전 `nelyx.v2.json`은 전환 입력으로 읽는다. 두 파일 또는 `package.json.nelyx`와의 공존은 실패한다. 구 SDK host 설정은 의미가 다른 VM/renderer 옵션을 자동으로 버리지 않고 명시 이관을 요구한다.
- API 기준 `public-api.json`의 **834 subpath·서명 hash는 변경하지 않는다.** React component/직접 Renderer 주입, 전체 custom hook·동기 geometry, Linux/Apple host의 대체는 계속 미해결 의무다. 이 계약 확정이나 forwarding 추가는 해당 API의 호환 완료를 뜻하지 않는다.

### 6.1 첫 구현 묶음: W9A-00–03

- [x] `@nelyx/core/v2`·`/v2/original`·원래 framework·SDK entry의 실제 import 관계, CLI 기본값, template와 세 대표 앱의 진입점을 고정한다. 새 독립 감사 시스템 대신 현재 문서와 기존 build 입력을 사용한다.
- [x] 하나의 App 정의가 원래 Widget을 반환하도록 API를 정한다. 별도 `OriginalRoot` marker Widget과 App 모델별 host 등록을 없앨 수 있는 bootstrap 경계를 만든다.
- [x] `WidgetHost`에서 handle/node diff·ACK/NACK·command retry·resource upload를 추출한다. 기존 동작을 보존한 뒤 원래 BuildOwner와 연결하고, 별도 v2 Widget tree를 경유하지 않게 한다.
- [x] Windows HWND/App SDK, Web single-worker/threaded, Android가 공유하는 부분은 함께 갱신한다. Android의 기존 partial 구현을 초기 상태로 되돌리지 않는다.
- [ ] 최소 수직 앱에서 State 갱신·Key reparent·theme 변경·버튼 callback·scroll·TextField·font/asset·정상 close를 확인한다. 이 단계 성공은 전체 API나 디자인 catalog 완료가 아니다.

**첫 묶음 완료점:** 기존 Widget의 수명은 한 번만 실행되고, 같은 session이 C++ transaction을 생성·확정하며, 구 renderer나 별도 v2 State를 사용하지 않는 최소 앱이 동작한다. 이 근거가 생긴 뒤 대량 파일 이동과 구 실행기 삭제를 시작한다.

### 6.2 Core·디자인 이관: W9A-04–05

- [x] Box/Flex/Stack/Align/Padding·clip·transform·RepaintBoundary·ColoredBox 14종의 native 설정을 원래 모듈로 이관한다. frontend는 typed 설정을 scene으로 compile하며 사용자 subclass와 instance 실행 hook은 계속 거부한다. 전체 RenderObject/custom hook 이관 완료는 아니다.
- [ ] `RenderObject`의 설정/invalidations/parent data와 TS layout/paint/hit-test 실행을 분리한다. 기본 클래스의 실행 기능을 한꺼번에 지우기 전에 실제 하위 클래스·사용자 확장 의존성을 대응시킨다.
- [ ] Box/Flex/Stack/Align/Wrap/Grid·clip/transform/layer → paragraph/image/paint → scroll/sliver/lazy list → gesture/focus/editing → overlay/route 순으로 필요한 연산을 이관한다. 각 묶음에서 마지막 TS 실행 소비자를 제거한다.
- [ ] `original-*`가 제공하던 gesture·focus·scroll·editing·font·image 수명 기능을 새 frontend 모듈로 통합한다. 미지원 기능 거부와 native ownership 검사는 일반 backend 계약으로 옮긴다.
- [ ] Material/Cupertino의 원래 theme와 기본 painter를 사용한다. 지원하는 theme를 샘플에 강제해 기본 theme의 빈 기능을 감추지 않는다. 예를 들어 Android 기본 InkSparkle은 별도 미완료이므로 공통 shader/paint 기능 연결이 필요하다.
- [ ] Control의 스타일·값 수락/거부·divisions·drag commit·callback 순서는 원래 TS 정책을 실행한다. v2 provider에 남은 축소 control 기본 그림은 원래 painter 경로의 마지막 소비자가 사라진 뒤 정리한다.
- [ ] TS App frame/ticker는 Widget build·App animation을, C++ scheduler는 준비 scene·native motion·Content/Render 진행을 맡는다. 동일 입력/frame을 두 scheduler가 중복 처리하지 않게 하고 모든 JS animation의 App 독립 진행을 약속하지 않는다.

### 6.3 SDK·공급·도구 이관: W9A-06–07

- [ ] session/view·App services·host에 각각 한 소유자를 둔다. Text·image·buffer·network owner의 현재 version·quota·font cohort·credit을 유지하고 수명만 이름 바꾸며 생략하지 않는다.
- [ ] App intent 변경, document accepted, scene 활성화, 실제 host 게시/완료를 구분한다. uncertain ACK·진행 중 upload·IO callback·GPU holder를 가진 객체는 실제 terminal까지 유지한다.
- [ ] SDK의 RN registration/React Surface/구 NativeEngine 조립을 대체하고, 공통 App/client 선언에서 React/RN/DOM ambient type 의존성을 제거한다. `BrowserPlatformEnvironment` 같은 v2 사용 helper는 먼저 중립 모듈로 옮긴다.
- [x] 원래 App의 공통 messenger에 clipboard 서비스를 연결한다. 세 host의 v2 transport·최대 32 요청·65,536 UTF-16 단위·aggregate byte admission·미지원 채널 거부와 종료 회수를 확인한다. RenderObject feedback의 native owner 연결과 Android sound/haptic도 이 mailbox·종료 drain을 사용한다. 전체 OS 서비스 완료를 뜻하지 않는다.
- [x] 원래 BuildOwner에 native 게시 장면을 관측하는 View 소유 SemanticsBinding을 연결한다. Tap/long press/increase/decrease listener·clip된 좌표·metrics/device/publication 경계·messenger stop/close 수명만 확인하며 전체 semantics·TapRegion의 callback 내 즉시 정책 변경 계약은 남긴다.
- [x] 엔진 공급은 core/provider/host/worker·protocol·supplier를, 앱 빌드는 framework/디자인/SDK 사용 코드·assets를 책임지게 한다. 엔진 도구에서 특정 Testbed UI의 필수 번들링을 제거한다.
- [x] source identity를 실제 실행 입력과 일치시킨다. 입력 영역을 나누더라도 host/client ABI·schema·App service version·font/assets·실제 파일 hash 검증은 유지한다. 소스 이동을 이유로 실행 입력 hash를 누락하지 않는다.
- [ ] `nelyx.v2.json`과 기존 `package.json.nelyx`를 하나의 버전 있는 App 설정으로 이관한다. 두 설정이 공존해 충돌하면 명시 실패한다. 이전 설정의 읽기는 순수 변환으로 제한하고 구 renderer 선택 기능은 남기지 않는다.
- [ ] 현재 `--engine v2`를 사용해 후보 앱을 확인한다. 최종 기본값 전환 후 같은 옵션은 허용 가능한 호환 입력으로만 처리하며 새 구 엔진 분기를 만들지 않는다. Hermes/V8/JSC의 VM 선택과 렌더 엔진 버전 선택을 분리하고, 공급되지 않은 조합은 명시 실패한다.
- [ ] Metro에 있는 compiler/asset helper와 실제 필요한 Hermes bytecode compiler를 분리한다. RN bundling·autolinking·Static AOT의 구 경로만 의존성 종료 후 제거한다. engine build가 빌드 helper 때문에 RN 전체 설치를 요구하지 않게 한다.

### 6.4 제품 전환·후속 플랫폼: W9A-08–12

- [ ] Testbed/Demo의 실제 catalog·탐색·긴 목록·상세·폼·modal·텍스트/이미지를 이관한다. 축소 v2 showcase를 일반 앱의 대체 완료로 세지 않는다.
- [ ] Windows 두 host, Chrome/Edge의 Web 두 profile, Android standalone을 공통 변경의 확인 대상으로 둔다. 기존 Android 사용자 지정 선행 구현과 emulator/cross-build/물리 기기 증거의 차이를 유지한다.
- [ ] 일반 생성 앱에서 설치된 package만으로 build/run/dev/pack을 확인한다. repository alias·dist 잔재가 누락된 파일이나 class 중복을 가리지 않게 한다.
- [ ] 대상별 API·기술 완료와 물리/성능 수락을 충족한 뒤 기본 경로를 전환한다. 공급 오류·미지원 capability·미지원 target은 실패로 끝내고 구 경로로 자동 전환하지 않는다.
- [ ] Linux·iOS·macOS의 v2 host가 준비되기 전에는 해당 구 경로를 최종 삭제 완료로 기록하지 않는다. 현재 v2 CLI가 공급하는 target은 Windows/Web/Android이며 Linux·Apple은 DEFERRED다. 새 호스트 연결 또는 명시적인 지원 범위 변경 결정이 전역 삭제의 선행 조건이다.
- [ ] 후속 구현 순서는 기존 work9의 **Windows/Web → Android/Linux → iOS/macOS**를 따른다. Android는 이미 사용자 지정으로 착수한 PARTIAL을 이어간다. 구조 개편을 이유로 Linux와 Apple 작업을 자동 착수하거나 앞선 차수의 완료로 표시하지 않는다.

## 7. 실제 삭제·이관 목록

아래의 ‘삭제’는 계획한 최종 상태다. 해당 행의 선행 조건을 충족하기 전에는 삭제하지 않는다.

| 현재 대상 | 이관/최종 처리 | 삭제 선행 조건 |
| --- | --- | --- |
| `Nelyx/runtime/engine-client/widgets.ts`의 별도 Widget/State/Element/BuildContext/GlobalKey | node/transaction/ACK 기능을 `src/runtime/scene`·`engine`으로 추출하고 중복 framework 클래스 제거 | 원래 BuildOwner 직접 연결, 내부 bridge·sample·디자인 `/v2` 소비자 이관 |
| `engine-client/original.ts`, `original-*`, `OriginalRoot`·App 모델 선택 | 필요한 설정/서비스/수명 기능을 유일한 frontend에 통합하고 Original 전용 계층 종료 | 모든 지원 render/control·font/image·edit 기능과 미지원 거부가 새 경로에 존재 |
| `packages/material/src/v2.ts`, `packages/cupertino/src/v2.ts` | 원래 TS 컴포넌트로 소비자 이관 후 축소 구현 제거 | 생성자·theme·State 차이 대응, 모든 sample/template 이관. 계약이 다른 클래스의 단순 alias 금지 |
| Core TS PipelineOwner·최종 layout/paint/hit-test 실행, 기존 AppSession/ViewRuntime 렌더 조립 | 설정·공통 값·resource/service 계약은 유지/이관하고 구 실행부 제거 | 해당 subclass·SDK·app의 마지막 실행 소비자 제거, custom hook 계약 해결 |
| SDK `bootstrap.ts`·`native-engine.ts`·기존 browser/native-hermes/RN backends·React surface | 일반 v2 App·서비스·host bootstrap으로 통합 후 구 경로 제거 | 플랫폼별 대체·공개 API 대응, `BrowserPlatformEnvironment` 등 재사용 helper 추출 |
| `sdk/native/windows-hermes`·Android shared 등 v2가 사용하는 중립 native 코드 | 엔진의 OS adapter 소유로 이관 | Windows TSF/UIA·Android InputConnection/UTF-16·접근성·종료 확인과 CMake/Gradle include 갱신 |
| `Nelyx/skia/packages/native/rn/web`의 구 JS renderer/binding | engine provider에 필요한 타입/구현을 분리하고 불필요 public package·RN wrapper 제거 | paragraph/font/Vulkan/CanvasKit·supplier·patch·출처와 build 의존성의 대체 완료 |
| 기존 CLI runner/create/template·RN provider/cohort·Metro/Static AOT 전용 경로 | 하나의 CLI/target/config와 공통 tooling으로 대체 | 기존 지원 target과 VM 조합의 이관·명시적 변경, native/asset/compiler helper 추출 |
| package export condition·peer/dependencies·workspace·lock·root scripts | 마지막 참조 제거와 함께 축소·갱신 | 설치 소비자·tarball 파일 목록·조건부 선언·runtime graph에 누락 없음 |
| 생성/변환 ownership·upstream 경로·recipe | 현재 source 소유권으로 갱신하고 폐기한 출력의 재생성을 차단 | adopted/generated 경계·productHash·출처 고지 일치. 일반 제품 빌드에서 전체 재변환 불필요 |

소스가 사라져도 현재 `dist`·pack 파일 목록에 옛 구현이 남으면 삭제 완료가 아니다. 반대로 Skia/Hermes supplier, 출처/license, 공통 engine helper는 구 RN 패키지와 분리해 필요한 만큼 유지한다.

## 8. 확인 방법

2026-11-07 [검증 도구 정리](work9.md)를 유지한다. 폐기한 `test:*`·`audit:*`·`experiment:*`·측정 harness를 이번 개편의 선행 작업으로 복원하지 않는다. 확인은 현재 정적 검사·제품 빌드·일반 앱의 실제 사용 흐름과 공급 검증으로 수행한다.

### 8.1 현재 존재하는 명령

아래 명령은 **구현 변경 시 선택해 실행할 현행 명령**이다. 이번 계획 작성에서 제품 빌드/실행은 수행하지 않았다. 개편으로 script를 변경하면 이 절도 같은 변경에서 갱신한다.

```powershell
npm.cmd run check:types
npm.cmd run lint
npm.cmd run format:check
node Nelyx/engine/tools/generate-schema.mjs --check
npm.cmd run build:engine-v2
npm.cmd run build:engine-v2:android
git diff --check
```

전체 build는 소스·ABI·provider·native 연결이 바뀐 범위에서 수행한다. 이미 통과한 동일 입력을 반복 빌드하며 확인 횟수를 늘리지 않는다. 임시 검증을 실행해야 할 때는 저장소 지침의 **20분 timeout**, 보통 **30회 이내** 반복 제한을 적용한다.

현재 v2 제품 실행 진입점은 다음과 같다. 일반 Testbed/Demo의 기존 실행 명령은 이관 전후에 함께 확인해야 한다.

```powershell
npm.cmd run run:engine-v2:windows
npm.cmd run run:engine-v2:windows-app-sdk
npm.cmd run run:engine-v2:web
npm.cmd run run:engine-v2:android -- --device=emulator-5554
```

Android 명령의 serial은 실제 선택한 기기로 바꾸며 SDK/JDK·ABI 공급을 먼저 맞춘다. Web은 `/isolated/`·`/plain/`에서 threaded·single-worker를 각각 확인한다. 일반 프로젝트의 전환 후보는 현재 CLI의 `--engine v2`로 확인하고, 기본값 전환 단계에서는 그 옵션 없이도 같은 경로로 실행돼야 한다.

### 8.2 변경 범위별 제품 확인

| 확인 범위 | 최소 확인할 실제 동작 | 판정 한계 |
| --- | --- | --- |
| 단일 framework | 원래 import·class identity·State lifecycle·keyed 재배치·Inherited/theme 갱신·예외/해제·controlled update 거부 | 별도 v2 showcase 성공을 원래 catalog 완료로 세지 않음 |
| layout·paint·scroll | 실제 갤러리의 resize·RTL·text/image·clip/transform·긴 목록·nested scroll·navigation/modal | 최종 위치가 맞는 것과 중간 표시·입력 지연·부드러움을 구분 |
| 입력·편집·접근성 | Windows TSF/UIA, Web textarea/ARIA, Android IME/virtual node에서 한글 조합·emoji·선택·focus·capture·pointer cancel·password | 자동/에뮬레이터 동작과 실제 IME·스크린리더·물리 입력 수락을 구분 |
| App 서비스 | root/NetworkAssetBundle·FontLoader·동기 TextPainter·buffer/codec·animated image·취소·부분 실패·reload 후 재사용 | decode 성공만으로 Canvas/모든 장면의 복구를 승인하지 않음 |
| frame·수명·복구 | App 지연 중 준비 scene/native motion 진행, visibility·새 surface generation·loss·준비 실패에서 기존 앱 유지·drain 후 reload·close | accepted/activated/submitted/presented와 실제 scanout을 구분. 불확정 해제를 성공으로 바꾸지 않음 |
| 설치·공급 | 실제 설치 package의 export/선언·동일 Core identity·ABI/schema/service version·supplier/hash·첫 frame·종료, RN/구 renderer가 없는 bundle/link graph | workspace type check·빌드 성공만으로 설치 소비나 앱 동작을 승인하지 않음 |
| 성능·제품 수락 | 실제 일반 명령·같은 화면/입력 패턴에서 scroll/resize·IME 반응·메모리·표시를 대상별로 확인 | CPU/함수 시간·에뮬레이터·합성 입력을 물리 입력·표시·성능 수락으로 확대하지 않음 |

Native 공통 선언은 DOM/RN 없이, Web 선언은 해당 browser 환경에서 확인한다. 새 구조의 선언 표면·원래 계약·실제 runtime 동작을 각각 판정한다. 기능이 부분적으로 통과해도 전체 API 판정을 임의로 `compatible=true`로 올리지 않는다.

## 9. 완료 기준과 기본값 전환

구조 개편의 완료는 폴더 정리나 export 축소로 판단하지 않는다.

- [ ] **단일 frontend:** 제품에서 실행되는 Widget/Element/State 체계가 하나이고 축소 `/v2` 컴포넌트 사본이 없다.
- [ ] **단일 실행 권위:** 최종 layout·geometry·hit-test·gesture·scene 실행이 v2에 있으며 별도 TS renderer나 구 RN renderer 실행 경로가 없다.
- [ ] **TypeScript 디자인 유지:** Material/Cupertino의 원래 theme/State/callback/controller/painter 정책이 실제 실행된다.
- [ ] **일반 개발 경로 통합:** 기본 create/doctor/build/run/dev/pack·config·template·Testbed/Demo가 같은 frontend·engine 공급을 사용한다.
- [ ] **API 의무 해결:** 원래 834 subpath의 대응과 미해결 의무가 빠짐없으며 계약 변경은 명시적이다. 미구현 export 삭제나 분모 재생성으로 완료 처리하지 않는다.
- [ ] **기능·공급 확인:** 대상별 W9-13 기술 완료와 실제 설치 소비·복구·종료가 확인된다.
- [ ] **제품 전환 수락:** 대상/profile별 W9-14 물리 입력·성능·기본값 전환 조건을 충족한다. `performanceAccepted=false`·`resizePerformanceAccepted=false`가 남은 범위는 수락 완료로 기록하지 않는다.
- [ ] **전역 삭제:** 후속 플랫폼의 대체/지원 범위가 확정되고 구 runtime·임시 격리 경로·불필요 dependency·배포 파일이 제거된다.
- [ ] **생성·문서 일치:** 현재 소유권과 생성 입력이 삭제 코드를 다시 만들지 않으며 README·CLI help·work9 문서가 실제 지원 상태와 맞는다.

**중간 이정표를 구분한다.** W9A-10은 수락한 target의 일반 제품 경로에서 레거시를 제거하는 단계이고, W9A-12는 저장소 전체 제거다. Linux·Apple 또는 원래 API 의무가 남으면 전체 상태는 계속 **PARTIAL**이다. 한 target의 전환이 다른 target/profile의 API·물리/성능 수락을 대신하지 않는다.

## 10. 정리·진행 기록 원칙

- 구현은 수직 기능 묶음으로 옮기며, **대체 구현 → 소비자 이관 → 제품 확인 → 구 실행부/설정 삭제**를 한 묶음으로 닫는다. 파일 이동과 대규모 동작 변경을 불필요하게 한 번에 섞지 않는다.
- 전환 중 필요한 구 코드는 마지막 소비자와 제거 단계를 표시한다. 영구적인 `legacy/compat/v1` 제품 백엔드나 구 renderer 선택 flag를 새로 만들지 않는다.
- 현재 dist와 실제 빌드 cache·supplier만 유지한다. 이전 dist/staging·검증 로그·immutable receipt·checkpoint/history JSON·독립 소비자 설치본·browser profile·과거 archive를 누적하지 않는다.
- 임시 설치/실행 폴더는 실행별 최소 범위만 사용하고 성공·실패·중단 시 `finally`에서 회수한다. 파일 삭제 전 절대 경로와 소유 범위를 확인하며 source·supplier·사용자 자료와 구분한다.
- 생성/adopted 코드는 [변환 도구의 소유권 지침](tools/Nelyx.FrameworkToTypeScript/README.md)에 맞춰 현재 productHash·출처·recipe를 갱신한다. 개편을 이유로 제품 전체 재생성을 실행하지 않는다.
- 각 구현 묶음 종료 시 이 문서에 **완료 범위·남은 의무·실행한 명령·미실행 범위·다음 시작점**만 현재 상태로 기록한다. 기존 work9의 과거 PASS 수치를 새 구조의 증거로 복사하지 않는다.

## 11. 현재 구현과 다음 시작점

**상태: PAUSED / PARTIAL.** 사용자의 외출·중간 마무리 요청으로 2026-11-08에 중단했다. 사용자의 재개 요청 전에는 자동으로 이어서 실행하지 않는다. W9A-00–03의 소비자 대응·App 계약·공통 helper·직접 scene 연결을 구현했다. W9A-04의 기능 모듈 이동·Box/Flex/Stack/clip/transform 설정 소유권 분리·Source 고정/가변 ListView 연결, W9A-06의 session/service 통합, W9A-07의 설정·template·compiler와 엔진/App 빌드 분리를 구현했으며 전체 target descriptor·개발/배포 matrix는 남아 있다. W9A-08은 Android sample 이관만 진행했으며, Testbed/Demo의 실제 catalog 이관과 09–12의 전체 완료 조건은 남아 있다.

**이번 중간 정리의 완료 경계:** Source 목록·controller·공유 예산·padding·State/Key·resize·0 높이/빈 목록 묶음과 Icon/CJK run을 마지막 검증 공급에서 확인했다. Web 두 profile과 새 8개 package 설치 소비자의 State init/dispose는 각각 83/83이었다. Windows HWND/App SDK의 실제 OS pointer 전환은 각각 28/28, 정상 종료의 예약/메모리 0·worker join·App error 0이었다. 상세 범위는 아래 목록 묶음 기록을 따른다. 임시 App·archive·설치본·browser/server·검증용 native 창과 이번 compile helper/산출물은 모두 회수했다.

**진행 중인 미검증 변경:** `rendering/mouse-region.ts`·`widgets/raw-tooltip.ts`의 exact-prototype mouse 정책 등록과 Core retained pointer path의 중첩 exclusive 선택, `rendering/wrap.ts`의 native 선언/줄 정렬·양축 방향/overflow clip, `rendering/boxes.ts`의 Flex baseline 및 positioned Stack 선언을 작성했다. `runtime/app/layout.ts`·`controls.ts`와 scene/codec·Core layout/transaction/frame도 함께 변경했다. Layout wire는 128→192 bytes, Source schema는 **3719990506**, 현재 source identity는 **32b5f2ec89a29bdeb4c421a2cc1aefab9e3486165c2f968c014ad73e7e638bfd**다. Core package build와 전체 `check:types`, 변경한 C++ 5개 unit의 `/W4 /WX` compile-only는 통과했다. 이 새 묶음의 동작·실제 Core protocol·설치 소비자·Web/Windows/Android 실행은 **notVerified**다. Tooltip 위치 delegate/overlay와 새 Stack intrinsic·Wrap/Flex dry/intrinsic 경계는 특히 검토·검증이 남아 있다. 실행 결과를 관측하지 않았으므로 Gallery 차단이 해소됐다고 판정하지 않는다.

**공급 주의와 정확한 재개점:** 현재 `engine/dist`·`dist-android`는 아래의 마지막 검증 공급 **f26ab2f… / schema 855578348**이며 새 Source와 일치하지 않는다. 이번 중간 정리에서는 긴 엔진 재빌드·앱 실행을 시작하지 않았다. 재개 시 먼저 위 미검증 diff와 원래 Source 의미를 검토하고, Source/Core differential·malformed wire·hover 중첩/opaque/translucent·Wrap 방향/음수 spacing/clip·두 baseline/없는 baseline·Stack positioned/fit/resize/dry/intrinsic 검사를 한 임시 묶음으로 구성한다. 목록/기존 LayoutBuilder·TapRegion·semantics·Snapshot 회귀를 함께 확인한 뒤 `npm.cmd run build:core`, `npm.cmd run build:engine-v2`, `npm.cmd run build:engine-v2:android`로 공급을 갱신한다. 실제 hash/identity·원래 API 834 분모를 확인하고, 새 설치 소비자와 Web 두 profile/Windows 두 host·원래 Gallery 전체로 이어간다. 테스트 timeout은 20분이고 임시 자료는 finally에서 회수한다. 재개 요청: **`work9-a.md 중간 정리 지점부터 재개해줘`**.

**구현한 범위:** `runtime/engine-client/scene.ts`가 Widget 수명과 독립적으로 native handle·diff·ACK/NACK·불확정 ACK 재확인·upload·event 수명을 소유한다. 원래 BuildOwner는 `runtime/app/host.ts`에서 직접 SceneNode를 만들며 별도 data Widget을 만들지 않는다. `@nelyx/sdk/app`의 `defineApp`/`launchApp`은 공통 session에서 서비스를 준비한 뒤 원래 Widget을 mount한다. 이전 original entry는 같은 App 정의로 forwarding하며 CLI가 실제 import graph를 보고 canonical launcher에 직접 연결한다. data launcher는 원래 frontend를 끌어오지 않는다. Windows TSF/UIA·trackpad·font/paragraph·Vulkan과 Android 공통 입력 규칙은 engine 소유로 옮기고 구 host에는 현재 helper projection을 연결했다. TypeScript compiler 구현은 Metro에서 기존 tooling-contracts로 이동했다. 신규 `nelyx.json`과 strict template은 원래 Widget을 사용한다. Android sample도 같은 App entry·원래 controls/controller를 사용한다.

**기능 확인:** 임시 검증은 실행 후 회수했다. 실제 C++ single-worker에서 keyed handle 재배치·NACK의 이전 scene 보존·ACK 유실 뒤 query/retry·handle retirement를 확인했다. 1MiB 초과 이미지의 chunk/commit ACK를 각각 유실시켜 불확정 upload 재개·원래 캡처 bytes 유지·거부된 순환 graph의 retirement 조회·close 뒤 resource bytes 0을 확인했다. 잘못된 desired graph 때문에 회수 조회가 재귀 순환하지 않도록 보강했다. Web 두 profile에서 원래 Material/Cupertino callback·한글/emoji 편집·controller reset·정상 close를 확인했다. 별도의 최소 수직 앱에서는 두 profile의 State·GlobalKey reparent·Inherited/theme·bounded 고정 높이 ListView/ScrollController·FontLoader·MemoryImage·단일 dispose와 자원 회수를 확인했다. Windows HWND와 App SDK의 원래 Widget 앱에서 실제 GPU 화면·Material callback·편집 선택·한글/emoji 붙여넣기와 선택 범위 교체·정상 종료를 확인했다. 입력 직후의 이전 scene 값과 비동기 편집/게시 완료를 구분해 UIA 값·문서·화면을 함께 확인했다. Android x86_64 emulator에서는 일반 run 명령으로 설치·첫 frame·Material/Cupertino State·Switch·TextField controller reset을 확인했다. 개발 build의 정식 stop 경로에서 App dispose·worker join·예약/메모리 0을 확인하고 설치와 직접 시작한 emulator를 회수했다. 분리한 Testbed는 일반 Windows App SDK 실행에서 실제 GPU 화면·제목 갱신·한글/emoji 편집·정상 종료(예약/메모리 0·worker join)를 확인했다. Web 두 profile에서도 별도 App의 버튼 뒤 활성 document 변경·controlled Checkbox·Core 편집 값과 close를 확인했다. single-worker 편집은 포커스 관측 뒤 일반 키보드 입력과 `editSnapshot`으로 확인했으며 `layoutSnapshot`의 이전 scene 값을 live 편집 값으로 판정하지 않는다. 에뮬레이터와 합성 입력은 실기기·물리 IME 수락을 대신하지 않는다.

**설치·선언 확인:** 현재 8개 package archive를 새 소비자에 offline 설치해 TypeScript 7.0.2·NodeNext·ES2022·`types: []`·`skipLibCheck: false` 선언 검사와 설치 CLI doctor/build/pack을 통과했다. SDK `./engine`의 browser service 선언도 이 검사에 포함했다. 현재 standalone Web pack을 두 profile에서 실행해 원래 Widget App·frozen/private-field App 정의·기본 policy의 고정 높이 ListView·실제 게시 offset 1,200px·예약 0/worker 종료를 확인했다. Clipboard와 모듈 소유 설정을 추가한 최종 archive도 별도의 새 소비자로 설치해 두 profile의 공개 Clipboard roundtrip·NUL/길이 거부, rounded clip·transform·RTL flex·RepaintBoundary와 close 예약 0/worker 종료를 확인했다. 설치된 SDK의 미지원 OS 채널 거부는 native 요청 수 0이었다. root package에서는 기본 policy의 seek/복귀·KeepAlive State 유지·총 57개 row의 생성/해제 수 일치도 확인했다. 전체 설치 catalog·모든 FontLoader/image/reload/loss matrix까지 완료한 것은 아니다. 기본 theme의 Segoe UI/Roboto는 실제 system face를 유지하고 Web의 미공급 family는 선언 순서와 bundled default로 동일 font cohort에서 해석하도록 수정했다. 생성 template의 ColoredBox 인자와 네 방향 Insets도 바로잡았다.

**목록 묶음까지 마지막 검증 공급·검사:** `npm.cmd run build:engine-v2`와 `npm.cmd run build:engine-v2:android`를 통과했다. Windows HWND/App SDK·Web threaded/single-worker 공급 343개 파일과 Android arm64-v8a/x86_64 공급 52개 파일의 hash를 당시 source identity `f26ab2f19156a30d936c2a03f0a2e3aaf027e1e6aea53ad1afe2f0aea27f43a5`와 함께 확인했다. ABI 2·App text service 12·App OS service v2의 8개 transport method를 유지하며 TapRegion wire·Offstage layout·semantics policy/게시 관측·callback source·Snapshot style/paint 결정과 게시 semantics route·LayoutBuilder/Source sliver demand·고정 extent·Core scroll 범위·숫자 offset seek·ideographic run 추가에 맞춰 schema를 855578348로 갱신했다. 앞선 SDK pack 목록의 canonical helper 28개와 App/engine entry 포함 여부, 이번에 바뀐 Skia 관리 파일의 hash도 확인했다. `npm.cmd run check:types`, `npm.cmd run lint`, `npm.cmd run format:check`, schema `generate --check`, `git diff --check`를 통과했다. 임시 source 변경을 원복하는 검사에서 Testbed/App host 변경은 엔진 공급을 무효화하지 않고 실제 provider codec 변경은 무효화함을 확인했다. Android 일반 실행은 process-local HotSpot JDK 21로 `npm.cmd run run:engine-v2:android -- --device=emulator-5554`를 사용했다.

**SDK OS 서비스 추가 확인:** 공개 `Clipboard` 읽기/쓰기/문자열 여부와 한글·emoji roundtrip, 65,537 단위·NUL 거부를 Windows HWND, Web 두 profile, Android x86_64에서 확인했다. SDK 계약 검사에서 미지원 채널은 native 접수 없이 실패하고, 종료는 진행 중 callback을 기다린 뒤 pending/bytes 0으로 닫힌다. Android의 정식 stop도 App dispose·worker join·예약/메모리 0이었다. Android는 `dev.nelyx.w9aclipboard` 테스트 설치와 직접 시작한 Pixel_5 emulator를 회수했다. Native bundler의 browser entry 선택을 바로잡고 두 Hermes 공급의 block-scoping 옵션을 켰으며, 실제 실행에서 반복별 `1,2,3` 캡처와 CommonJS export getter를 확인했다. 선언 전 lexical 접근의 TDZ 예외는 현재 Windows evaluator에서 동등하지 않아 VM 언어 동등성은 미완료다. Web 검사는 권한을 부여한 독립 browser context에서 수행했으며 실제 사용자 권한 UI의 수락 검사가 아니다.

**Core 설정 추가 확인:** `framework/rendering/native-box.ts`의 typed 계약과 exact-prototype registry를 사용해 14종의 설정·미지원 옵션 검사를 `boxes.ts`·`clip.ts`·`repaint-boundary.ts`·`widgets/basic.ts`로 옮겼다. `runtime/app/layout.ts`는 클래스 allowlist 대신 공통 compile과 parent data 연결만 수행한다. 실제 C++ single-worker에서 LTR/RTL padding·flex의 게시 좌표, rounded clip radii·affine transform·RepaintBoundary, 미등록 subclass 거부와 이전 accepted document 보존을 확인했다. 기존 instance 실행 hook 거부도 유지한다. TS 최종 layout/paint/hit-test 실행부와 그 마지막 소비자의 제거는 아직 미완료다.

**원래 feedback 추가 확인:** 공통 messenger 연결 후 실제 pointer로 Material 버튼을 눌렀을 때 원래 `sendSemanticsEvent`가 TS attachment를 요구해 실패하는 경로를 수정했다. Native render owner가 accepted 장면의 최종 semantics 조상을 찾아 generation이 있는 handle로 전달하며 TS semantics pipeline에는 attach하지 않는다. Windows 두 host에서 같은 pointer 클릭 후 `Material 1`·AnimationController `Opacity 0.40`의 UIA·GPU 게시와 정상 close(예약/메모리 0·worker join)를 확인했다. Android x86_64에서는 공개 Feedback의 tap/long-press·system sound/haptic 요청, Clipboard v2 roundtrip·정식 stop의 App dispose·worker join·예약/메모리 0을 확인하고 `dev.nelyx.w9afeedback` 설치와 직접 시작한 emulator를 회수했다. 32개 직접 feedback callback이 남은 상태의 close도 모든 취소 응답과 bytes 0을 기다렸다. Windows/Web의 node feedback 무시는 기존 embedding 동작을 유지하며 일반 announce·reader·물리 sound/haptic 수락은 미검증이다.

**서비스 v2 설치 feedback 확인:** 글꼴 staging 수정 전 공급 `2d8368758e630eb9ad7f47a9e07055cda1ad6a5bbf77753325d483c5669c6972`의 8개 archive를 offline 설치해 strict ES2022 선언·v1 host 거부·미지원 채널의 native 접수 0·설치 CLI doctor/build/pack을 확인했다. Standalone pack을 설치된 Chrome과 Edge의 threaded/single-worker에서 각각 실행했다. 네 조합 모두 원래 frozen/private-field App·Clipboard 한글/emoji와 잘못된 입력 거부·rounded clip/transform/RTL flex/RepaintBoundary·실제 pointer 뒤 `Feedback 0 → 1`·close 예약 0/worker 종료가 통과했다. 권한은 테스트 browser context에 부여했으므로 사용자 권한 UI·물리 입력·display/성능 수락으로 확대하지 않는다. 임시 archive·설치본·browser/server는 실행 종료 시 회수했다.

**실제 catalog import·설치 확인:** 원래 `ComponentsGallery`를 축소하지 않고 번들링하며 RangeSlider의 공개 hardware-keyboard·내부 semantics 설정과 Material Scrollbar의 Cupertino 구현 의존성을 연결했다. CLI 내부 import 예외는 선택한 실제 Material/Cupertino package 소유 파일에만 적용한다. 사용자 파일·동일한 폴더명·다른 물리 package의 같은 이름으로는 예외를 얻지 못하며 data frontend도 원래 디자인 구현을 끌어올 수 없다. 새 8개 archive의 offline 소비자에서 TypeScript 7.0.2·NodeNext·ES2022·`types: []`·`skipLibCheck: false`, CLI doctor/build/pack, 직접 private import와 위조 design package 거부를 확인했다. 설치된 실제 gallery는 873 modules·`original-elements`로 번들링된다. 이 설치본의 첫 실행은 optional rasterizer 조회에서 명시 실패했으며, 이후 optional 조회·TapRegion·Offstage·semantics·Snapshot을 수정한 현재 workspace 실행의 차단은 아래 scopesRoute 항목이다. 최신 schema의 독립 설치 검사는 아래 Snapshot 기록으로 갱신했다.

**세 글꼴 asset·quota 확인:** 실제 Testbed의 NotoSansKR·MaterialIcons·CupertinoIcons 합계 12,317,400 bytes를 사용했다. Transport close와 전달 확정 뒤 asset의 임시 read/검증 복사본 예약을 회수하고 호출자 bytes·각 65,536-byte guard는 App realm 종료까지 유지한다. Web font decode는 한 글꼴의 임시 slice만 별도로 admit하며 Wasm heap·font collection 예약은 보존한다. App quota 320 MiB·최대 CanvasKit heap 256 MiB는 올리지 않았다. Chrome 두 profile의 workspace·설치 standalone App, Windows HWND/App SDK, Android x86_64에서 asset 3개·data 12,317,400/credit 12,514,008 bytes·font revision 2·pending stage 0·binding 1을 확인했다. Windows는 UIA·GPU 게시·일반 Alt+F4 close, Android는 first frame·정식 stop을 확인했다. 모두 정상 종료의 예약 0·worker 종료를 확인했고 Native는 메모리 0이었다. Android의 SwiftShader 실행은 Vulkan adapter 준비에서 실패했으며 host GPU·Vulkan feature의 Pixel_5 실행으로 확인했다. `dev.nelyx.w9afonts` 설치와 직접 시작한 emulator는 회수했다. 이 글꼴 확인에 Edge·실기기·물리 입력·성능 수락은 포함하지 않는다.

**게시 semantics binding 확인:** `runtime/app/semantics.ts`는 실제 SDK dispatcher와 같은 View의 원래 SemanticsBinding을 소유한다. 원래 View owner id와 numeric native View id를 같은 게시 좌표에 연결하고 clip·metrics/device·visibility·publication 경계를 지킨다. 오래된 action에는 최신 게시 좌표를 대신 제공하지 않는다. 실제 C++ Web 두 profile과 Windows 두 host에서 tap/long press/increase/decrease의 listener→원래 callback 순서를 확인했고 Windows UIA·화면에 `Listener 4 Callback 4`가 게시됐다. Web은 listener 예외가 해당 callback을 중단한 뒤 다음 action으로 재개하는 동작도 확인했다. 실제 SDK messenger를 사용하는 추가 수명 검사에서 첫 게시 전/후 stop은 좌표·handle·action을 회수하고, binding lease는 Source unmount까지 유지한 뒤 한 번 해제했다. Native TS semantics/layout pipeline에는 attach하지 않는다. OS accessibility feature ingress·focus/range listener 동등성과 전체 semantics API는 남아 있다. TapRegion의 기본 분류 연결은 아래 범위로 확인했다.

**TapRegion 기본 경로 확인:** Source `tap-region.ts`가 exact-prototype 설정·원래 Key equality·등록 revision을 소유하고 `runtime/app/tap-regions.ts`는 실제 Source callback과 semantics listener를 연결한다. C++는 게시된 tree에서 child-first·translucent·modal·clip·전체 affine·input-padding hit path를 계산하며 down 경로를 up까지 보존한다. 현재 등록된 group으로 inside/outside를 분류하고 layout의 postorder·cache 재사용에 따른 등록 순서를 보존한다. outside 입력 소비로 gesture를 취소해도 up 관측과 bounded publication 수명은 남기며 metrics/종료 취소 때 회수한다. 의미 동작은 clip된 native semantics rect의 중심에서 Surface subtree만 검사하고 Source listener 위치에서 원래 synthetic PointerDownEvent를 전달한다. TS hit/layout/arena 실행을 추가하지 않는다.

C++ 검사에서 실제 LayoutWork의 등록 순서·cached ancestor·같은 tick에 대기한 up과 별도로 접수된 up·보조 button·gesture 전후 순서·semantic 분류·callback queue의 부분 전달 거부·모든 예약 회수를 확인했다. 별도 Source 검사에서 equality가 같은 다른 group 객체, 전체 affine local 좌표, synthetic event 기본값, listener 순서, 변경된 등록 revision과 close 뒤 callback 차단을 확인했다. CLI로 번들링한 원래 세 Region App을 Chrome 두 profile에서 실행해 outside→group inside와 좌표가 달라진 up의 down 경로 유지·gesture 소비·listener→Region callback→후속 listener→action 순서를 확인했다. Windows HWND/App SDK는 computer-use의 OS mouse drag로 UIA와 GPU 게시 화면의 `Tap D3 U3 G0`를 확인했고 일반 Alt+F4 종료의 status/예약/메모리 0·worker join을 확인했다. Web도 종료 예약 0·worker 종료였다. 자동화 입력이며 물리 입력·scanout·성능 수락 증거는 아니다.

**TapRegion 남은 계약:** native가 분류·소비를 접수한 뒤 App callback 안에서 즉시 정책을 바꾸거나 예외를 던질 때 소비 결정과 남은 분류를 원래 동기 실행과 동일하게 처리하는 계약은 미완료다. 현재 Source의 enabled·registry·등록 revision·dispose guard와 Surface별 예외 후 callback 중단을 제공하지만 native가 이미 접수한 소비 결정을 되돌리는 근거는 아니다. 이 범위를 전체 TapRegion 호환 완료로 표시하지 않는다. Android는 두 ABI 빌드와 공급 identity만 갱신했으며 이번 TapRegion의 emulator/실기기 입력은 확인하지 않았다.

**Offstage 기본 경로 확인:** Source `rendering/offstage.ts`가 exact-prototype 설정을 등록한다. C++는 hidden 상태에서도 원래 incoming 제약으로 child를 layout하고 parent는 제약의 최소 크기·baseline 없음으로 확정한다. Dry layout과 intrinsic query는 child를 layout/측정하지 않으며 paint 의존성을 실행하지 않는다. Frame의 paint/hit/semantics 표시와 focus 허용을 분리했고 Offstage 아래 leader는 현재 layer link를 성립시키지 않는다. C++ 검사에서 child layout·baseline 보존, parent 최소 크기, dry/intrinsic의 child measurement 0, focus와 link 표시 복원, child layout cache 재사용과 전체 예약 회수를 확인했다.

공개 `RenderBox.hasSize`·`size`는 native 소유 객체에서 실제 게시 layout 관측을 읽는다. 게시 전에는 실패하며 metrics/device·View 숨김·닫힘·handle generation 경계를 지킨다. 기존 TS 소유 객체의 size 경로와 TS layout 후 native 채택 거부도 검사했다. Native 값을 TS measuredSize에 복사하거나 TS layout을 실행하지 않는다. 이 관측 경로는 전체 동기 geometry 완료가 아니며 `constraints`·`needsLayout`·게시 전 동기 질의와 전체 원래 geometry 계약은 남는다.

Chrome 두 profile의 원래 Offstage·FocusNode·State·AnimationController App에서 hidden parent 0×0, child 120×48, shown parent 120×48을 확인했다. 숨김→표시→숨김에도 State init 1·종료 dispose 1과 같은 native focus가 유지됐고 숨긴 동안 keyboard 4개 event·animation tick 진행을 확인했다. Semantics peer 제거에서 발생하는 DOM blur가 retained Core focus를 해제하지 않도록 SDK peer session을 먼저 회수한다. 실제 screenshot pixel은 숨김 RGBA [244,246,250,255]·표시 [255,136,0,255]였고 hidden semantics peer는 없었다. Windows HWND/App SDK에서도 OS mouse/key 입력으로 숨김/표시 UIA·화면 전환, `Hidden I1 K2 D0 → Shown I1 K2 D0 → Hidden I1 K4 D0`를 확인했다. Web 종료 예약 0·worker 종료, Windows 일반 Alt+F4 종료 status/예약/메모리 0·worker join을 확인했다. Android 두 ABI는 현재 공급으로 빌드했으며 이번 Offstage의 Android 입력·숨긴 EditableText의 Web IME 조합은 확인하지 않았다. 자동화 입력·screenshot을 물리 입력·scanout·성능 수락으로 확대하지 않는다.

**BlockSemantics·ExcludeSemantics 기본 경로 확인:** Source `semantics-annotations.ts`가 두 클래스의 exact-prototype 설정과 blocking/excluding 값을 소유한다. C++는 같은 semantic boundary 안의 이전 paint 형제를 제외하고, boundary를 넘는 전파·Offstage와 ExcludeSemantics 아래 blocker를 구분한다. Pointer와 focus 권한에는 이 차단을 적용하지 않는다. App의 선행 label/action 합치기·자식 metadata 삭제를 제거하고 기본 label·flag·서로 충돌하지 않는 action 합치기를 Frame에서 수행한다. Native action은 게시 컨테이너 id와 원래 callback source를 함께 보존하고, reparent된 source에는 옛 컨테이너 action을 전달하지 않는다.

합쳐진 focus peer와 OS focus 요청은 원래 contributor를 연결한다. Semantic focus·같은 항목의 재요청·DOM focus는 각각 원래 callback으로 전달한다. Source feedback은 native가 게시한 merged/blocked 관측과 publication·metrics/device·visibility 경계를 따르며, 차단된 항목은 OS에 보내지 않는다. Windows 두 host와 Android의 접근성 소비자도 원래 Document 대신 Frame의 최종 semantics를 읽는다. Host InteractionSnapshot이 복사한 Frame·semantics·editor map의 예약량은 실제 보관 수명 동안 ledger에 포함한다. 원래 TS semantics/layout pipeline은 attach하지 않는다.

C++ 검사에서 경계별 억제·blocking=false 복원·Offstage/Exclude의 blocker 전파 차단·callback contributor·focus peer·옛 reparent action 거부·App의 게시 merge flag 위조 거부와 전체 예약 회수를 확인했다. Codec은 callback source의 크기/index/중복/identity와 게시 merge flag를 검사한다. Chrome 두 profile에서 서로 다른 tap/long-press callback·semantic/DOM focus callback 3회·pointer 1회·keyboard 2개 event·State init 1 유지·차단된 feedback 생략과 현재 컨테이너로의 전달을 확인했다. Windows HWND/App SDK의 실제 UIA·화면·OS 입력에서도 이전 항목 숨김/복원, excluded child의 paint 유지, `P1 K2`와 semantics 밖 focus 유지를 확인했다. 두 host의 정상 Alt+F4 close는 status/예약/메모리 0·worker join, 두 Web profile은 예약 0·worker 종료였다. Android 두 ABI는 현재 공급으로 빌드했으나 이 항목의 Android 입력과 hidden Web editor IME는 미확인이다. 전체 merge 충돌·역할/정렬·custom action·focus/range listener 동등성은 미완료이며 전체 semantics API 통과를 뜻하지 않는다.

**SnapshotWidget 기본 capture/freeze 수명:** 원래 SnapshotController·SnapshotPainter를 유지하고 native 설정 리소스의 attach/detach를 연결했다. Source root/subtree 분리·재부모화·dispose 때 controller/painter listener를 해제하며 같은 allow 값의 controller 교체와 painter 변경은 이미지를 유지한다. 공통 C++ SnapshotRegistry가 실제 paint 시점의 capture/reuse·revision clear·DPR/device·empty-size·autoresize·permissive disabled attempt·forced·64 token/이미지 크기 상한을 결정한다. TS는 캐시 판정을 복제하지 않는다. Native Skia·CanvasKit이 투명한 자식 raster를 만들고 바깥 clip/opacity는 캡처에서 제외하며 중첩 paint를 기록한다. 기본 cached painter는 요청한 source 크기를 현재 박스로 늘리고, 원래 Material Zoom TS painter는 live/cached scale·translation·opacity·scrim 정책을 선언한다. 자식 layout·pointer·semantics는 최신 Frame을 사용한다.

C++ 상태 검사는 fractional DPR/ceil·stretch/intrinsic·resize·clear·mode/abort·device·quota·해제를 통과했다. Native CPU raster 검사는 바깥 clip 제거 뒤 보존 픽셀·clear·resize·live/cached painter·중첩 invalidation·예약 회수를 확인했다. Chrome 두 profile의 실제 PNG와 Frame은 frozen 색/최신 semantics/입력 공존, clear/autoresize, 중첩 parent freeze/child clear, GlobalKey 재부모화의 State init 1, 종료 live snapshot/예약 0을 확인했다. HWND/App SDK의 UIA·GPU 화면·OS 입력도 파랑 freeze→빨강 clear→초록 autoresize, 비활성 live 보라색, Value 4/P1 semantics와 보라색 freeze, 이동 뒤 cyan 재캡처/I1을 확인했다. 정상 Alt+F4 종료는 status/예약/메모리 0·worker join이었다. Android 두 ABI는 같은 공급으로 빌드했으나 capture/입력은 미확인이다. 미등록 painter·custom rasterizer는 명시 거부하며 실제 PlatformView·전체 Snapshot API·물리 display/scanout·성능 수락 완료를 뜻하지 않는다.

캡처 안의 opacity/blur·clip save-layer와 중첩 live painter의 scratch는 캡처 pixel 크기로 할당 전에 예약한다. Native CPU 검사는 quota 거부가 raster allocation/paint 전에 일어나고 실패 token을 재사용하지 않음을 확인했다. Web provider의 metadata·surface·paint·mipmap·commit 실패를 각각 주입해 원래 paint hook 실행 없이 token abort와 pixel/surface/image/예약 회수를 확인했다. Cached opacity의 실제 합성 픽셀도 확인했다.

**Snapshot 제한·Web 실패 종료:** 새 캡처가 필요한데 조상 world transform의 역변환이 없으면 Core가 capabilityMissing으로 명시 실패한다. 기존 캡처의 유지와 Offstage의 미실행은 보존한다. 이 geometry의 캡처 지원을 완료한 것은 아니다. 이 실패 검사에서 확인한 Web fatal drain도 수정했다. 오류 후 scheduling과 새 App/input/resource 획득은 중단하지만 inspect·기존 transaction 결과/ACK·closeView·font/image 자원 해제·abort는 허용한다. App VM 종료 전에는 provider credit을 해제하거나 pthread를 강제 종료하지 않고 명시 close에서 provider→Core→worker를 정리한다. Shutdown 자체가 실패한 경우에만 close acknowledgement를 실패로 표시한다. 두 profile의 실제 singular-capture 실패에서 새 App port 거부와 close 예약 0·worker 종료를 확인했다. 전체 reload/device-loss·활성 IME/input·FontLoader/image 취소 matrix 완료로 확대하지 않는다.

**Snapshot 당시 설치·재검증:** 당시 8개 archive를 새 소비자에 offline 설치했다. 실제 TypeScript 7.0.2·NodeNext·ES2022·types=[]·skipLibCheck=false에서 생성 template와 Snapshot/Material/Cupertino/SDK engine 선언을 검사했다. 설치 CLI doctor, Windows 479 modules/Web 478 modules build, standalone Web pack과 두 profile의 frozen/current child·clear·autoresize·중첩·재부모화·State init 1·입력/semantics·close 예약/live snapshot 0을 확인했다. 당시 공급의 HWND/App SDK도 freeze→clear 화면과 정상 Alt+F4 close status/예약/메모리 0·worker join을 재확인했다. 같은 당시 공급의 Block/ExcludeSemantics Web 두 profile 회귀도 통과했다. 모든 임시 archive·설치본·App·browser/server·native 창은 finally에서 회수했다.

**Semantics route 선택·알림:** Source의 `scopesRoute`·`namesRoute`와 `explicitChildNodes` 설정을 유지하며, scope가 있는데 자식의 명시적 semantics를 요청하지 않은 구성은 거부한다. Scope를 임의의 container로 바꾸지 않는다. 공통 C++는 성공한 publication에서만 최종 exposed semantics의 depth-first paint 순서로 새 route를 선택하고, 선택한 subtree의 첫 비어 있지 않은 namesRoute label을 보존한다. 중첩·같은 node의 scope/name·unnamed scope·empty stack을 구분한다. 목록이 그대로이면 선택을 유지하므로 기존 route 앞에 삽입한 scope도 다음 Frame이나 이름 변경만으로 되돌아가지 않는다. 이름 변경만으로 edge 알림을 반복하지 않는다. 이 의미의 기준은 원래 [scopesRoute](https://api.flutter.dev/flutter/dart-ui/SemanticsFlag/scopesRoute-constant.html)·[namesRoute](https://api.flutter.dev/flutter/dart-ui/SemanticsFlag/namesRoute-constant.html) 계약이다.

Offstage·Exclude·Block과 hidden subtree는 노출된 route 판정에 반영한다. Scope는 조상의 일반 label/action merge에 흡수하지 않는다. Scope의 semantic focus·접근성 focus peer·focus-only pointer 대상·기본 semantic Tab 후보를 제외하면서 별도의 Core focus와 입력 권한은 유지한다. 게시 비교의 고정 scratch를 할당 전에 예약하고 Frame은 불변 name metadata의 실제 holder를 유지한다. 이름 찾기와 선택 정책을 Web/OS host에 복제하지 않는다.

Schema blob 28의 sequence·scope/name generation·label은 최종 publication과 함께 전달한다. Codec은 foreign opcode/status·중복·예약 필드·잘못된 flags·UTF-8·길이·scope 밖 name·현재 metrics/device 불일치를 거부한다. 숨김/닫힘·오래된 geometry에는 route 관측을 보내지 않는다. Windows는 게시 sequence당 UIA notification을 한 번 보내고 Web은 같은 sequence의 ARIA live region을 갱신한다. Android는 pane title 또는 window-state event를 사용하며 같은 label의 다른 route edge도 구별한다. Scope로 바뀐 Android virtual node의 접근성 focus/hover도 회수한다.

**Route 확인 범위:** 현재 공급의 C++ 검사에서 준비만 된 Frame·stale publication의 무알림, 삽입/여러 push/pop·이름만 변경·첫 nonempty/merged name·hidden/excluded/offstage/blocked route·세대 재사용·semantic focus 거부와 독립 focus 보존·scratch quota·전체 예약 회수를 확인했다. Source exact-prototype·explicit-child 설정과 codec의 게시/좌표/identity/label 경계 검사도 통과했다. 기존 Block/Exclude 및 Snapshot Core 계약 회귀도 통과했다.

Chrome 두 profile의 workspace App과 새 설치 standalone App에서 실제 Core route 관측과 DOM live region을 대조했다. 새 route를 기존 route 앞에 삽입한 뒤 이름을 바꿔도 같은 선택/sequence가 유지됐고, 중첩·같은 node의 이름·hidden name/fallback·Offstage·Exclude·Block 복원·empty stack과 같은 이름의 반복 edge를 확인했다. State init 1·pointer callback 1·keyboard event 2·scope focus callback 0과 별도 focus 유지, 종료 예약 0·worker 종료를 확인했다. HWND/App SDK에서는 computer-use의 OS mouse 입력·UIA·GPU 화면으로 Home→Inserted→이름 변경→Home→Same→empty→Home와 State init 1/P6을 확인했다. 별도 UIA notification listener가 두 host 모두 초기 Home 뒤 `Inserted, Home, Same, Home`만 수신했으며 이름 변경 단계에는 추가 알림이 없었다. 정상 Alt+F4 종료는 status/예약/메모리 0·worker join이었다.

Android arm64-v8a/x86_64 빌드와 Java 17/Android 36의 접근성 host compile을 통과했다. 이번 Android route 입력·pane/window 이벤트의 실제 수신과 screen reader 음성은 확인하지 않았다. Web live-region 관측과 Windows UIA notification 수신도 실제 screen reader 음성·물리 입력·scanout·성능 수락을 뜻하지 않는다. 전체 semantics merge 충돌·역할/정렬·custom action·focus/range listener 동등성은 계속 미완료다.

**Semantics route 당시 설치·공급 확인:** 당시 8개 archive를 새 소비자에 offline 설치해 실제 TypeScript 7.0.2·NodeNext·ES2022·types=[]·skipLibCheck=false에서 생성 template와 Semantics route/EngineResponse·Material/Cupertino·SDK engine 선언을 검사했다. 설치 CLI doctor, Windows 477 modules/Web 476 modules build, standalone Web pack과 위 두 profile 실행을 통과했다. Windows/Web 343개·Android 52개 파일 hash와 source identity·ABI 2/schema 2814365457를 확인했다. 원래 834 subpath API JSON은 같은 hash를 유지한다. 모든 임시 archive·설치본·App·browser/server·UIA listener·native 창은 finally에서 회수했다.

**LayoutBuilder 경계 구현:** 원래 LayoutBuilder Element·BuildScope·builder callback을 유지한다. 공통 Content는 실제 부모에서 받은 min/max 제약과 Source revision이 마지막 결과와 다르면 자식 layout 전에 준비를 중단하고 generation 있는 node·preparation/document·metrics/device·request id를 전달한다. App은 진행 중 transaction이 끝난 뒤 최신 상태·Source configuration serial을 확인해 원래 callback을 실행하고 정상 scene transaction으로 결과 제약과 자식을 전송한다. Viewport 값이나 TS layout을 builder 입력으로 만들지 않는다. 준비 중에는 기존 활성 scene과 Render가 계속 동작하며 새 설정·재표시·종료는 이전 대기를 회수한다. Content worker는 builder 응답을 기다리며 busy loop를 돌지 않는다. Intrinsic/dry 질의는 speculative tree 변경을 거부하며 일반 동기 RenderObject.constraints는 계속 미지원이다.

**LayoutBuilder 검증:** Source 단위 검사는 최초 지연 build·실제 BoxConstraints·자식 State scope·Inherited 의존성·updateShouldRebuild=false·미등록 subclass·stale revision·1회 dispose와 TS layout 미실행을 확인했다. /W4 /WX Core 검사는 실제 padding 뒤 172×80·중첩 164×74·무한 제약·빈 builder 확장·cache/revision 무효화·dry/intrinsic 거부·suspended preparation 취소·hidden/reshow·이전 active scene 유지·close drain을 통과했다. 실제 Core 응답을 현재 TypeScript codec으로 읽었고 잘못된 revision/axis/reserved·외부 owner·중복·document/metrics/device mismatch는 거부했다. 현재 공급의 route·Block/Exclude·Snapshot Core 회귀 검사도 통과했다.

**LayoutBuilder 당시 실제 App·설치 확인:** Chrome single-worker/threaded에서 fixed parent의 tight 제약(outer 212×160, inner 204×154)·부모 너비 변경·무관한 viewport resize의 callback 비반복·실제 pointer State 갱신·Inherited 값 변경·builder 교체 정책·GlobalKey 재부모화·Offstage layout/표시 억제를 확인했다. State init=1, child와 builder의 native handle을 유지했고 screenshot pixel과 close 예약 0/worker 종료를 확인했다. Windows HWND/App SDK도 실제 OS pointer로 같은 크기·상속 변경·재부모화·숨김 복귀를 UIA/GPU 화면에서 확인했고 정상 Alt+F4 종료의 status/예약/메모리 0·worker join·app error 0이었다. 당시 8개 archive를 새 소비자에 offline 설치해 TypeScript 7.0.2·NodeNext·ES2022·types=[]·skipLibCheck=false의 template/LayoutBuilder/EngineResponse·Material/Cupertino·SDK 선언, 설치 CLI doctor·Web 477/Windows 478 modules build·standalone 두 profile의 같은 행렬을 통과했다. Windows/Web 343개·Android 52개 파일의 hash·source c65d4defb3cf6274dd2cfe269a30264619e059816a8c315978cdf97c0d6f920b·ABI 2/schema 2104852756와 원래 834 subpath API hash를 확인했다. Android 두 ABI는 빌드만 확인했으며 이 기능의 기기 실행·물리 입력/표시·성능 수락은 미검증이다. 임시 archive·소비자·App·browser/server·native 창은 finally에서 회수했다.

**Source sliver·목록 묶음 구현:** 원래 SliverSectionList/SliverFixedExtentList의 exact-prototype 설정을 실제 SliverMultiBoxAdaptorElement와 private BuildScope에 연결했다. Key·Element identity에서 얻은 token, 원래 delegate wrapper·State·KeepAlive·공유 ViewWorkBudget을 사용하며 NativeList adapter에 두 번째 row State cache를 추가하지 않는다. SectionExtentIndex는 같은 native resource attach/detach 수명과 실제 Core 측정으로 갱신한다. Core의 유한 부모 너비·viewport·padding·요청 offset으로 원래 자식을 reconcile하며 Source layout/geometry/hit 실행은 하지 않는다. 고정 extent는 자식의 incoming 제약부터 적용한다.

Core는 모르는 가변 높이를 먼저 실제 측정하고 viewport가 덮일 때까지 필요한 구간만 요청한다. 0 높이와 소수 추정치의 prefix, 취소된 준비의 불변 측정 cache 전달, resize·세대 무효화를 처리한다. Indexed metric은 최대 4096개, 한 장면의 필수/명시 child는 최대 128개다. 선택적 보존은 capacity 0–8과 공유 View 예산을 따른다. 이전 게시 document의 필수 구간은 provisional 준비 동안 같은 Source bucket에서 보호하며, 새 게시 뒤 원래 optional 정책으로 넘긴다. 복귀할 캐시 자식을 먼저 required로 전환하므로 outgoing 회수가 그 State를 먼저 퇴출하지 않는다. 이 보호는 별도 Element cache나 TS layout을 만들지 않는다.

**Controller·Core 범위:** Source 목록의 숫자 jump는 Core의 측정 prefix/cache로 목적 구간을 찾는다. SectionExtentIndex.requestItem의 index·항목 내부 offset도 실제 Core seek와 관측 offset으로 연결한다. Padding을 포함한 min/max scroll extent는 Core가 snapshot에 직접 전달한다. Key 재정렬로 anchor가 준비 구간 밖으로 옮겨지면 기존 active scene을 보존한 채 필요한 Core 구간을 다시 준비한다. 다른 sliver owner의 같은 숫자 token을 이전 anchor로 사용하지 않는다. 기존 legacy 고정 목록은 각 명령 단계에서 최신 Core coverage를 읽도록 바꿔 threaded의 먼 이동 직후 0번 복귀 실패를 해결했다.

**Source·Core 검증:** Source 검사는 실제 State 20개 생성/20개 dispose, private build scope·key remap·공유 예산·capacity 0/2·명시 KeepAlive·이전 게시 구간 보호/해제·index 자원 교체·stale/malformed 관측과 TS layout 미실행을 확인했다. /W4 /WX Core 검사는 LayoutBuilder 회귀와 실제 padded parent·가변/고정/0 높이·decimal prefix·resize·숫자 seek·retained-key 준비 재개·owner 경계·pending cache 전달·wire admission·close 예약 회수를 통과했다. 실제 Core 응답을 현재 codec으로 읽었고 request/row identity·범위·reserved·fixed flag를 검사했다. 현재 공급의 route·Block/Exclude·Snapshot Core 회귀도 통과했다.

**여러 구성의 실제 Web 검사:** 두 Source 목록을 같은 View에서 실행하며 실제 pointer·wheel, 2번 항목 내부 7px 이동, 숫자 offset 550/470px와 복귀, 공유 예산·State 재사용, 실제 부모 너비 240→200px, key 재정렬, 고정 40px와 capacity 0의 필수 visible child, 800px 이동·재생성, 명시 KeepAlive, 0 높이·빈 목록을 한 App에서 전환했다. Chrome single-worker/threaded에서 각각 State 83개 생성/83개 dispose, optional 0, close 예약 0·worker 종료를 확인했다. 원래 기본 delegate의 wrapper를 유지했다. Legacy 고정 목록의 wheel→1200px→0px 회귀도 두 profile에서 통과했다.

**목록 묶음의 Windows·설치 확인:** Windows HWND/App SDK에서 실제 OS pointer로 항목 내부 7px 이동·0번 복귀·부모 제약 240→200px·고정 40px/capacity 0·800px 이동과 복귀·빈 목록을 전환했다. 두 host 모두 State init 28/dispose 28, UIA의 실제 행·offset과 GPU 화면, 정상 Alt+F4 뒤 status 0·예약/메모리 0·worker join·App error 0을 확인했다. 현재 8개 archive를 새 소비자에 offline 설치해 TypeScript 7.0.2·NodeNext·ES2022·types=[]·skipLibCheck=false의 template/Source sliver/Core bounds/offset seek/CJK run·Material/Cupertino·SDK 선언을 검사했다. 설치 CLI doctor·Web 478/Windows 479 modules build·standalone Web pack과 위 두 profile의 같은 State 83/83 행렬을 통과했다. Android 두 ABI는 빌드만 확인했다. 물리 touchpad·scanout·성능 수락은 미검증이며 모든 임시 App·archive·설치본·browser/server·native 창은 회수했다.

**Icon·CJK 선언:** IconGlyph의 원래 private paragraph·크기·중앙 정렬·RTL mirror·label/자식 semantics 설정은 Source 모듈이 native 선언을 제공한다. Material/Cupertino Icon을 C++ 컴포넌트로 복제하지 않는다. TextStyle의 ideographic baseline은 단일·혼합 run에 보존해 Native Skia/CanvasKit TextStyle로 전달하며 잘못된 baseline/미지 flag를 거부한다. Source/codec·실제 Core parser 검사를 통과했다. 전체 text/semantics 동등성이나 Icon의 모든 옵션 수락을 뜻하지 않는다.

**마지막 실행의 실제 gallery 차단:** 마지막 검증 공급에서 원래 Gallery 전체 878 modules·original-elements를 실제 NotoSansKR·MaterialIcons·CupertinoIcons로 실행하면 Web 두 profile 모두 indexed extent·bounded capacity=2·preparation=disabled·padding과 Icon/CJK 경로를 지나 _RenderExclusiveMouseRegion에서 명시 실패한다. TS renderer fallback은 계속 거부하며 close 예약 0·worker 종료를 확인했다. 실제 catalog 첫 화면·resize·탐색·전체 controls는 아직 통과하지 않았다.

**다음 구현:** Tooltip/exclusive MouseRegion의 실제 hover/hit 정책, Wrap·flex baseline·positioned Stack 및 overlay/route/snapshot의 남은 실행 소비자를 원래 TypeScript 컴포넌트와 공통 C++ 연산에 연결한다. Paragraph/image·control/layer의 남은 중앙 설정 분기도 모듈 소유로 이관한다. 전체 semantics merge 충돌·역할/정렬·custom action과 TapRegion callback 내 정책 변경·예외의 동기 소비 계약은 남는다. W9A-06의 clipboard 외 OS 환경/font/lifecycle·VM globals·언어 의미·reload/loss와 W9A-07의 공통 target descriptor·create/dev/pack matrix도 미완료다. 엔진/App의 ABI/schema·service version·파일 hash를 계속 검증하고 전환 gate 전에 기본 CLI나 남은 renderer·구 host를 삭제하지 않는다.

아래 원래 Windows App 입력 확인 명령은 위 재개 절차에서 Source와 공급의 identity를 맞춘 뒤 사용한다. root `run:engine-v2:windows`는 전환 중인 기존 data Testbed를 실행하므로 원래 Widget 입력의 근거와 구분한다.

```powershell
$w9aEngineInputs = (Resolve-Path .\Nelyx\engine\dist).Path
node Nelyx/sdk/tooling/cli/src/main.mjs build --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9aEngineInputs
node Nelyx/sdk/tooling/cli/src/main.mjs run --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9aEngineInputs
```

**남은 판정:** 원래 API 분모 834와 서명 hash를 보존하며 `compatible=false`다. 중앙 allowlist·custom hook·동기 geometry·전체 sliver/list·디자인 전체·React/직접 Renderer 계약·SDK 전체 서비스·Testbed/Demo·제품 복구/설치 matrix는 미완료다. Linux·iOS/macOS는 **DEFERRED**, 물리/display/scanout은 **notVerified**, `performanceAccepted=false`·`resizePerformanceAccepted=false`다. 새 최소 앱의 성공을 전체 API·catalog·기본값 전환·전역 삭제 완료로 확대하지 않는다.
