# work4 — Nelyx 제품 구조 정리와 검증 구성 제거

작성일: **2026-10-10 KST**. 검토 기준: `1d0ded7` checkout의 실제 소스·package scripts·W3 중간 인계. 작성 시작 시 변경 사항은 비어 있는 미추적 `work4.md`뿐이었다. `.github/copilot-instructions.md`와 저장소 내부의 별도 `AGENTS.md`는 없었다.

**전체 작업 요청에 따라 W4-00~08 구현과 정리를 완료했다.** 아래 초기 검토·이관 기준을 적용해 SDK 제품 소스를 `Nelyx/` 안에 모으고 W1~W3 검증 전용 코드·구성·결과 및 `Nelyx/docs/`를 제거했다. 수행 범위와 미검증 항목은 7절에 기록했다. 검증 자료를 다른 폴더에 복제하거나 W4용 검증 체계를 남기지 않았다.

## 1. 목표와 범위

- SDK의 공통 로직, 플랫폼 수명 관리, native host 연결, 공급용 patch, CLI·Metro·앱 생성 템플릿은 모두 `Nelyx/` 안에 둔다.
- 저장소 루트에는 workspace 연결·간단한 개발 명령·README·작업계획을, `sample/`에는 SDK를 소비하는 예제 앱을 둔다.
- 검증용 probe/fixture/mock/test/consumer harness, 결과 수집·비교·보존·checkpoint 생성 도구, 관련 설정과 의존성을 제거한다.
- SDK·Skia 제품 소스에 섞인 테스트 API·실패 주입·강제 지연·검증용 계측도 제거한다. 외부 검증 폴더를 없애는 것으로 끝내지 않는다.
- `Nelyx/docs/`는 추적·미추적·ignored 내용을 포함해 최종적으로 없앤다. 필요한 제품 사용법은 기존 README에 짧게 반영하고 제3자 license/notice는 제품 경로로 옮긴다.
- 실제 build/prepare/bundle/codegen/dev/run/pack 기능과 실행에 필요한 ABI·cohort·artifact 무결성·자원 수명 검사는 유지한다.
- W3의 새 기능·전체 qualification·CI/release 확장은 이번 구조 정리와 분리한다. Deno 경로를 되살리거나 RN·Skia 버전을 함께 올리지 않는다.

여기서 제거할 **검증 구성**은 별도 테스트와 실험을 운영하기 위한 구성이다. native 입력 hash/ABI 확인, 잘못된 플랫폼 조합 거부, 종료 전 drain 확인 등 정상 제품 동작에 포함된 방어 로직은 삭제 대상이 아니다. TypeScript·native compiler의 오류 검사도 일반 빌드 기능으로 유지한다.

## 2. 실제 검토 결과

파일 수는 Git 추적 파일 기준이다. 로컬 캐시·결과의 파일 수나 삭제 용량을 뜻하지 않는다.

| 영역 | 확인한 문제 | W4 처리 |
| --- | --- | --- |
| `tools/nelyx/` 453개, 그중 `work3/` 411개 | 실험 스크립트뿐 아니라 실제 RN runtime overlay·native host/종료 구현·공급 패키지 생성 코드가 섞여 있다. | 제품에 필요한 부분을 먼저 이관한 뒤 `tools/nelyx/`를 제거한다. |
| `tools/nelyx/work3/linux-runtime/` | `prepare-rnl.mjs`가 `InitializeCore.js`, `CoreRuntime.h`, `CoreDevelopment.h`, `CoreWebSockets.h`, HTTP loader, Metro/편집·View adapter 등을 실제 RNL 공급 패키지에 복사한다. | runtime overlay와 공급 patch를 정식 제품 소스로 만든다. 폴더 전체를 검증 코드로 간주하지 않는다. |
| `tools/nelyx/work3/windows-drain/` 및 ignored artifacts | v60의 `BeforeUnload.h`, `RuntimeUnloadAbi.h`, `UnloadAction.h`, `WindowsAppHost.h`와 RNW Core patch가 private producer/consumer에 있다. | 필요한 변경 원본·patch·protocol을 추적 가능한 `Nelyx/` 제품 경로에 확보한다. 기본 제품과 private 변경의 상태를 구분한다. |
| `windows-surface/`, `linux-surface/`, `linux-runtime/*Probe*` | 실험용 surface·host와 제품으로 발전한 구현이 혼재한다. 이미 제품 package에 옮겨진 구현도 있다. | 현행 `skia/packages/rn/native/`와 대조해 중복 실험본은 삭제하고 아직 필요한 구현만 추출한다. |
| `Nelyx/skia/packages/rn/native/windows/WindowsAppHost.h`, Linux host 및 sample native entry | 창·앱 종료·개발 bundle 선택 같은 SDK 앱 수명 책임이 Skia 패키지나 앱 복제 코드에 섞여 있다. | 앱 구성 책임은 SDK로, GPU/JSI/component 책임은 Skia로 나눈다. runner는 설치·등록·옵션 전달을 담당한다. |
| `tools/nelyx/build-sdk.mjs`, `checks/finalize-sdk.mjs`, `providers.mjs`, `skia/prepare-native.mjs` | 현행 core/SDK/Skia package build가 `Nelyx/` 밖의 파일을 호출한다. `providers.mjs`는 생성과 검사를 함께 수행한다. | 빌드·생성 기능은 내부로 이관하고 별도 audit/negative-control 기능은 제거한다. |
| `templates/nelyx-app/`, `tools/nelyx/templates/create-app.mjs` | 제품 앱 템플릿과 생성기가 SDK 밖에 있고 생성기가 저장소 루트의 template를 읽는다. sync/create가 `tests/`도 복제한다. | CLI package 안에 template와 생성기를 함께 넣고 설치된 package 기준으로 읽는다. 테스트 복제를 제거한다. |
| runner 준비·native 공급 | Apple 준비가 `Nelyx/.cache/work3-apple-supply-v1`에 기대고, `apple-default-templates.json`은 retained artifacts 경로를 원본으로 기록한다. Windows/Linux 공급 생성도 W3 도구·입력에 의존한다. | 정식 lock·원본 소스·공급 recipe와 일반 cache 경로로 연결한다. artifacts 원본 기록이 실제 읽기 의존인지도 구분한다. |
| `Nelyx/eng/` 53개, `Nelyx/tests/` 34개 | W1~W3 probe·test·receipt 작업과 patch/build 기능이 혼재한다. | 제품 build/공급에 필요한 소수 기능만 남기고 검증 전용 구성은 제거한다. |
| `Nelyx/docs/` 98개 | 구조 문서·진행 보고서·검증 결과 외에 `research/licenses/`의 실제 제3자 license도 들어 있다. ignored validation/research도 있다. | license를 먼저 옮긴 뒤 디렉터리 전체를 제거한다. |
| root scripts·devDependencies | `check`가 import/provider/source audit, contracts, runtime, Metro 및 tarball 소비 검사를 연쇄 실행한다. 테스트 관련 package와 workspace도 있다. | 제품 개발 명령으로 축소하고 lock·workspace·README를 같이 정리한다. |
| sample/template `tests/runtime.ts` 및 native 진단 | 별도 논리 검사와 probe 구성이 소비 앱·템플릿에 포함된다. | 테스트·진단 전용 화면/명령/설정을 제거하고 실제 예제 화면·자산과 필요한 runner는 유지한다. |
| SDK·Skia 제품 소스 내부 | RN SDK의 테스트 메서드·실패 주입 Proxy, Web retirement 강제 정지 API, native 테스트 fault 분기가 실제 제품 source에 남아 있다. | 아래 내부 코드 제거 목록을 적용하고 public type·JSI·native source·생성 patch·호출부까지 함께 정리한다. |

