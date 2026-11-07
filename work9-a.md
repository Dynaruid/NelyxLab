# work9-a — v2 엔진 중심 구조 개편과 레거시 제거 계획

작성: **2026-11-08 KST** · 상태: **검토·계획 작성 / 구현 NOT_STARTED**

이 문서는 현재 소스와 패키지·빌드·실행 경로를 검토한 **구조 개편 실행 계획**이다. 이번 작성 작업은 제품 코드 변경, 레거시 삭제, 공급 재빌드, 앱 실행을 포함하지 않는다. 기존 구현의 **PARTIAL**, 전체 API의 **compatible=false**, 물리 입력·표시의 **notVerified**, 두 성능 수락 flag의 **false**를 유지한다.

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

아래는 **2026-11-08 소스 정적 검토** 결과다. 기존 문서의 실행 기록은 과거 증거이며 이번에 재실행한 결과가 아니다.

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

모든 구현 단계는 **NOT_STARTED**다. 우선순위는 경계 확정 → 공통 의존성 분리 → 단일 frontend 수직 연결 → 기능 이관 → 제품 전환 → 실제 삭제다.

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

### 6.1 첫 구현 묶음: W9A-00–03

- [ ] `@nelyx/core/v2`·`/v2/original`·원래 framework·SDK entry의 실제 import 관계, CLI 기본값, template와 세 대표 앱의 진입점을 고정한다. 새 독립 감사 시스템 대신 현재 문서와 기존 build 입력을 사용한다.
- [ ] 하나의 App 정의가 원래 Widget을 반환하도록 API를 정한다. 별도 `OriginalRoot` marker Widget과 App 모델별 host 등록을 없앨 수 있는 bootstrap 경계를 만든다.
- [ ] `WidgetHost`에서 handle/node diff·ACK/NACK·command retry·resource upload를 추출한다. 기존 동작을 보존한 뒤 원래 BuildOwner와 연결하고, 별도 v2 Widget tree를 경유하지 않게 한다.
- [ ] Windows HWND/App SDK, Web single-worker/threaded, Android가 공유하는 부분은 함께 갱신한다. Android의 기존 partial 구현을 초기 상태로 되돌리지 않는다.
- [ ] 최소 수직 앱에서 State 갱신·Key reparent·theme 변경·버튼 callback·scroll·TextField·font/asset·정상 close를 확인한다. 이 단계 성공은 전체 API나 디자인 catalog 완료가 아니다.

**첫 묶음 완료점:** 기존 Widget의 수명은 한 번만 실행되고, 같은 session이 C++ transaction을 생성·확정하며, 구 renderer나 별도 v2 State를 사용하지 않는 최소 앱이 동작한다. 이 근거가 생긴 뒤 대량 파일 이동과 구 실행기 삭제를 시작한다.

### 6.2 Core·디자인 이관: W9A-04–05

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
- [ ] 엔진 공급은 core/provider/host/worker·protocol·supplier를, 앱 빌드는 framework/디자인/SDK 사용 코드·assets를 책임지게 한다. 엔진 도구에서 특정 Testbed UI의 필수 번들링을 제거한다.
- [ ] source identity를 실제 실행 입력과 일치시킨다. 입력 영역을 나누더라도 host/client ABI·schema·App service version·font/assets·실제 파일 hash 검증은 유지한다. 소스 이동을 이유로 실행 입력 hash를 누락하지 않는다.
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

## 11. 이번 문서 작업과 다음 시작점

**이번에 완료한 범위:** 현재 Core/v2 client/SDK·디자인 패키지·CLI·CMake/Gradle·build/supply·sample/template·기존 work9 계획을 정적으로 검토하고, 중복 구조·유지할 구현·실제 의존성을 구분해 이 계획을 작성했다.

**문서 확인:** 로컬 링크 **43개**·앵커 **1개**, W9A 단계 **13개**의 누락/중복·선행 관계, 현행 루트 npm 명령 **9개**의 존재, 표 열 수·code fence·공백을 확인했다. `git diff --check`와 새 파일에 대한 `git diff --no-index --check -- NUL work9-a.md`를 통과했다. 제품 검사 명령은 실행하지 않았다.

**구현 시작점:** W9A-00–01의 소비자/계약 대응을 현재 source로 확정한 뒤, W9A-02의 native/tooling 공통 부분 추출과 W9A-03의 단일 frontend 최소 수직 연결을 진행한다. 첫 작업부터 `src`·`sdk/native`·`skia` 전체 삭제나 `/v2` alias 일괄 교체를 시작하지 않는다.

**계속 남는 상태:** 구조 개편 구현 **NOT_STARTED**, 기존 기능 **PARTIAL**, 전체 API 호환 미완료, Linux·iOS/macOS **DEFERRED**, 물리/display/scanout **notVerified**, 두 성능 수락 flag **false**. 이번 문서 검증은 빌드·설치·앱 실행·성능 검증을 포함하지 않는다.