검토 당시 `.github/`에 현행 추적 workflow는 없었다. 과거 W3의 CI 추가 계획을 이번 작업에서 새로 구현하지 않는다.

### W3에서 잃지 않아야 할 상태

- W3 전체는 **PARTIAL**이다. 기본 제품·다섯 package archive·Windows supplier는 v58 기준이고, v60 Core drain/reload 변경은 private source/consumer에서만 실행됐다.
- v60 source의 위치를 정리했다고 기본 제품에 적용·배포됐다고 기록하지 않는다. 기본 제품 채택은 supplier 계약과 소비 경로를 바꾸는 별도 기능 작업이다.
- v59 stock RNW reload 실패와 전체 SDK/GPU startup/fatal/forced teardown·loss/recovery 등의 미완료 상태는 구조 정리로 해결되지 않는다.
- Apple은 코드 구성 범위이며 native build/runtime/Metal/signing은 미검증이다. Linux GPU 실행도 기존 사용자 범위에서 제외돼 있다. Android 최신 변경의 ARM64/Release 재빌드와 physical IME/reader 등도 별도다.

위 상태와 이 문서의 이관 목록으로 W4 착수에 필요한 요점을 남긴다. 삭제할 W3 보고서·checkpoint를 계속 읽어야만 W4를 진행할 수 있는 구조를 남기지 않는다.

## 3. 목표 구조와 책임

기존 `@nelyx/core`, `@nelyx/sdk`, `@nelyx/skia-rn`, `@nelyx/skia-web`, `@nelyx/metro`, `@nelyx/cli`의 package 이름과 직접 module export는 유지한다. 폴더 이동 때문에 새 package나 barrel/re-export 계층을 만들지 않는다.

```text
NelyxLab/
├─ package.json / package-lock.json        # workspace 연결·개발 명령
├─ README.md / work3.md / work4.md
├─ Nelyx/
│  ├─ package.json / src/                  # @nelyx/core: 플랫폼 독립 계약·UI·수명
│  ├─ eng/                                # 공통 build·package 준비에 필요한 도구
│  ├─ upstream/                           # exact pin·원본 출처·적용 patch
│  ├─ licenses/                           # 공통 제3자 고지, 필요한 package에도 포함
│  ├─ sdk/
│  │  ├─ src/                             # runtime·backends·platforms
│  │  ├─ native/
│  │  │  ├─ windows/                       # RNW 앱 host·종료·reload 연결
│  │  │  ├─ linux/                         # RNL 앱 host·개발 source·종료 연결
│  │  │  └─ apple/                         # 필요한 공통 Apple host 연결
│  │  ├─ providers/                       # 제품 descriptor·schema
│  │  └─ tooling/
│  │     ├─ metro/                        # @nelyx/metro
│  │     └─ cli/                          # @nelyx/cli·앱 생성·runner 준비
│  │        ├─ src/
│  │        └─ templates/nelyx-app/        # 배포 가능한 소비 앱 템플릿
│  └─ skia/
│     ├─ native/                          # 공통 renderer·GPU·text 구현
│     ├─ packages/rn/                     # RN JSI·native component·surface
│     ├─ packages/web/                    # Web renderer
│     ├─ eng/                             # 실제 native artifact/source build
│     └─ vendor/                          # 공급 lock·license·출처
└─ sample/nelyx-testbed-app/
   ├─ src/                               # 공유 main()·앱 화면
   └─ <platform>/runner/ 및 native project # 독립 설치·등록·앱별 설정
```

`Nelyx/docs/`, `Nelyx/tests/`, sample/template의 `tests/`, `tools/nelyx/`, 루트 `templates/nelyx-app/`는 최종 구조에서 제거한다. 예시 tree의 Apple native 경로는 공통 host 소스를 분리할 필요가 있을 때 사용하며 빈 계층을 미리 만들지 않는다.

의존 방향은 `sample/생성 앱 → SDK 플랫폼 API·native host → Skia/RN`으로 맞춘다. core는 SDK/RN/OS를 import하지 않고, Skia는 SDK 앱 정책을 import하지 않는다. 소비 앱의 Metro/Babel/Gradle/Xcode/MSBuild/CMake 설정과 앱 등록 entry는 해당 runner에 유지한다. SDK가 앱 시작 시 개발 서버·다운로드·빌드를 실행하지 않는다.

RNL 자체 runtime을 수정하는 overlay는 `Nelyx/upstream/overlays/react-native-linux/`, upstream 수정 patch는 `Nelyx/upstream/patches/`에 둔다. SDK 앱 host와 RN 공급 source를 구분해 관리하며 동일 구현을 두 곳에서 편집하지 않는다.

## 4. 이관·삭제 기준

### 먼저 이관할 제품 구성

| 현재 구성 | 목적지·처리 |
| --- | --- |
| `tools/nelyx/build-sdk.mjs` | `Nelyx/eng/build-packages.mjs`. 기존 TS emit·declaration `.js` 변환·source map·staged promotion을 유지한다. `finalize-sdk.mjs`의 필요한 출력 확인은 빌드 내부로 합친다. |
| `providers.mjs`, `generate-bootstrap.mjs` | descriptor/schema 생성은 `Nelyx/eng/`의 생성 기능으로, 소비 앱 bootstrap 생성은 CLI에 통합한다. 독립 검증 CLI·중복 생성 경로는 남기지 않는다. |
| `tools/nelyx/skia/prepare-native.mjs` | `Nelyx/skia/eng/`에서 공통 native source와 공급 준비를 담당한다. `audit.mjs`와 검증 receipt 기능은 제거한다. |
| `create-app.mjs`, 템플릿, runner 준비 코드 | `Nelyx/sdk/tooling/cli/`의 직접 module·명령·package assets로 이관한다. template sync는 필요한 경우 개발용 `Nelyx/eng/` 기능 하나로 유지한다. |
| RNL runtime overlay·package layout/runtime patch·prepare/pack 기능 | `Nelyx/upstream/overlays/react-native-linux/`, `upstream/patches/`와 CLI의 공급 준비 기능으로 정리한다. fixture 생성·조작·증거 수집은 가져오지 않는다. |
| 현행 `WindowsAppHost.h`, 앱 공통 development/shutdown helper | `Nelyx/sdk/native/<target>/`로 책임을 옮긴다. Skia device/session/surface 구현은 현행 Skia package에 둔다. SDK native headers·build targets를 package에 포함한다. |
| v60 private RNW Core 변경 | 원본 pin과 최종 source diff를 `Nelyx/upstream/patches/`에, SDK 소유 ABI/host 부분을 `sdk/native/windows/`에 확보한다. stock/v60 적용 상태를 기존 README에 명시하고 자동 채택하지 않는다. |
| `docs/research/licenses/`의 필요한 license/notice | `Nelyx/licenses/` 및 해당 배포 package의 `licenses/`·notice에 포함한다. 기존 Skia/RN/Linux/Apple template 고지도 유지한다. |

제품 코드가 이미 `Nelyx/`에 이관돼 있으면 실험 원본을 다시 복사하지 않는다. `W3*`·`*Probe*` 이름의 파일은 실제 소비 관계를 확인하고 필요한 로직만 최종 구현에 합친다.

### SDK·Skia 제품 소스에 섞인 임시 검증 코드

2026-10-10 추가 source 검토에서 다음 항목을 확인했다. **제품 폴더 안에 있다는 이유로 유지하지 않으며, 이관할 코드에도 같은 기준을 적용한다.** 아래의 명백한 테스트 기능은 제거 대상으로 확정하고, 진단·상태 조회는 정상 실행 의존성을 확인해 검증 전용 부분을 제거한다.

| 실제 source·기능 | 처리 |
| --- | --- |
| `sdk/src/backends/react-native/surface.tsx`의 `testReservations`, `testDuplicateSubmission`, `testAssetTransport` | 예약 거부·이중 제출 실험, SHA-256 테스트 vector·비정상 입력·oversize stream 실험 구현과 public interface를 제거한다. 실제 자산 hash/byte limit 검사와 native 제출의 중복 거부 자체는 유지한다. |
| 같은 파일의 `recordingFault`, `injectRecordingFault`, `NELYX_INJECTED_*`, recording context `Proxy` | replay/finish 예외를 인위적으로 발생시키는 상태·분기·wrapper를 제거하고 정상 context/paint 경로를 직접 사용한다. 실제 오류의 cleanup과 전파는 유지한다. |
| RN `pauseConsumer` → `skia/packages/rn/src/renderer.ts` → `cpp/api/JsiSkGraphiteContext.h`의 `nelyxPause` → `cpp/rnskia/RNSkGraphiteTarget.h` | 검증용 consumer 정지 API, JSI 등록·선언·정지 상태와 그 분기를 제거한다. 실제 앱 visibility·backpressure·GPU retirement 처리는 유지한다. |
| `sdk/src/platforms/web/application.ts`, `skia/packages/web/src/library.ts`의 `pauseRetirement`·`paused` 분기 | fence retirement를 강제로 지연시키는 public API와 내부 분기를 제거한다. 정상 fence poll·timeout·pending lease·close drain은 유지한다. |
| `sdk/src/backends/browser/services.ts`의 `webHostDiagnostics`, Web library의 `webNativeDiagnostics`·전역 `totals` | probe 결과 집계를 위한 export·전역 증감 계측은 제거한다. 실제 host/자원 소유권을 가진 Map·Set·dispose 코드는 유지한다. 일반 renderer 오류 진단은 별도로 구분한다. |
| `sdk/src/platforms/web/surface.tsx`의 `data-testid` | 자동화 전용 속성을 제거한다. 실제 TextInput·button과 접근성/편집 기능은 유지한다. |
| `skia/native/CMakeLists.txt`, `platforms/vulkan/device.{h,cpp}`, `adapters/cabi/` | `NELYX_VULKAN_TEST_FAULTS`, `testFault`, `nelyx_skia_test_fault`, `observedCompletion` 주입 코드·호출을 제거한다. 실제 Vulkan 결과 확인·device loss/timeout 처리에는 손대지 않는다. |
| native CMake의 `NELYX_WIN32_IMPORT_PROBE`, `NELYX_GPU_CONTEXT_PROBE`와 `skia/native/tests/` | 제품 빌드 파일에 섞인 probe target·옵션과 해당 테스트 source를 제거한다. |
| `skia/packages/rn/native/linux/RNSkLinuxHost.h`의 `MetadataOnly`와 관련 경로 | 검증 전용 host mode·우회 초기화·대역 연결을 제거한다. hardware 미준비·다른 window system/세대·closing host를 거부하는 제품 gate는 유지한다. |
| SDK의 diagnostics 객체·asset 통계·snapshot/trace·host status | probe에서만 쓰는 공개 API·snapshot 복사·계측을 추적해 제거한다. 현재 `surface.tsx`는 실제 visibility도 `diagnostics.setVisible`로 전달하므로 해당 동작을 내부 owner/renderer 경로로 옮긴 뒤 검증 객체를 정리한다. 이름만 보고 객체 전체를 삭제하지 않는다. |
| `sdk/src/runtime/providers.ts` 및 생성 descriptor/schema의 검증 진행 문구 | 회차별 receipt·실험 결과·사용자 검증 제외 사유를 제품 metadata에서 걷어내고 현재 기능·지원 제약만 간단히 표현한다. 실제 capability·미검증 상태·cohort/ABI 호환성 계약은 유지한다. |

Android sample/template의 `runner/App.tsx`는 위 테스트 메서드와 실패 주입을 실제 호출한다. 해당 검증 버튼·batch 실행·PASS 결과 출력·hook·global bridge도 함께 제거하고 기본 앱 표시/편집/interaction 예제를 유지한다. Web 및 다른 target의 probe 전용 호출도 같은 방식으로 추적한다.

`Nelyx/upstream/patches/0002-JsiSkGraphiteContext.patch`, `0002-RNSkGraphiteTarget.patch`, `Nelyx/skia/upstream/nelyx-native.patch`와 과거 patch 생성기에도 `nelyxPause`가 들어 있다. 정식 source만 고쳐서 다음 prepare/build가 테스트 코드를 다시 넣지 않도록 잔존 patch·manifest·생성 입력도 함께 갱신한다. generated native 복사본·dist JS/선언·tarball에 삭제 API가 남지 않게 재생성한다.

임시 API를 `__DEV__`·새 compile flag 뒤에 숨기거나 diagnostics라는 이름으로 바꿔 유지하지 않는다. 반면 upstream Skia/Dawn의 원본 header에 포함된 testing 선언·주석은 이번 Nelyx 임시 코드와 구분하고 문자열 일괄 삭제를 하지 않는다.

### 제거할 구성

| 대상 | 제거 범위·주의점 |
| --- | --- |
| `tools/nelyx/work3/` 전체 | 제품 source/patch/공급 recipe 추출 이후 제거한다. prepare/build라는 이름이어도 실험·대조 앱 전용이면 삭제한다. |
| `tools/nelyx/`의 나머지 검증 도구 | `test-*`, `checks/imports.mjs`, `templates/consume*`, `verify-*`, baseline/evidence/비교·보존 도구와 검증 전용 package를 제거한다. 제품 기능을 옮긴 뒤 이 루트 자체를 없앤다. |
| `Nelyx/eng/`의 과거 검증 구성 | probe/validate/verify/check/record/retain/promote/summarize 및 실험용 fetch/patch/build를 제거한다. 이름 대신 현행 제품 build 의존성을 기준으로 필요한 기능만 위 이관 목록에 남긴다. |
| `Nelyx/tests/`, sample/template `tests/` | contracts·fixtures·native harness·`runtime.ts` 및 참조 script/tsconfig를 모두 제거한다. 새 테스트 디렉터리로 이사시키지 않는다. |
| `Nelyx/skia/eng/`의 검증 구성 | `test-artifacts.py`, Graphite/Dawn smoke source·CMake·실행 스크립트와 `source-build/retired-web/`를 제거한다. 공급 준비·실제 module/source build recipe·lock은 유지한다. |
| `Nelyx/docs/` 전체 | license/필수 사용법 반영 후 tracked/ignored 내용과 디렉터리를 제거한다. report/checkpoint/index를 다른 docs/history 트리로 복제하지 않는다. |
| W1~W3 로컬 결과·실험 cache | `Nelyx/artifacts/` 등의 해당 실험 출력·실패 사본·retained consumer·수집 도구 사본을 제거한다. 제품 입력을 사용하는 참조를 먼저 해소한다. 일반 rebuild cache는 제품용 cache 경로로 통일한다. |
| package/workspace/설정 | `@nelyx/tools` workspace, 테스트 명령·alias·전용 dependency, 검증 전용 tsconfig/Dockerfile/환경 옵션을 제거하고 lock을 갱신한다. |

`sample/assets/probe.png`처럼 이름에 probe가 있어도 예제 앱이 실제 사용하는 자산은 사용처에 맞게 정리한다. 예제 자체를 없애지 않는다. 반대로 MetadataOnly/대역 renderer·fault 주입·캡처·별도 inspector 서버 등 검증을 위한 경로는 현행 제품에서 쓰지 않는 부분까지 정리한다. 정상 개발 모드와 제품 오류 진단은 유지한다.

루트 `history/`, `reference/`, 임의의 `%TEMP%` consumer·다른 프로젝트와 root `node_modules`는 일괄 삭제하지 않는다. 저장소 내 W1~W3 출력도 실행 시 실제 경로를 확정해 목록을 먼저 표시한다. 재귀 삭제/이동은 workspace 경계와 링크를 확인하고 명시한 경로에만 적용한다. 임시 정리 도구를 만들 경우 preview와 `-Execute`를 분리하고 작업 후 제거하며, 별도 audit 저장 체계를 만들지 않는다.

## 5. 실행 작업

### W4-00 — 현행 의존성과 삭제 범위 확정

- [x] 현재 diff를 확인하고 이 문서의 제품 이관·검증 삭제 목록을 실제 참조에 맞게 확정한다.
- [x] package script, JS import, C++ include, CMake/MSBuild/Pods, template 생성·copy, supplier manifest가 읽는 source를 추적한다. 생성 파일의 출처 설명과 실제 실행 의존성을 구분한다.
- [x] ignored artifacts의 v60 고유 변경·Windows/Linux 공급 입력·Apple template/notice를 확인한다. 재생성 불가능한 제품 source가 결과 폴더에만 있지 않도록 이관 목록에 추가한다.
- [x] 위 SDK 내부 임시 코드 목록의 호출부·native/JSI·patch·생성 입력을 추적한다. 옮길 제품 source에 테스트 기능이 따라가지 않도록 이관과 정리를 함께 반영한다.
- [x] 삭제할 로컬 출력 경로를 preview한다. 위 결과는 이 문서의 목록만 보완하며 receipt/index/checkpoint 파일을 새로 만들지 않는다.

완료 기준: 각 잔존 제품 입력의 owner와 정식 source/공급 경로가 정해지고, 검증 폴더 전체 삭제가 필요한 제품 구현을 잃게 하지 않는다.

### W4-01 — 공통 build·생성 도구 내부화

- [x] core/SDK/Skia build와 native source 준비를 `Nelyx/eng/`, `Nelyx/skia/eng/`로 옮긴다. 각 package script의 상대 경로를 고친다.
- [x] TS source `.ts` import와 emitted ESM/선언 `.js` 경로·source map 처리를 보존한다. 중복 output checker는 빌드 내부로 합친다.
- [x] provider descriptor/schema 생성과 bootstrap 생성을 제품 build/CLI 경로로 정리한다. 생성 결과의 exact version·profile·capability 계약은 유지한다.
- [x] 루트 build 명령이 `Nelyx/` 내부 기능만 호출하도록 바꾼다.

완료 기준: core/SDK/Skia package를 만드는 데 `tools/nelyx/`가 필요하지 않다.

### W4-02 — Linux runtime·native host 제품화

- [x] `linux-runtime/`의 실제 RNL 공급 overlay와 정식 patch를 내부화한다. `prepare-rnl.mjs`·`pack-rnl.mjs`의 필요한 기능을 하나의 공급 경로로 통합한다.
- [x] GTK 앱 수명·shutdown signal·개발 bundle 선택 중 공통 로직은 SDK native Linux에 두고 sample/template는 앱 이름·window system·자산 등 옵션을 전달한다.
- [x] RN bootstrap/HTTP/Metro/편집/Fast Refresh/full reload에 필요한 source가 정식 package에 포함되도록 한다. metadata/probe/대조 앱 생성과 관측 서버는 제거한다.
- [x] CMake, upstream patch manifest, CLI native-input 경로가 새 source를 사용하게 한다. Skia component/GPU 소스는 Skia가 소유한다.

완료 기준: RNL 공급과 앱 host 구성이 W3 폴더·retained probe 앱을 원본으로 사용하지 않는다. Linux GPU qualification은 추가하지 않는다.

### W4-03 — Windows·Apple host 책임 정리

- [x] Windows 기본 제품 host와 v60 private source를 대조하고 기본 host·공통 개발 source/종료 연결을 SDK native Windows로 옮긴다.
- [x] v60 Core source 변경과 ABI/COM/app headers를 ignored output 밖의 추적 source/patch로 확보한다. 임시 consumer override를 정식 제품 적용으로 취급하지 않는다.
- [x] Windows Skia device/session/renderer/component와 SDK 앱 정책 사이 include·build 경계를 정리한다. public package를 통한 native 경로만 사용한다.
- [x] Apple source patch·runtime hook·template 원본은 정식 pin/source로 공급한다. CLI의 제품 patch 적용 기능은 유지하고 별도 portable fixture·검증 도구는 제거한다.
- [x] SDK `files`·native build targets와 package 의존성을 갱신한다. Skia가 SDK를 역참조하는 순환 의존성을 만들지 않는다.

완료 기준: 앱 수명 구현이 SDK에 있고 GPU 구현이 Skia에 있으며, v60 적용 여부와 미완료 기능이 짧은 README에서 확인된다.

### W4-04 — CLI·템플릿·sample 연결 통일

- [x] root template와 create 기능을 CLI package 내부로 옮기고 `package.json`의 `files`·직접 export/명령을 갱신한다. template는 설치된 CLI 위치에서 읽는다.
- [x] runner 준비·bootstrap·local tarball 공급 기능을 CLI에서 사용하게 한다. sample의 `../../tools/nelyx/...` 호출을 없앤다.
- [x] template와 생성 앱의 root는 공유 `src/index.ts`의 `main()` 및 target runner 연결을 유지하고 runtime dependency는 독립 runner가 소유하게 한다.
- [x] sync/create에서 `tests/`, 검증 scripts·receipt·generated 진단 설정 복제를 제거한다. 정상 앱 entry/native registration·asset·license는 유지한다.
- [x] 새 구조에서 sample과 template가 동일한 SDK API/native build 계약을 사용하게 한다.

완료 기준: 저장소 밖에 설치한 CLI도 자신의 package assets로 앱을 생성하며, sample/template에 SDK 구현 복사본이나 저장소 private 경로가 없다.

### W4-05 — native 공급을 검증 artifacts에서 분리

- [x] Windows native library/ICU/Hermes/Core, Linux RNL/Skia/module, Apple supplier의 현행 입력을 정식 lock·recipe·외부 공급 위치와 연결한다.
- [x] 재생성 가능한 출력은 일반 `.cache/native/<target>/` 등 owner별 cache로 정리한다. 소비 앱이 준비한 입력은 기존 `.nelyx/` 소유 경로에 둔다.
- [x] 현재 외부 공급으로 다시 받을 수 없는 필수 binary가 있으면 출처·license·hash를 갖춘 명시적 제품 공급 입력으로 먼저 확보한다. 마지막 사본을 지워서 build를 깨뜨리지 않는다.
- [x] 정상 build/run/pack이 W3 artifacts·Temp consumer·검증 patcher를 탐색하지 않게 한다. 자동 다운로드/공급 확장은 필요한 최소 범위만 구현한다.
- [x] obsolete Deno/W1/W2 공급·retired renderer·검증 전용 artifact 목록은 현행 소비 여부를 확인하고 제거한다.

완료 기준: 검증 출력 전체를 삭제한 뒤에도 정상 공급 경로가 남는다. exact pin/hash/ABI·최소 toolchain 계약은 보존된다.

### W4-06 — 검증 source·설정·dependency 제거

- [x] 4절의 SDK 내부 테스트 API·recording 실패 주입 Proxy·consumer/retirement 강제 정지·검증 전용 전역 계측·DOM test 속성을 제거한다.
- [x] native fault 주입·C ABI 테스트 export·CMake probe/test 옵션·`skia/native/tests/`와 Linux MetadataOnly 검증 경로를 제거한다.
- [x] sample/template의 테스트 버튼·명령·global hook과 public TS interface·JSI 등록·native 선언을 함께 정리한다. 정상 visibility·native status·실제 오류 처리를 내부 제품 경로에 유지한다.
- [x] 남는 patch·생성 입력·manifest를 갱신하고 generated source·dist·선언·공급 package를 새 source에서 생성한다. 재빌드로 삭제 코드가 복원되지 않게 한다.
- [x] 4절 삭제 목록의 도구·tests·fixtures·smoke·결과 수집 구성을 제거한다. 제품으로 이관한 파일은 복제본을 남기지 않는다.
- [x] root `test:*`, audit/consumer용 `check:*`와 broad test-chain `check`, sample/template `test:runtime`를 제거한다. 단순 compiler typecheck는 필요한 package/runner에서 유지한다.
- [x] root workspace에서 `tools/nelyx`를 제거하고 lock을 정상 갱신한다. Playwright·tsx·Ajv 등은 실제 잔존 build/runtime 사용처를 확인한 후 검증 전용일 때만 제거한다.
- [x] 삭제 구성의 TS include/exclude·경로·동적 import·CMake/MSBuild/Pods·환경 변수·package files 참조를 제거한다.
- [x] `.gitignore`의 docs/validation 전용 예외·obsolete 경로를 정리하고 생성 output/cache ignore는 유지한다.

완료 기준: SDK/Skia 제품 소스·공개 API·native symbol·생성 입력에서도 임시 검증 코드가 제거되고 제품 개발 명령이 남는다. 이름을 바꾼 검증 도구·빈 wrapper·숨겨 둔 테스트 flag도 남기지 않는다.

### W4-07 — docs·실험 출력 제거와 README 정리

- [x] `docs/research/licenses/`의 필요한 license/notice를 제품 경로에 반영하고 package에 누락되지 않게 한다.
- [x] root·core·SDK·Skia·CLI·Metro·runner README를 새 폴더/명령·제약에 맞게 줄인다. 진행 회차별 증거 링크와 오래된 Deno 실행 안내를 없앤다.
- [x] `Nelyx/docs/` 전체와 확정된 W1~W3 실험 출력·cache를 제거한다. 이미 제품화한 고유 source·공급 입력이 삭제 목록에 남지 않았는지 확인한다.
- [x] 루트 `work3.md`에 W4로 구조 정리가 넘어갔음을 표시한다. 과거 링크는 삭제된 기록의 참조임을 밝히며 현재 사용법으로 안내하지 않는다. 기존 `history/`는 일괄 수정하지 않는다.
- [x] root `tools/nelyx/`, `templates/nelyx-app/`의 이관 후 잔여물을 제거하고 빈 상위 폴더도 정리한다.

완료 기준: `Nelyx/docs/`가 없고 현행 사용 문서·package가 삭제한 경로를 요구하지 않는다. 문서 트리를 다른 이름으로 재생성하지 않는다.

### W4-08 — 정리된 제품의 최소 확인과 완료 기록

- [x] diff와 잔존 참조를 확인한다. 제품 source/build/template에는 `tools/nelyx`, root template, `Nelyx/docs`, W3 artifacts/Temp 경로 의존성이 없어야 한다.
- [x] 정상 package build와 필요한 compiler typecheck를 수행한다. 생성 JS/선언/native headers·template·license가 package에 포함되는지 확인한다.
- [x] 삭제한 테스트 API·fault 분기·probe target·global hook이 source·patch·생성 JS/선언·package에 남거나 재생성되지 않는지 확인한다. 실제 visibility·자산 확인·GPU 완료·종료 경로도 변경 범위에 맞게 확인한다.
- [x] 한 번의 임시 외부 소비로 CLI의 앱 생성·설치·선택 target bundle/build를 확인한다. 기존 6-target consumer harness를 복원하지 않는다.
- [x] native host/include/공급 경로가 바뀐 Windows와 사용 가능한 Android/Web를 변경 범위에 맞게 실행한다. Linux는 가능한 native build 범위, Apple은 코드 구성 범위를 유지한다.
- [x] 사용한 임시 확인 파일은 제거하고 결과·미수행 항목·남은 기능 제약을 이 문서에 짧게 기록한다. JSON receipt/index/checkpoint·별도 report를 만들지 않는다.

완료 기준: 구조 정리와 검증 구성 제거가 끝났으며 수행한 build/실행 범위와 미검증 범위가 구분된다. W4 완료를 W3 전체 기능·지원 완료로 확대하지 않는다.

## 6. 실행 순서와 최종 완료 조건

실행 순서는 **W4-00 → W4-01 → W4-02/03 → W4-04 → W4-05 → W4-06 → W4-07 → W4-08**이다. 제품 소스·공급 입력·license의 정식 위치를 확보한 다음 검증 폴더를 삭제한다. 실제 구현에서는 관련 package 참조와 이관을 함께 바꿔 중간 상태의 깨진 경로가 누적되지 않게 한다.

- [x] SDK 제품 로직·공급 patch·CLI/Metro·template의 원본이 모두 `Nelyx/` 안에 있고 `sample/`은 SDK 소비 앱이다.
- [x] core/SDK/Skia의 책임과 직접 module export가 유지되며 앱 수명 책임이 Skia나 실험 도구에 남지 않는다.
- [x] `tools/nelyx/`, root `templates/nelyx-app/`, `Nelyx/tests/`, sample/template `tests/`가 제거됐다.
- [x] W1~W3 probe/fixture/test/audit/consumer/receipt/checkpoint 구성과 관련 명령·dependency·설정이 제거됐다.
- [x] SDK·Skia 내부 테스트 메서드·실패 주입·강제 정지·검증 전용 계측과 public type/JSI/native export·patch 잔여물이 제거됐다. 실제 visibility·ABI·무결성·실패 cleanup·GPU drain 기능은 유지된다.
- [x] `Nelyx/docs/`가 tracked/ignored 내용까지 제거됐고 필요한 license·사용법이 제품 경로에 반영됐다.
- [x] 제품 build/prepare/dev/run/pack은 W3 실험 출력 없이 정식 source·lock·공급 입력으로 동작한다. 실행 중 ABI·무결성·drain 검사는 유지된다.
- [x] 기존 public package 이름·플랫폼 정책·공유 `src/index.ts`의 `main()`·독립 runner 구조가 유지되고 barrel·새 검증 framework가 없다.
- [x] 최소 확인 결과와 미수행 범위가 이 문서에 기록됐으며 기존 W3 기능·qualification 공백이 해결된 것으로 오인되지 않는다.

현재 상태: **W4-00~08 완료 / W3 전체 기능은 PARTIAL / 플랫폼 qualification은 notVerified**.

## 7. 실행 결과

제품 build·provider 생성·native source 준비는 `Nelyx/eng/`와 `Nelyx/skia/eng/`로, 앱 생성·bootstrap·runner archive 공급과 RNL prepare/pack은 CLI로 옮겼다. 템플릿은 설치된 CLI의 package assets를 읽으며 root는 공유 `src/index.ts`의 `main()`과 config를, 독립 runner는 runtime dependency와 native project를 소유한다. Windows/Linux 앱 host·development/shutdown 연결과 Apple runtime teardown state는 SDK native 경로에 있다. GPU/JSI/component는 Skia에 유지했다.

SDK·Skia의 테스트 메서드·recording 실패 주입·consumer/retirement 강제 정지·snapshot/trace/전역 통계·native fault/probe target·대조 renderer 경로와 sample 검증 UI/hook을 제거했다. native `nelyxStats`의 실제 close drain에 필요한 소유권 상태, ABI/cohort/hash/byte-limit 검사, generation gate, GPU retirement와 오류 cleanup은 유지했다. patch와 manifest, generated native source·dist·선언·archive도 갱신했다. RN Web 반환 type을 명시해 추론된 선언에 `.tsx` source 경로가 남던 문제도 고쳤다.

`tools/nelyx/`, root template, tests, `Nelyx/docs/`, artifacts와 확인된 W1~W3 출력·캐시·구 공급물을 삭제했다. license/notice는 `Nelyx/licenses/` 및 배포 package에 보존했다. Windows 필수 재사용 binary의 마지막 사본은 hash/provenance lock과 함께 `Nelyx/skia/vendor/inputs/windows-x64/`에 명시적 로컬 공급 입력으로 보존했으며, 현재 binding/core는 새 source에서 빌드했다. Apple/RNL/Linux 공급은 정식 pin·recipe와 일반 native cache로 연결했다. v60 private RNW 변경은 source patch·ABI·SDK headers로 보존했으며 기본 stock Core에 채택하지 않았다.

| 확인 범위 | 결과 |
| --- | --- |
| 공통 package build·compiler | `npm run build:sdk`, `check:types`, `check:metro-types`, `check:cli-types`, template sync 통과. RN 선언 수정 후 해당 package도 다시 빌드했다. |
| 소스·배포 내용 | 현행 source·patch·emitted JS/선언·6종 package archive에서 삭제 API/구 경로 잔여물 없음. `.js` 선언 import와 source map 원본, SDK native headers·CLI template·license 포함을 확인했다. 최종 archive를 6개 독립 runner에 공급·설치하고 참조 파일 존재를 확인했다. |
| Windows | 현재 source의 RNW Vulkan binding/core native build와 standalone C ABI build 통과. C ABI fault/counter export 제거 및 실제 ABI export 유지 확인. x64 Release sample에서 Ready·카운터 입력·정상 종료를 확인했다. stock RNW 0.83.2 Core 기준이며 GPU/scanout·전체 reload/loss qualification을 뜻하지 않는다. |
| Android | Temurin JDK21에서 x86_64 Release APK build 통과. Pixel_5 Android33 AVD의 host Vulkan 구성에서 Ready·카운터 입력·Back 동작과 fatal/JS 오류 없음을 확인했다. 물리 기기는 사용하지 않았다. |
| 외부 CLI 소비·Web | 저장소 밖 임시 디렉터리에 설치한 CLI로 앱 생성·runner 설치·typecheck·Web build 통과. Edge headless에서 한국어 텍스트 입력·버튼·화면 변경과 JS 오류 없음을 확인했다. 실제 한국어 IME acceptance는 아니다. |
| Linux | exact RNL 공급 prepare/build/pack, Vulkan RN binding 및 대응 native module compile 통과. license를 포함한 새 relocatable supplier 5,359개 파일을 생성하고 CLI의 hash/cohort 확인·앱 소유 입력 복사를 통과했다. GTK4 개발 package가 없어 GTK 앱 host build/run은 미수행이며 GPU 실행도 제외했다. |
| Apple | SDK header·CLI source patch 연결, pin/hash·template와 package 구성만 확인했다. native build/runtime/Metal/signing은 미검증이다. |
| 최종 정리 | 삭제 목록 preview 후 경계·링크를 확인해 명시적 Execute로 정리했다. 현행 runner archive·필수 vendor 입력·history/reference·다른 프로젝트를 보존했다. W4 임시 script/log/screenshot·외부 소비 앱과 정리 도구를 제거하고 이 작업에서 시작한 emulator를 종료했다. 별도 검증 framework/report/receipt/checkpoint는 남기지 않았다. |

초기 Android build는 기본 GraalVM의 jlink 오류로 실패했고 설치된 Temurin JDK21로 재실행해 통과했다. SwiftShader AVD 실행은 native adapter 부재로 실패해 host Vulkan으로 재실행했다. 중간 native compile에서 제거한 전역 counter의 `.inc` 참조 누락을 발견·수정한 뒤 Windows/Linux를 다시 빌드했다. 실패를 플랫폼 전체 PASS로 바꾸어 기록하지 않는다.

W3는 계속 **PARTIAL**이다. stock RNW full reload 실패, private v60 supplier 채택·qualification, 전체 SDK/GPU startup/fatal/forced teardown·loss/recovery, Linux GTK host/GPU 실행, Android ARM64/Release 및 물리 입력·한국어 IME·reader, Apple native 실행·서명, scanout/FPS·clean-machine acceptance는 이 작업으로 입증되지 않았다. W4 완료는 제품 구조 정리·검증 구성 제거와 위 최소 확인 범위에 한정한다.
