# Nelyx Material · Cupertino Testbed

양쪽 Text inputs 메시지에 짧은 여러 줄을 입력한 뒤 Scroll to top / Scroll to end를 사용합니다. 공개 TextField scrollController로 실제 Core paragraph만 이동하고 문서·선택은 유지합니다. 넘치는 메시지는 wheel·세로 touch로 스크롤하고 경계에서는 바깥 페이지가 스크롤할 수 있습니다. 한 줄/여러 줄 전환에도 같은 controller를 사용합니다. Core 위치 복원은 별도 Root 회귀로 확인하며 디자인 text/controller 복원과 실제 process recreation 검증은 잔여입니다.

양쪽 Text inputs의 메시지 옆 Disable selection / Enable selection으로 선택 기능을 전환합니다. 같은 controller·문서·선택은 유지합니다. 비활성화해도 탭 focus는 가능하며 Ctrl+A·clipboard shortcut은 값을 바꾸지 않습니다. 다시 활성화하면 Core handle·toolbar·shortcut을 사용합니다. cut은 즉시 반영하고 paste는 clipboard 응답 시점의 현재 선택에 삽입합니다. 실제 조합 중 같은 문서의 선택 변경은 OS composing range를 유지합니다. 고급 텍스트 서비스·새 active-composition value·전체 복원 API는 W14 잔여입니다.

DorotiTestbedApp의 Components 페이지를 레퍼런스로 만든 Nelyx Testbed 앱입니다. Core·Material·Cupertino 공개 제품 패키지를 사용하며, [W14 작업계획](../../work14.md)의 기능 구현·통합 검증을 같은 앱에서 진행합니다. 첫 화면의 **Cupertino**, Cupertino 페이지의 **Material 3** 버튼으로 이동합니다. 두 페이지의 선택값·입력 내용·테마는 디자인 페이지를 오가도 유지됩니다.

Cupertino → Navigation → Open named route에서 카운터를 바꾼 뒤 Return result 또는 Back으로 돌아옵니다. 갤러리 값은 유지하고 다시 열면 route 카운터는 새로 시작합니다. 기본 Cupertino route 전환과 키보드 focus는 제품 구현을 사용합니다.

루트 `package.json`이 앱 구성의 기준입니다. `app.json`, `application.json`, `nelyx.config.ts`와 루트 bootstrap 파일은 필요하지 않습니다. npm 패키지 `name`과 네이티브 앱 등록 이름인 `nelyx.name`은 구분하며, 표시 이름은 `nelyx.displayName`에 둡니다. 번들 이미지(Apple/Linux에서는 폰트도)를 추가할 때 runner main의 자산 map에 정적인 `require` 항목을 추가해 Metro에 포함합니다. Windows는 선언된 자산 전체를 host URI로, Android는 폰트를 hash 기반 네이티브 자산 URI로 연결합니다. CLI prepare는 네이티브 빌드 도구용 `runner/app-config.json`을 계속 생성합니다. 이 파일 대신 루트 패키지 구성을 수정하고 prepare로 갱신하세요.

에셋과 notice의 `sha256`은 생략할 수 있으며 기본 앱 구성에는 넣지 않습니다. runner 준비·타입 검사·Metro 시작 시 현재 파일에서 자동 계산해 생성되는 `runner/app-config.json`에만 저장하고 루트 패키지는 수정하지 않습니다. 각 runner main은 이 내부 자산 메타데이터를 확인한 뒤 등록합니다. 패키지 자산은 설치된 원본과 비교해 복사하며 수정된 기존 대상 파일은 보존하고 오류로 보고합니다. 명시한 해시가 있다면 일치 여부도 확인합니다.

## ListView 페이지

Material 갤러리 상단의 **ListView**로 별도 리스트 페이지를 엽니다. 1,000개 항목을 스크롤하고 항목을 누르면 선택 표시와 하단 상태가 바뀝니다. **처음으로**, **끝으로**, **선택 해제**를 지원하며 갤러리의 현재 테마를 사용합니다. 선택 배경·hover·splash는 목록 영역 안에 그립니다. 뒤로 버튼으로 갤러리에 돌아가고 다시 열면 리스트의 선택과 스크롤은 초기화됩니다.

## Material 페이지

Actions · Communication · Containment · Navigation · Selection · Text inputs · Image demo의 7개 그룹과 원본 순서의 29개 섹션을 갖습니다. 현재 12개 일반 데모와 2개 기본 API 데모가 동작하며 나머지 15개 섹션은 준비 상태로 구분합니다. 기본 화면은 동작하는 데모를 표시하고 **준비 중 포함**으로 전체 카탈로그를 확인합니다. 각 그룹 선택, 네 가지 seed 색상, 라이트/다크 전환, 넓은 화면의 독립 스크롤 2열과 좁은 화면의 1열을 지원합니다. 선택한 카탈로그 전체를 연속 스크롤하며, Text inputs 단독 페이지는 전체 폭을 유지합니다. All에서는 편집 섹션이 열 전환 전후 같은 주 스크롤 owner를 사용합니다. 일반 섹션은 lazy 생성하고, 마운트된 편집/Form 섹션은 viewport 밖에서도 유지하다 category/design 변경으로 제거되면 해제합니다. 화면이 소유한 선택값과 메시지 controller는 탐색 후에도 유지됩니다.

버튼의 실행 결과, 선택 아이콘, badge 개수, 진행 표시 애니메이션, checkbox·chip·radio·slider·range·switch 값을 직접 바꿀 수 있습니다. Material Text inputs에서는 M3 filled/outlined 장식·오류·20 grapheme 제한·Secure input/Show input 전환·clear/undo와 이름/이메일 Form 검증·저장·reset을 조작합니다. 조합 입력을 확정하고 테마/폭을 바꾼 뒤 값·포커스를 확인하세요. Form은 페이지를 떠나면 종료하며, 위쪽 메시지 입력값은 화면이 소유해 유지합니다. Dialog는 현재 제품의 기본 API 범위입니다. 준비 중인 navigation·menu·picker 등을 앱 안에서 가짜 컴포넌트로 구현하지 않습니다.

## Cupertino 페이지

Actions · Communication · Containment · Navigation · Selection · Text inputs의 6개 그룹, 20개 섹션을 제공합니다. 버튼·activity indicator·목록/section·switch·checkbox·radio·slider의 **7개 일반 데모**, scaffold/navigation bar·TextField·AlertDialog의 **3개 기본 API 데모**, **10개 준비 중 섹션**으로 구분합니다. 라이트/다크와 네 가지 accent, 카테고리 필터, 전체 선택 섹션의 연속 스크롤, 좁은 화면 배치와 실제 Cupertino icon font를 지원합니다.

버튼 실행, switch/삼중 checkbox, radio/slider, activity 시작·중지, 목록 선택·테마 변경, 입력·dialog 열기/닫기를 조작할 수 있습니다. 입력 페이지는 폭이 바뀌어도 같은 controller를 사용합니다. 디자인 페이지 전환 시 이전 App/편집 트리를 먼저 해제하고 다음 화면을 표시하며, 앱이 소유한 값과 controller는 유지합니다. segmented/context menu·sheet/refresh·tabs·picker/date·search는 제품 구현 후 연결합니다. 고급 편집/복원, dialog의 다중 action/modal 계약, navigation의 large-title/tab 등은 W14 잔여 작업입니다.

카탈로그의 `ready`는 현재 데모 제공, `basic`은 제한된 제품 API 데모, `planned`는 데모 미제공을 뜻합니다. 이 표시는 제품 family나 W14 단계 전체의 완료 판정이 아닙니다. 기능을 추가할 때 제품 owner 구현 → 공개 API로 샘플 연결 → 정상/오류·입력·취소/복원/종료 검증 → README/계획 갱신을 함께 진행합니다.

Cupertino → Text inputs는 Stateful CupertinoTextField의 둥근 장식·prefix·20 grapheme·1~3행·clear/Undo를 제공합니다. Enter는 줄바꿈, Ctrl/Meta+Enter는 제출입니다. CupertinoTextFormFieldRow와 공개 Form section/row로 이름/이메일 validation·Next/Done·저장/reset을 사용합니다. 위쪽 메시지는 화면이 소유하고 연락처 Form은 페이지 종료 때 해제합니다. 고급 편집/복원·남은 OS 입력 provider 전환·물리 IME/caret 검증은 잔여 작업입니다. Android 선정 폰트 회귀는 아래 범위를 따릅니다.

## 현재 흐름 검증

Material의 outlined 메시지는 2~4행에서 늘어나고 그 뒤에는 내부 스크롤을 사용합니다. Enter는 줄바꿈, Ctrl/Meta+Enter는 제출입니다. Use one line / Use multiple lines로 기존 개행·selection을 유지하면서 정책을 바꾸고, Clear 후 Undo로 복원합니다. 조합 중 정책 변경은 확정까지 지연합니다. Core의 고정/범위/확장 layout과 앱 소유 상태의 검증은 물리 IME/caret·native font 검증과 구분합니다.

```powershell
npm run check --workspace @nelyx/testbed-2
npm test --workspace @nelyx/testbed-2
```

Root 통합 회귀는 실제 Core/디자인 위젯·CanvasKit 측정으로 양쪽 control·dialog·사진·페이지/테마/폭 변경·입력값/자원 수명을 확인합니다. 편집 host IO fixture는 실제 OS IME 검증과 구분합니다. Web에서는 Cupertino 진입 → Selection 값 변경 → Text inputs 편집 → 테마/폭 변경 → Material 복귀 → Cupertino 재진입으로 상태 유지를 재현할 수 있습니다.

## Web 실행

양쪽 디자인 필드는 Core outside-tap 정책을 사용합니다. 데스크톱/브라우저의 바깥 클릭은 편집 focus를 해제하고 native 모바일 touch는 유지합니다. 테마·secure/행 설정·Undo control은 공개 `TextFieldTapRegion`으로 묶어 편집/조합을 계속할 수 있습니다. `groupId`와 `onTapOutside`/`onTapUpOutside`로 외부 control 그룹이나 기본 포커스 정책을 바꿀 수 있습니다.

Chrome의 일반 메시지 필드는 Core/Skia가 문자·선택·조합 밑줄·caret를 그리며 EditContext가 OS 입력과 Core 좌표를 연결합니다. pointer 선택과 키보드 선택, 장문 내부 스크롤, 테마/폭 변경, 조합 중 clear 후 Undo를 조작할 수 있습니다. secure/autofill·EditContext 비활성 경로는 비시각적 input/textarea carrier를 사용합니다. 해당 carrier의 후보창 좌표·정확한 조합 범위, 남은 native provider 전환과 물리 OS IME/reader 검증은 잔여입니다.

현재 Web runner를 build한 뒤 저장소 루트의 `npm run test:web-input`으로 installed Chrome의 실제 CDP 입력/조합 이벤트와 Core 문자 bounds 응답, 테마/폭 변경·Next/제출/reset·조합 중 clear/Undo를 확인합니다. 상태 보존 DOM 이동이 없는 fallback도 검사합니다. Playwright 1.64.0 offline cache가 필요하며 임시 설치·profile·서버는 finally에서 정리합니다. 물리 OS 키보드/IME 검증과는 별개입니다.

`npm run test:web-catalog`는 현재 Testbed의 Material29·Cupertino20개 선언과 placeholder를 실제 브라우저 semantics tree에서 탐색합니다. 버튼·목록 callback, Favorite 선택, 메시지 수, named route의 반환과 디자인 교체 뒤 상태를 확인합니다. 준비 중 항목은 계속 placeholder이며 전체 control 동작·native 실행·표시 시간의 수락을 뜻하지 않습니다. 임시 Playwright 설치·브라우저·서버는 finally에서 정리합니다.

저장소 루트에서 실행합니다. 앱 시작 시 SDK를 내려받거나 빌드하지 않습니다.

```powershell
npm ci
npm run build:sdk
npm run check --workspace @nelyx/testbed-2
npm run prepare:runner --workspace @nelyx/testbed-2 -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts
npm run build:web --workspace @nelyx/testbed-2
npm run dev:web --workspace @nelyx/testbed-2
```

개발 서버가 출력하는 주소를 엽니다. 정적 Web 빌드 출력은 `.nelyx/web`입니다. source package가 바뀌면 `prepare:runner`와 해당 runner 설치를 다시 실행합니다. 같은 runner에는 현재 공급본만 사용합니다.

## Windows

아래 명령은 모두 **저장소 루트의 PowerShell**에서 실행합니다. 처음 사용하거나 SDK/native 소스를 변경했다면 아래 [Windows 준비](#windows-준비)를 먼저 진행하세요. 같은 출력의 기존 Testbed 창은 빌드 전에 닫습니다.

### 실험적 직접 Hermes host

현재 SDK와 Windows runner 패키지를 빌드·공급·설치한 뒤 저장소 루트에서 두 모드를 각각 실행합니다.

```powershell
node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode
node Nelyx/eng/run-native-hermes.mjs --hermes-mode static-aot
```

같은 앱 entry를 HWND·Skia·TSF·UIA host로 실행하며 고정 direct Hermes 공급본도 준비합니다. Windows x64, 현재 고정 Skia 입력, VS C++ 도구·LLVM·CMake/Ninja가 필요합니다. 해당 창을 닫은 뒤 같은 모드를 다시 빌드하세요. 앱 안의 `.nelyx/native-windows/current-bytecode`, `current-static-aot`를 현재 출력으로 사용합니다. 외부 앱은 설치된 CLI의 [`--host native-hermes` 명령](../../Nelyx/sdk/tooling/cli/README.ko.md#windows-직접-hermes-host)을 사용합니다.

기본 host는 RNW, 기본 엔진은 Hermes입니다. 공통 native 패키지가 rendering·text·JSI binding을 소유하며 직접 host는 RN adapter를 resolve하지 않습니다. 직접 host의 성능·물리 한글 IME/트랙패드·matching display 수락은 현행 [W18](../../work18.md)에 열려 있습니다.

이 Testbed의 프로그램 ListView/catalog 스크롤을 진단하는 개발용 명령도 제공합니다.

```powershell
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --scope diagnostic --catalog
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scope gc --catalog
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --input os --scope cpu --viewport both --catalog
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --scope cpu --viewport maximized --resource-cycles 6
```

`--resource-cycles 3..30`은 프로그램 ListView 진단 뒤 실제 앱의 cold/revisit·처음/마지막 행·갤러리 복귀를 반복합니다. Core producer·트리·native frame owner가 기준 상태로 돌아오고 마지막 3회 residency가 같은지 검사하며 기존 picture cache 64개/32MiB 상한을 유지합니다. process private memory·GPU memory·물리 입력·표시 수락과 H4 전체 판정은 별도입니다.

정식 제품의 private commit과 실제 Vulkan 할당·import 소유량은 별도 명령으로 관측합니다.

```powershell
node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode --build-only
node Nelyx/eng/run-native-hermes.mjs --hermes-mode static-aot --build-only
node Nelyx/eng/run-native-memory.mjs --hermes-mode both --viewport both --cycles 6
```

위 명령은 네 새 process에서 총 24회 갤러리→ListView cold/revisit·처음/마지막→갤러리를 시도하며 첫 거부에서 종료합니다. `--cycles`는 process당 3..30회이고 한 명령의 합계는 30회 이하여야 합니다. 상한은 private commit 1GiB·Vulkan 512MiB이며 마지막 3회 span 8MiB/1MiB·순증가 1MiB/64KiB·할당 개수 순증가 0을 검사합니다. 실제 wheel 방향·절대량, process identity, viewport와 focus도 대조합니다. 입력 보존 확인용 frame trace가 켜진 메모리 관측이며 CPU 성능 수락은 별도입니다. 거부된 관측은 소유 앱을 닫은 뒤 exit1을 반환합니다. 관측 종료·실패·중단에서 소유 앱을 닫으며 로그·임시 패키지를 남기지 않습니다. Vulkan 할당량은 driver residency·물리 입력·표시나 H4 전체 수락을 증명하지 않습니다.

외부 클라이언트는 read-only 주소 공간 scan으로 새 base와 앞서 관측한 base의 commit 증감도 보고합니다. 비원자적 관측이며 allocation stack·객체 수명을 증명하지 않습니다. MEM_PRIVATE 영역 합계는 PSAPI private commit을 대체하지 않으며 원시 주소·process memory dump는 출력하지 않습니다.

측정 창이 실행되는 동안 데스크톱 입력을 함께 조작하지 마세요. foreground/입력 간섭·불완전한 receipt를 거부하고 CPU·checkpoint·heap·surface 요약을 출력하며 종료 시 임시 entry와 패키지를 정리합니다. 프로그램 진단은 소유 창의 제목 표시줄에 커서를 두고, phase 안의 keyboard 메시지·UIA action·focus 변경·예상하지 않은 데스크톱 입력을 거부합니다. `cpu`, `gc`, inclusive span을 켜는 `diagnostic`은 별도 범위이며 후자는 `Paint.record`와 `Paint.compose`를 구분합니다. bytecode의 `--scope sampling`은 별도 1,000Hz Hermes PC 진단이며 해당 bundle의 source map으로 함수 위치를 연결합니다. 관측 횟수를 밀리초로 해석하지 않으며, `--details`를 추가하면 상위 8개 함수 요약 대신 전체 mapped stack을 출력합니다. 프로그램 진단은 `diagnostic-only`이며 같은 조건의 OS 입력 비교와 물리 표시 수락이 필요합니다.

`--input os`는 별도 native thread에서 Windows wheel을 보내고 cookie·수량·방향과 Core→surface 대응을 확인합니다. `--scope cpu`에서 ListView와 Material/Cupertino 전체 catalog를 지원합니다. catalog의 cold/revisit은 Core에서 보인 각 section을 정확히 같은 native surface content frame에 연결하며 fast에서 건너뛴 section은 따로 보고합니다. 별도 bytecode `--scope sampling`은 ListView를 지원하고 OS catalog sampling·GC·inclusive diagnostic 조합은 거부합니다. 다른 엔진 모드는 `static-aot`로 선택합니다. `--viewport both`는 같은 진단 bundle을 한 번 빌드한 뒤 기본·최대화 창을 새 process로 순서대로 측정합니다. frame callback/checkpoint와 입력 dispatch 비용은 별도 보고합니다. 정규 baseline 비교·물리 입력·표시 수락은 여전히 필요합니다.

현재 패키지를 빌드한 뒤 `node Nelyx/eng/run-native-uia-focus.mjs static-aot --product`를 실행하면 실제 카테고리 버튼·편집기를 외부 UIA client로 조작하고 focus 일치와 정상 종료를 검사합니다. HBC 패키지는 `bytecode`를 지정하세요. 자동 UIA 동작 검사이며 물리 한글 IME·reader 수락은 별도입니다.

`--product --range`는 실제 Material/Cupertino slider와 range slider 양 thumb의 UIA RangeValue 절대 값 요청·이산 값·thumb 순서·범위 밖 값/비활성 거부를 확인합니다. [RangeValue setter는 control의 지원 값으로 반올림할 수 있으므로](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationcore/nf-uiautomationcore-irangevalueprovider-setvalue) Core가 실제로 게시한 값을 기다립니다.

`--pointer`를 추가하면 OS mouse click으로 카테고리와 편집기를 선택한 뒤 외부 UIA focus를 검사합니다. `--product`는 기록된 원본 코드 source와 package manifest를 현재 앱·설치 의존성과도 대조하므로 해당 입력이 바뀌면 제품 패키지를 다시 빌드하세요.

### 실행 모드 선택

| 목적 | 엔진·실행 방식 | 구성 | 실행 방법 |
|---|---|---|---|
| 일반 실행 | Hermes · HBC99, optimized 정책 | Release | `start:windows:hermes` |
| V8 비교 | V8 · JS 소스 번들 | Release | `start:windows:v8` |
| JavaScriptCore JIT | JSC · JS 소스 번들, JIT 사용 | Release | `start:windows:jsc` |
| JavaScriptCore 인터프리터 | JSC · JS 소스 번들, 코드 생성 비활성화 | Release | `start:windows:jsc:interpreter` |
| Static Hermes AOT 실험 | Hermes · 전체 native Metro root + 선정 타입 최적화 | Release 전용 | 아래 `start-windows-static-aot.ps1` |
| 기존 Hermes compiler 비교 | Hermes · bytecode, `debug`(`-Og`) | Release | `start:windows:hermes:debug` |
| 개발 세션 | Hermes · Metro | Debug | 아래 `dev` 명령 |
| 마지막 빌드 다시 실행 | 마지막 패키지의 엔진·모드 | 마지막 빌드 구성 | `run:windows` |

이 앱의 일반 Windows Release 빌드는 Hermes와 검증된 `optimized` compiler 정책을 선택합니다. 기본 host는 RNW이며 V8/JSC는 명시적으로 선택합니다. Static Hermes AOT 모드는 `static-aot`, 도구 패키지는 `@nelyx/static-aot`입니다. SDK/native 변경 뒤 현재 패키지를 공급하고 앱을 다시 빌드하세요.

**V8 (명시적 비교 엔진)**

```powershell
npm.cmd run start:windows:v8 --workspace "@nelyx/testbed-2"
```

**JavaScriptCore (Windows x64, JIT·인터프리터)**

[Windows 준비](#windows-준비) 후 기존 [실행 스크립트](./start-windows-static-aot.ps1)에 `-Engine jsc`와 `-JscMode`를 지정합니다. JSC 공급자 준비 → Release 빌드 → 앱 실행을 차례로 진행합니다. SDK/native 소스를 변경했다면 명령 끝에 `-RefreshSdk`를 추가해 현재 패키지를 재공급·설치합니다.

```powershell
# JSC JIT로 준비·빌드·실행
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode jit

# JSC 인터프리터로 준비·빌드·실행
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode interpreter
```

JSC 준비를 마쳤다면 npm으로도 빌드·실행할 수 있습니다. 아래에서 원하는 모드 하나를 선택합니다.

```powershell
# JSC JIT
npm.cmd run start:windows:jsc --workspace "@nelyx/testbed-2"

# JSC 인터프리터
npm.cmd run start:windows:jsc:interpreter --workspace "@nelyx/testbed-2"
```

JSC의 기본 모드는 `jit`입니다. 두 모드 모두 JS 소스 번들을 사용하며, 인터프리터 모드는 VM 생성 전에 JS·정규식 JIT와 WebAssembly를 비활성화합니다. 모드를 바꿀 때는 기존 Testbed 창을 닫고 원하는 명령으로 다시 빌드·실행하세요. `run:windows`만 실행하면 마지막 패키지의 모드를 그대로 사용합니다.

**Hermes bytecode (최적화 프로필)**

```powershell
npm.cmd run start:windows:hermes --workspace "@nelyx/testbed-2"
```

**Static Hermes AOT (실험, Windows x64 Release)**

runner/native 입력을 준비한 뒤 [실행 스크립트](./start-windows-static-aot.ps1)를 사용합니다. Static Hermes AOT compiler/runtime 준비 → `optimized` Release 빌드 → 앱 실행을 차례로 진행하며, 실패하면 다음 단계를 실행하지 않습니다. 첫 준비는 고정 compiler/runtime을 만들고 이후 재사용합니다. 처음 만드는 경우 여유 공간20GiB, Visual Studio C++ 도구, LLVM clang/clang-cl, CMake와 Ninja가 필요합니다.

반복 빌드는 Metro 코드와 frontend 검증 근거를 함께 재사용합니다. AOT 입력·compiler·옵션과 출력 DLL hash가 같으면 native 컴파일을 생략하고, 일부 unit만 바뀌면 해당 unit만 다시 컴파일합니다. 현재 object와 검증 근거는 앱의 `.nelyx/windows/static-aot-cache` 한 곳에서 교체하며 배포 패키지에는 넣지 않습니다. 캐시를 지우면 다음 빌드에서 다시 생성합니다. 첫 빌드나 앱 전체 unit이 바뀌는 빌드는 큰 C 파일의 `-O3` 컴파일 비용이 계속 듭니다. SDK 변경이 없는 실행에는 `-RefreshSdk`를 반복 지정할 필요가 없습니다.

```powershell
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1

# SDK 소스 변경 후 빌드·패키지 재공급·runner 재설치까지 포함
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -RefreshSdk

# 접근성 처리 없이 비교 실행
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -RefreshSdk -DisableAccessibility
```

`-DisableAccessibility`는 이번 빌드의 `accessibilityEnabled`를 `false`로 전달합니다. 트리 생성·갱신·전송, 접근성 전용 프레임 요청과 OS 접근성 설정 관찰을 생략하며 일반 입력/IME는 유지합니다. 옵션을 빼고 다시 빌드하면 앱의 기본 설정으로 돌아갑니다. 소스를 수정하지 않으며 호출자의 명시적인 `NELYX_ACCESSIBILITY_ENABLED=true|false`는 성공·실패 시 모두 복원합니다. 없거나 비어 있던 변수는 삭제해 같은 PowerShell 세션에서 반복 실행해도 빈 값 오류를 만들지 않습니다. V8/JSC 선택과 함께 사용할 수도 있습니다.

`-RefreshSdk`는 루트 의존성이 설치된 상태에서 사용합니다(`npm.cmd ci`). renderer supplier를 처음 연결할 때는 `-NativeInputs "C:\path\to\supplier\inputs.json"`, 이미 검증된 compiler/runtime을 연결할 때는 `-EngineInputs "C:\path\to\toolchain"`을 추가합니다. 두 옵션은 `-RefreshSdk`와 함께 사용할 수 있습니다. 저장된 Static Hermes 공급자 경로가 캐시 정리로 삭제되었다면 준비 단계가 앱의 `.nelyx/windows/static-hermes-build`에 compiler/runtime을 다시 만들고 성공 후 경로를 갱신합니다. 이때 첫 준비와 같은 빌드 시간이 필요합니다. 남아 있는 공급자의 무결성 오류나 명시한 `-EngineInputs` 오류는 계속 실패로 처리합니다. 경로 옵션의 상대 경로는 스크립트를 호출한 디렉터리 기준이며, 실행 후 원래 작업 디렉터리로 돌아옵니다.

전체 Metro graph를 한 VM의 native 코드로 컴파일합니다. 자동 정책이 검증된 scalar body를 특화하고 인수를 검사하며, 동적 값·field·getter·callback은 일반 JS 연산으로 유지합니다. 빌드는 전체 source/body/native 대응과 타입 정책 근거를 요구하며 coverage 누락이면 실패합니다. 공급된 AOT VM은 eval/JIT를 끄고 native 시작 후 source·bytecode 실행을 거절합니다. 실제 기능·진단·성능 수락은 [work15a.md](../../work15a.md#11-현재-구현-상태와-잔여-작업)의 별도 gate입니다. 루트의 `npm.cmd run inspect:static-aot-runtime`은 native 패키지를 빌드·실행하지 않고 설치된 Release graph를 조사합니다.

**Hermes bytecode (기존 `-Og` 비교용)**

```powershell
npm.cmd run start:windows:hermes:debug --workspace "@nelyx/testbed-2"
```

마지막 빌드 결과를 다시 열기만 할 때는 아래 명령을 사용합니다. 이 명령은 엔진을 바꾸거나 재빌드하지 않습니다. `build:windows*` 명령은 빌드만 하므로 창을 열려면 `start:windows:*` 또는 아래 실행 명령을 사용하세요.

```powershell
npm.cmd run run:windows --workspace "@nelyx/testbed-2"
```

### 빌드·실행 옵션

옵션을 바꿀 때는 아래처럼 Windows runner의 `build`를 직접 사용합니다. 앱의 `build:windows`는 Hermes `optimized`를 지정합니다. V8/JSC 선택과 compiler 비교에는 위 엔진별 스크립트나 아래 명시적 명령을 사용하세요. PowerShell에서는 `npm.cmd`와 `--`로 옵션을 전달합니다.

| 옵션 | 적용 명령 | 값·용도 |
|---|---|---|
| `--engine` | `prepare:native`, `build` | `v8`, `hermes`, `jsc`. runner CLI와 앱의 일반 빌드 기본값은 Hermes입니다. |
| `--jsc-mode` | `prepare:native`, `build` | `jit`(기본) 또는 `interpreter`. `--engine jsc`와 함께 지정합니다. |
| `--hermes-mode` | `prepare:native`, `build` | `bytecode`(기본) 또는 `static-aot`. Static AOT는 Hermes·Release 전용입니다. |
| `--hermes-profile` | `build` | `debug`(`-Og`) 또는 `optimized`. bytecode CLI 기본은 `debug`, Static Hermes AOT는 `optimized`가 필요합니다. |
| `--configuration` | `build` | `Release`(기본) 또는 `Debug`. compiler의 `debug` 프로필과 native Debug 구성은 서로 다른 옵션입니다. |
| `--native-inputs` | `prepare:native`, `build` | 현재 설치본과 일치하는 Skia/RNW `inputs.json`. prepare에서 연결하면 이후 빌드가 재사용합니다. |
| `--engine-inputs` | `prepare:native`, `build` | 검증된 V8·JSC supplier 또는 Static Hermes AOT compiler/runtime 디렉터리. 렌더러의 `--native-inputs`와 구분합니다. |
| `--package` | `run` | 명시한 패키지 디렉터리 실행. 생략하면 마지막으로 빌드한 패키지를 실행합니다. |

```powershell
# Hermes bytecode의 native Debug 빌드 후 실행
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-mode bytecode --hermes-profile debug --configuration Debug
if ($LASTEXITCODE -eq 0) { npm.cmd run run:windows --workspace "@nelyx/testbed-2" }

# 마지막 빌드 대신 고정 Release 패키지를 명시해 실행
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run run -- --package ../../.nelyx/windows/packages/Release
```

`run`은 패키지에 기록된 엔진·모드를 검증해 실행하며 엔진 전환 옵션을 받지 않습니다. 엔진을 바꾸려면 먼저 원하는 모드로 빌드합니다. `--package`의 상대 경로는 Windows runner 디렉터리 기준입니다. GPU를 명시하려면 실행 전에 `$env:NELYX_WINDOWS_GPU_VENDOR = '4098'`(AMD)을 설정하고 기본 선택으로 돌아갈 때 `Remove-Item Env:NELYX_WINDOWS_GPU_VENDOR`로 해제합니다. 기본값은 주 디스플레이에 연결된 하드웨어 adapter입니다.

### 개발 세션

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run dev -- --port 8081
```

Hermes의 Metro/native Debug 세션입니다. `--host`는 `127.0.0.1` 또는 `localhost`, `--port` 기본값은8081이며 `--launch false`를 추가하면 native 앱 실행 없이 Metro만 엽니다. Ctrl+C로 세션을 종료합니다. V8·JSC·Static Hermes AOT의 개발 갱신은 지원하지 않습니다.

Windows 기본 ApplicationSurface는 비시각적 TSF protocol3 입력과 Core UIA semantics protocol4를 연결합니다. Core/Skia가 text·caret·selection·composing을 그리며, 입력 해제를 기다린 뒤 Core/GPU를 종료합니다. visible editor/font registry는 사용하지 않습니다. SDK/native 변경 후 재공급·설치·EXE 재빌드가 필요합니다.

Windows 빌드 출력은 시간 없는 `.nelyx/windows/packages/Release/`와 `Debug/`로 고정합니다. 임시 패키지를 검증한 뒤 같은 구성의 출력과 `last-package.json`을 교체하며 실패하면 이전 패키지로 복원합니다. 같은 출력의 앱이 실행 중이면 종료 후 다시 빌드합니다. staging·교체용 백업은 실행 종료 시 정리합니다. 성공한 빌드는 이 앱의 이전 시간별 패키지도 삭제하며, 실행 중인 시간별 패키지는 종료 후 다음 빌드에서 정리합니다. 다른 고정 구성·관리 폴더 밖 출력·다른 앱·수정된 패키지·링크는 보존하며 `cleanup.removed`·`cleanup.retained`에 정리 결과와 보존 이유를 표시합니다.

### Windows 준비

Visual Studio C++ 빌드 도구, Windows SDK와 고정된 x64 Release 렌더러 입력이 필요합니다. [Skia 공급 안내](../../Nelyx/skia/README.ko.md#windows-네이티브-입력)를 참고하세요. 현재 SDK와 Static Hermes AOT 도구를 포함한 target 패키지를 공급한 뒤 runner를 설치합니다. 저장소 의존성을 아직 설치하지 않았다면 먼저 루트에서 `npm.cmd ci`를 실행합니다.

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- windows
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner install --ignore-scripts --workspaces=false
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --native-inputs "C:\path\to\supplier\inputs.json"
```

경로는 현재 native supplier의 실제 `inputs.json`으로 바꿉니다. 이미 연결한 입력이 있으면 `--native-inputs`를 생략할 수 있습니다. 각 준비·설치 단계가 성공한 뒤 다음 단계로 진행합니다. V8 첫 실행 전에는 아래 준비를 한 번 진행한 다음 위 실행 명령을 사용합니다. Static Hermes AOT는 위의 Static AOT 준비 명령을 사용합니다.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --engine v8
```

JSC를 npm 명령으로 처음 실행할 때는 아래 준비를 한 번 진행합니다. JIT·인터프리터는 같은 공급본을 사용하며 실행 모드는 빌드할 때 선택합니다. 위 PowerShell 실행 스크립트는 이 준비도 수행합니다.

```powershell
npm.cmd run prepare:windows:jsc --workspace "@nelyx/testbed-2"
```

이 Testbed의 Windows Release 기본 엔진은 **Hermes**입니다. 일반 `build:windows`는 고정 Hermes와 검증된 최적화 HBC99를 사용합니다. `run:windows`는 마지막으로 빌드한 패키지를 실행합니다. V8은 명시적 스크립트로 선택하며 기존 공급본은 prepare의 `--engine-inputs <supplier 폴더>`로 재사용합니다.

기본 `optimized` HBC99는 확인된 loop/CFG 오류 pass를 제외하고 inlining을 끕니다. compiler flags와 정책 ID를 패키지에 기록하며 정확한 RNW/Hermes 공급본만 허용합니다. 현재 Windows Release 템플릿과 CLI도 같은 정책을 사용합니다. `-Og` 비교는 루트의 `npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-profile debug`를 사용합니다.

갤러리는 인접 섹션을 기본 250 logical pixel cache 안에 유지합니다. 테마는 색/밝기가 바뀔 때 갱신하며, 컨트롤 값과 하단 상태 문구는 해당 부분만 다시 만듭니다. Windows의 Core frame/retirement 예약은 native compositor clock을 사용합니다(해당 API가 없는 Windows 10은 관측한 DWM refresh deadline 사용). 숨김·취소·종료는 해당 owner의 예약을 철회합니다. GPU 작업 cache도 실제 픽셀 크기에 맞춰 조정하며 별도의 256MiB allocator 한도는 유지합니다.

실제 Windows 휠 경로의 회귀는 아래처럼 실행합니다. `default`는 기본 창, `maximized`는 최대화 창, `fixed`는 800×600 logical 화면이며 `both`는 기본·최대화를 차례로 확인합니다. `both`에 `NELYX_ANIMATION_RESIZE=1`도 지정하면 두 고정 화면 측정 후 별도 리사이즈·실패 회귀를 실행합니다. 자동 OS 입력 480회의 총 이동량·방향 전환과 native 완료/정상 종료를 검사하며, Windows가 합친 이벤트는 이동량으로 확인합니다. 입력 묶음 사이에 고정 대기를 넣지 않고 연속 입력 후 실제 Core/renderer 작업과 native UI queue가 끝날 때까지 기다립니다(`continuous-render-drain`). 물리 트랙패드/표시 FPS와는 구분합니다. 현재 결과와 남은 범위는 [work17.md](../../work17.md#8-현재-상태와-다음-시작점)를 따릅니다.

```powershell
$env:NELYX_ANIMATION_MODE='cpu-timing'
$env:NELYX_ANIMATION_WHEEL_INPUT='1'
$env:NELYX_ANIMATION_VIEWPORT='both'
npm run test:windows-animation
Remove-Item Env:NELYX_ANIMATION_MODE, Env:NELYX_ANIMATION_WHEEL_INPUT, Env:NELYX_ANIMATION_VIEWPORT
```

`NELYX_ANIMATION_WHEEL_INPUT=queued`는 OS 마우스를 주입하지 않고 native queue → 실제 SDK wheel adapter → Core로 같은 작은 delta를 전달하는 비교용 부하입니다. 이 결과는 OS/트랙패드 입력 자격이나 `WHEEL_INPUT=1`의 성능 수치로 대체하지 않습니다.

`npm run test:windows-input-surface`의 기본 VM/번들은 공개 앱과 같은 Hermes optimized/HBC99입니다. 이 시험은 OS 키보드·TSF/UIA·caret·선택·정상 종료를 검사하므로 실행 창의 전경 포커스가 필요합니다. `NELYX_WINDOWS_INPUT_ENGINE=v8`은 명시적으로 V8/JS 소스 비교를 선택하며 `NELYX_WINDOWS_INPUT_HERMES_OPT=raw-js`는 원본 JS 진단입니다.

필요한 native supplier는 runner에서 `npx --no-install nelyx prepare --app ../.. --target windows --native-inputs <inputs.json>`으로 연결합니다.

V8을 직접 준비/빌드하는 명령은 다음과 같습니다. 처음 `prepare`는 RNW 0.83.2의 native RN 0.83.4 소스와 Microsoft V8 `24.1.10`을 고정해 현재 도구로 공급본을 빌드합니다. 기존 공급본은 `--engine-inputs <supplier 폴더>`로 연결합니다.

```powershell
cd sample/nelyx-testbed-app-2/windows/runner
npx --no-install nelyx prepare --app ../.. --target windows --engine v8
cd ../../../..
npm.cmd run build:windows --workspace @nelyx/testbed-2
npm run run:windows --workspace @nelyx/testbed-2
```

V8은 `rn-v8-graphite-vulkan` profile·`rn-0.83.10-v8` cohort와 JS 소스 번들을 사용합니다. 실제 VM 버전/revision과 DLL·소스 맵을 검사하며 Core/Skia·입력·접근성은 같은 경로를 사용합니다. 위의 `build:windows:hermes` 명령으로 Hermes optimized/HBC99와 비교합니다. 같은 Release 출력의 실행 중인 앱은 먼저 닫습니다. V8의 Hermes inspector 연결과 개발 갱신은 아직 지원하지 않습니다. 측정 결과와 한계는 [W17 §8](../../work17.md#8-현재-상태와-다음-시작점)을 따릅니다.

V8 준비에는 MSVC v145와 Windows SDK 10.0.26100.0이 필요합니다. PowerShell에서는 옵션 구분자가 전달되도록 위 `npm.cmd` 명령을 사용합니다. 고정 V8 C ABI의 microtask 완료값을 RN JSI 의미로 보정하고, 시작 시 실제 Promise 체인·host microtask·빈 queue를 확인합니다. 현재 구현은 [고정 upstream 소스](https://github.com/microsoft/v8-jsi/blob/c1877966a8285b7cbacbdd03e26ca003496436bc/src/jsi_abi/jsi_abi_v8.cpp#L1481)에 한정합니다.


접근성 트리는 유지합니다. 위치만 바뀌면 기존 접근성 구성을 재사용하면서 clip·bounds·가시성을 갱신하고, 호스트 트리 경로에서는 사용하지 않는 엔진 패킷 생성을 건너뜁니다. 검증된 immutable snapshot의 중복 복사와 동일한 정보의 React 알림도 줄였습니다. 액션은 최신 Core callback을 사용하며 좌표·focus·편집 revision·native surface 변경은 계속 발행합니다. 제품 변경 뒤에는 `npm run build:core`와 `npm run build --workspace @nelyx/sdk`를 실행한 다음 위 공급·설치·Release 빌드를 진행합니다. `npm run test:semantics-updates`로 갱신·실패 재시도·owner 해제를 검사합니다. 현재 결과와 잔여 제한은 [W17 §8](../../work17.md#8-현재-상태와-다음-시작점)에 기록합니다.

이 앱은 `widgetApplication({semanticsUpdateInterval: 50, ...})`으로 이동 중 접근성 갱신을 직전 발행 후 50ms까지 합치고, 그 뒤 가능한 첫 host frame에서 최신 상태를 발행합니다. 위치만 바꾸는 AnimatedBuilder 재빌드에도 적용하며, 접근성 내용을 무효화하는 재빌드·focus·입력 geometry·View/metrics 변경은 간격을 건너뜁니다. IME/caret/selection 좌표는 기존 frame 계약을 유지합니다. 대기 중 현재 발행본의 action 요청은 다음 frame을 앞당기고, 새 snapshot에서도 같은 source가 활성·노출 상태일 때 한 번 실행합니다. 교체된 발행본의 action은 철회하며 대기 작업은 View 숨김/종료 때 해제합니다. Core 기본값은 즉시 발행하는 `0`입니다. Native fixture는 같은 설치 코드에서 `NELYX_ANIMATION_SEMANTICS_INTERVAL=0`과 `50`을 비교하고 각 단계에 실제 적용 간격을 출력합니다.

저장소 루트에서 아래 회귀는 현재 Windows runner 패키지와 native supplier로 별도 GPU 창을 빌드합니다. Core/TSF 문서·OS scan-code·독립 WM_CHAR/Unicode VK_PACKET·caret 화면 좌표와 GPU/입력 해제를 검사하고 임시 project를 정리합니다.

```powershell
node --test --test-timeout=1200000 Nelyx/eng/tests/windows-input-surface.test.mjs
```

이미 한국어 keyboard layout이 활성화된 환경에서 `NELYX_WINDOWS_INPUT_IME=1`을 설정하면 실제 TSF 조합·확정·조합 중 clear/Undo/Redo/reset·focus·resize도 검사합니다. layout은 바꾸지 않으며 검증 thread의 기존 IME 모드 값은 창 종료 전에 복원합니다. 기본 테스트베드 provider는 비시각적 입력과 Core semantics를 사용합니다. 선정 TSF/UIA 통합과 물리 IME/reader 검증을 구분하며 현재 결과는 [W17 §8](../../work17.md#8-현재-상태와-다음-시작점)을 따릅니다.

저장소 루트의 `npm run test:windows-animation`은 현재 설치본·고정 V8 공급본·비압축 JS·실제 DPI에 맞춘 800×600 logical viewport에서 progress/scroll/activity/route를 검사하고 임시 project를 정리합니다. `NELYX_ANIMATION_MODE=cpu-timing`은 세부 method wrapper 없이 frame 전체 CPU만 측정합니다. `NELYX_ANIMATION_TRACE=1`의 `Frame.cpu`는 Core frame을 생성하는 RAF callback 전체를 측정하며 idle poll은 따로 집계합니다. `NELYX_ANIMATION_DIAGNOSTIC=1`은 command 수와 Hermes 할당/GC 진단을 추가하며 그 계측 비용도 포함합니다. `NELYX_ANIMATION_NATIVE_TRACE=1`은 native 단계를, `NELYX_ANIMATION_NATIVE_CORE_TRACE=1`을 함께 쓰면 정확한 설치 Vulkan 소스의 격리된 timing overlay도 측정합니다. 전체 렌더링·접근성은 유지하며 완료 간격을 물리 scanout FPS로 판정하지 않습니다.

Windows 엔진 개편 후에는 Core/SDK/Skia를 함께 공급·설치하고 native host를 다시 빌드합니다. 첫 콘텐츠가 준비되면 창을 표시하며, 준비 중 실패와 닫기 요청은 명시적으로 종료합니다. 아래 선정 회귀는 새 목록의 cold/warm/행 진입을 나누고 A-B-A resize·실제 OS 창 테두리 드래그 중 surface 갱신·native frame identity·정상/실패 drain을 확인합니다. 물리 precision trackpad와 scanout은 별도 검증입니다.

```powershell
$env:NELYX_ANIMATION_ENGINE = 'v8'
$env:NELYX_ANIMATION_MODE = 'research-engine'
$env:NELYX_ANIMATION_SOURCE = '0'
$env:NELYX_ANIMATION_TRACE = '0'
$env:NELYX_ANIMATION_DIAGNOSTIC = '0'
$env:NELYX_ANIMATION_V8_PROFILE = '0'
$env:NELYX_ANIMATION_SOURCE_COMPILER = '0'
$env:NELYX_ANIMATION_INLINE_REQUIRES = $null
$env:NELYX_ANIMATION_NATIVE_TRACE = '1'
$env:NELYX_ANIMATION_NATIVE_CORE_TRACE = '0'
$env:NELYX_ANIMATION_SEMANTICS_INTERVAL = '50'
$env:NELYX_ANIMATION_VIEWPORT = 'both'
node --test --test-timeout=1200000 Nelyx/eng/tests/windows-animation.test.mjs
```

V8 VM 원인 분해는 위 설정에서 `VIEWPORT=default`, `V8_PROFILE=1`로 별도 실행합니다(동일한 `NELYX_ANIMATION_` 접두어). 고정 DLL의 공개 초기화 전 flag API로 CPU sample과 GC trace를 켜고, source URL 표식·native 시각으로 `list-entry-revisit`만 분리합니다. map은 외부 파일로 만들어 VM heap에 inline하지 않습니다. 결과의 `nearestJs`는 native 작업을 포함한 가장 가까운 JS 호출자이며 self CPU 시간이 아닙니다. 진단 process만1ms timer 해상도를 요청/해제하며 실제 sample 간격은 결과에서 따로 읽습니다. 해석한 V8 version·누락 sample·프로세스 working set과 `nonJsSelf`도 함께 확인합니다. DLL에 포함된 builtin은 로그에 명시된 코드 범위만 분류하고 겹침/공백은 DLL 수준으로 남깁니다. 동일 supplier DLL 옆의 PDB까지 해독하려면 `V8_SYMBOL_IMAGE=<원본 v8jsi.dll 경로>`를 함께 지정합니다. 샘플 DLL SHA-256·PE/PDB GUID/age·image 범위를 대조하며 target process에 연결하지 않습니다. `nativeSymbols.top`의 `exactFunction`과 nearest-symbol 결과는 구분합니다. 임시 VM 로그와 map은 fixture의 finally에서 삭제하며, 이 결과를 최소 CPU/scanout 수락 수치로 사용하지 않습니다. 실행 후 `V8_PROFILE=0`으로 되돌립니다.

Windows V8 공개 빌드와 native fixture는 공통 `@nelyx/metro/native-v8-transformer`에서 표준 클래스·필드·private·lexical scope·구조 분해·async/generator를 보존합니다. 소비자의 Babel 설정과 개발 refresh를 유지하며 Hermes의 컴파일 경로는 기존 preset을 사용합니다. 별도 실험용 클래스 compiler 스위치는 사용하지 않습니다.

같은 fixture의 `NELYX_ANIMATION_MODE=startup-probe`는 process entry·JS 등록·자산/폰트 준비·첫 Core build·surface 갱신·창 표시를 3회 구분하고, 빈 RN root로 실제 30초 native deadline 종료도 검사합니다. `NELYX_ANIMATION_SOURCE/TRACE/DIAGNOSTIC/NATIVE_TRACE/NATIVE_CORE_TRACE`는 모두 `0`으로 지정합니다. 선택적 `NELYX_ANIMATION_STARTUP_BASELINE=8d05c221`은 현재 Core/Skia를 유지하고 이전 host만 교체해 초기 표시 순서를 비교합니다. 전체 이전 엔진·OS cache cold·물리 scanout의 비교는 아닙니다.

## Android

일반 OpenJDK 21(현재 검증: Temurin 21.0.11), Android SDK/build tools 36, NDK `27.1.12297006`, Vulkan을 지원하는 x86_64 에뮬레이터와 일치하는 Skia Android 154.1.0 공급이 필요합니다. 이 장비의 GraalVM 21 기본 `JAVA_HOME`에서는 Android JDK image의 jlink 변환이 실패했으므로, 빌드 process의 `JAVA_HOME`을 설치된 일반 OpenJDK 21 경로로 지정합니다.

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npm.cmd run prepare:runner --workspace @nelyx/testbed-2 -- android
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner install --workspaces=false --ignore-scripts
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner exec --no -- nelyx build --app sample/nelyx-testbed-app-2 --target android --architecture x86_64 --configuration Release
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner exec --no -- nelyx run --app sample/nelyx-testbed-app-2 --target android --device emulator-5554
```

저장소 루트에서 실행합니다. `emulator-5554`는 `adb devices -l`에 표시된 serial로 바꾸며, CLI `run`이 등록된 Release APK를 설치하고 실행합니다. JDK 지정은 현재 PowerShell 세션과 그 자식 프로세스에 적용됩니다.

임시 에뮬레이터 검사는 `-read-only -no-snapshot`을 사용합니다. [Android 문서는 read-only guest disk 변경을 종료 시 폐기한다고 설명합니다](https://developer.android.com/studio/releases/emulator). Activity 시작·뒤로 복귀 검사는 native drain·물리 입력·표시 timing 수락과 구분합니다.

각 target의 기존 SDK/native toolchain과 공급 입력이 필요합니다. Android 설정은 x86_64 emulator Vulkan 프로필입니다. [SDK 설정 안내](../../Nelyx/sdk/README.ko.md)와 [CLI 실행 안내](../../Nelyx/sdk/tooling/cli/README.ko.md)를 참고하세요. 소스·Web 검증과 실제 EXE/APK·물리 입력 검증은 별개입니다.

Android OS 입력은 불가용 Core geometry를 명시적으로 철회하는 비시각적 View/BaseInputConnection protocol4를 사용합니다. 문자·selection·조합 표시·caret는 Core/Skia가 그리며, IME의 caret baseline과 lazy UTF-16 문자 bounds도 같은 Core paragraph에서 전달합니다. Gradle은 검증된 앱 font bytes를 Skia용 hash 경로에 공급하며 native editor font registry는 요구하지 않습니다. 폰트 변경 시 재공급·설치·APK 재빌드는 필요합니다. 일반 OpenJDK 21을 사용합니다.

Android Skia surface는 실제 MotionEvent history를 포함하는 비병합 pointer protocol1을 사용해 JS frame 지연 중 drag가 move 한 개로 축약되는 것을 막습니다. 일치하는 SDK/Skia RN 공급본으로 native APK를 다시 빌드합니다. Core 제스처·입력 검사 회귀는 `npm run test:android-pointer`로 실행합니다.

Debug APK를 빌드·설치한 뒤 `android`에서 API26 이상 native 입력 회귀를 실행합니다.

```powershell
.\gradlew.bat :app:assembleDebugAndroidTest -PreactNativeArchitectures=x86_64 --no-daemon --max-workers=2
adb -s <serial> install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s <serial> shell am instrument -w com.nelyxtestbed2.test/dev.nelyx.sdk.editing.InputConnectionInstrumentation
```

출력의 `status=PASS-scoped`를 확인합니다. `am instrument`는 assertion 실패에도 종료코드 0을 반환할 수 있습니다. 실제 BaseInputConnection의 조합/확정·방향 selection·잘못된 UTF-16 rollback·실제 finish/close 뒤 취소/autofill 완료·Core 교체 우선·retired/disabled 입력 차단·readOnly·native View의 0 pixels와 실제 MotionEvent history/다중 pointer/cancel 직렬화를 검사합니다. 앱의 Core/Skia pixels·실제 OS IME/가상 키보드·reader·물리 입력/FPS는 별도 검증입니다.

설치한 Debug 앱의 입력 흐름은 준비된 Vulkan 에뮬레이터 serial로 아래에서 실행합니다. 현재 작업·잔여는 [W14](../../work14.md)를 따르며, 이전 선정 결과는 [W13](../../work13.md)에 남아 있습니다.

```powershell
$env:NELYX_ANDROID_TEST_SERIAL = 'emulator-5580'
npm run test:android-input
```

회귀는 Metro와 자신이 생성한 reverse mapping을 소유하고 finally에서 종료합니다. 주입한 ASCII 입력·키보드 높이 변경·clear/Undo·Next/Done·Form 저장/reset·디자인 복귀 후 값을 확인합니다. 물리 IME/caret·reader·hardware FPS 검증은 별도입니다.

Native 갤러리와 OS 편집·수명을 함께 확인하려면 NELYX_ANIMATION_MODE=full-runtime-regression, NELYX_ANIMATION_ENGINE=hermes, NELYX_ANIMATION_HERMES_MODE=static-aot와 검증한 NELYX_STATIC_HERMES_INPUTS를 지정하고 저장소 루트에서 npm run test:windows-animation을 실행합니다. 기능 검사이며 성능 표본에 포함하지 않습니다. Static AOT input-surface fixture도 전체 native coverage와 fallback0 VM audit를 요구합니다. 물리 IME 후보창·reader 조작은 별도 검증입니다.

### 그룹 안의 lazy child 선언

`SliverChildGroupedDelegate`는 일반 `ListView.custom`에서 논리 section 내부의 독립 lazy 경계를 선언합니다. 최대 4,096개 descriptor만 펼치고 Widget은 sliver가 요청할 때 생성합니다. group/child key에는 기존 `Key` 동등성을 적용하므로 서로 다른 group의 같은 child key도 구분됩니다. `firstIndexOfGroup(key)`와 `indexOfChild(groupKey, childKey)`로 현재 flat index를 조회합니다.

```ts
import {ValueKey} from '@nelyx/core/foundation/key';
import {Text} from '@nelyx/core/framework/widgets/basic';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {SliverChildGroupedDelegate} from '@nelyx/core/framework/widgets/scroll-delegate';

const childrenDelegate = new SliverChildGroupedDelegate([
  {key: new ValueKey('section-a'), children: [
    {key: new ValueKey('title'), builder: () => new Text('Section A')},
    {key: new ValueKey('body'), builder: () => new Text('Independent content')},
  ]},
]);
const list = ListView.custom({childrenDelegate});
```

Group은 메타데이터입니다. 하나의 owner가 필요한 Form·editor·Wrap layout은 같은 child 안에 둡니다. delegate를 새로 만들면 현재 소유 child를 갱신하고 key를 remap합니다. 기존 ListView의 cache·keep-alive 동작은 유지됩니다. 갤러리는 W16 엔진 수락 gate를 통과할 때까지 현재 builder를 사용합니다.

고정 `itemExtent` 또는 `extentIndex`를 사용하는 ListView는 `childPolicy: {mode: 'bounded', preparation: 'disabled'}`로 선택 보존을 켤 수 있습니다. 기본값 `legacy`는 기존 동작을 유지합니다. 선택 보존은 sliver당 8개, View 전체 16개·2,048 Element 예산을 공유하며 같은 항목의 State 수명을 연장합니다. listener/ticker를 자동 정지하지 않으며 explicit keep-alive와 별도로 처리합니다. 명시적 `cacheExtent`/`scrollCacheExtent`, shrink-wrap·일반/varied/prototype list 및 nested bounded 조합은 지원하지 않습니다. 대응 fixed/section sliver도 `childPolicy`를 받습니다. `preparation: 'observed-budget'` 요청은 현재 host에 관측 deadline이 없어 자동 준비를 비활성화합니다. 이 opt-in 경로의 실제 native 수락 상태는 [W16](../../work16.md)에 기록합니다.

저장소 루트의 `npm run test:scroll-engine`은 공통 엔진을, 패키지 갱신 후 `node Nelyx/eng/tests/check-scroll-supply.mjs`는 Windows 설치 Core의 공개 소비를 검사합니다. Native 연속 부하는 `node Nelyx/eng/tests/run-windows-scroll.mjs hermes 1`로 실행합니다. `hermes`는 bytecode/optimized Release, `static-aot`는 Static Hermes/optimized Release이며 `matrix 3`은 두 모드×기본/최대화×3회의 기준선 또는 후보 12회입니다. 전후 비교에는 각 공급에서 별도로 실행합니다. `v8`은 호환성 검사로 남습니다. 두 Hermes 모드는 같은 qualified VM/GC supplier를 사용하며 HBC/compiler·AOT·VM·host hash를 출력합니다. `$env:NELYX_SCROLL_DIAGNOSTIC='1'`을 설정하면 `hermes 1` 또는 `static-aot 1`의 기본 창에서 별도 계측하며 성능 수락에는 포함하지 않습니다. 진단 뒤에는 `Remove-Item Env:NELYX_SCROLL_DIAGNOSTIC`으로 설정을 해제합니다. 검사 중 접근성을 켜고 semantics 간격을 50ms로 고정하며 이전 runner 설정을 복원합니다. OS wheel 주입 동안 해당 창의 foreground 소유가 필요하고 phase 경계에서만 활성화합니다. Native surface 완료는 실제 trackpad·표시 timing 수락과 다릅니다. 현재 결과와 남은 gate는 현행 [W18](../../work18.md)에 기록합니다.

기본 OS 부하는 planned를 포함한 두 gallery의 전체 catalog를 대상으로 합니다. 각 열에서 연속 wheel로 끝까지 이동하고 역방향 재방문하며, cold/revisit의 모든 section이 viewport에 들어왔는지 확인합니다. fast는 끝 경계·입력 전달을 검사하고 지나친 section을 별도 보고합니다. 일반 ListView의 고정 부하와 항목 생성부터 첫 layout까지의 시간도 함께 측정합니다. `$env:NELYX_SCROLL_CATALOG='bounded'`는 이전 고정 이동 범위의 진단용이며 전체 catalog 수락에는 사용하지 않습니다. 공급 검사는 Core 전체 source/dist/package identity를 확인합니다. 수정 전 설치본을 의도적으로 기준선으로 유지할 때만 출력된 정확한 설치 digest를 `NELYX_SCROLL_REFERENCE_CORE_DIGEST`로 지정합니다.

wheel 전송은 모든 간격에 high-resolution timer를 사용하며 guard·전송 작업 시간만큼 대기를 줄입니다. 보고서에는 `high-resolution-relative-start-completion-v1` 정책과 실제 전송 완료 간격 p50/p95/max가 포함됩니다. 이전 pacing 정책이나 누락·잘못된 실제 간격은 수락 검사에서 거부하며, 요청한 간격만으로 입력 조건이 같다고 판단하지 않습니다.

desktop을 사용하는 동안에는 진단 설정과 함께 `$env:NELYX_SCROLL_INPUT='queued'`로 SDK queue 경로를 관찰할 수 있습니다. 모든 계측 진단은 bounded 범위이며 OS wheel 성능 표본에는 포함하지 않습니다. `$env:NELYX_SCROLL_AFTER_DIAGNOSTIC='1'`은 정규 실행 뒤 같은 HBC/AOT compiler output의 hash를 확인해 별도 native 진단 host를 준비하고 모드마다 새 process에서 native/JS/Core 계측을 1회 수행합니다. 외부 helper가 sync JSI thread의 PC를 관찰하고 정확한 image hash와 PDB/native map으로 VM 함수·AOT 함수 범위 및 source 후보를 연결합니다. 이 관찰에는 wait와 thread 정지 비용이 포함되므로 PC 빈도를 CPU 시간 비율이나 성능 수락값으로 해석하지 않습니다. 정규 실행이 실패해도 첫 실패를 유지하며 진단을 시도합니다. 별도 `NELYX_SCROLL_DIAGNOSTIC`과는 함께 사용하지 않습니다. 주입 호출 수와 실제 수신 이벤트 수는 따로 보고하며 절대/부호 이동량·native sequence·dispatch 대응을 검사합니다. 합쳐진 native 이벤트의 latency는 수신 이벤트 timestamp 기준입니다. 사용한 `NELYX_SCROLL_*` 환경 변수는 검사 뒤 해제합니다.

진단 Hermes bytecode build는 실행 소유 Metro map도 생성합니다. Core build 실패가 보고되면 `SCROLL_FAILURE.javaScriptSymbols`가 정리 전에 stack을 원본 module·위치에 연결합니다. symbol 누락·읽기 실패는 원래 실패에 추가되며, 정규 timing build에는 이 진단 map을 생성하지 않습니다. native PC 진단은 실제 VM의 resolved symbol을 요구합니다. 외부 PC 수집을 뺀 별도의 JS/native-stage 진단은 `NELYX_SCROLL_DIAGNOSTIC='1'`과 함께 `$env:NELYX_SCROLL_NATIVE_PC='0'`을 명시하고 종료 뒤 해제합니다. 이 범위는 `nativePc:false`를 보고하며 VM PC attribution을 수락하지 않습니다. `SCROLL_RUN.lifecycle`은 후속 진단 처리가 실패해도 관측한 완료·정상 close marker를 보존합니다.

`NELYX_SCROLL_AFTER_DIAGNOSTIC='1'`에 `NELYX_SCROLL_AFTER_POLICY='1'`을 추가하면 같은 compiler output으로 두 모드의 최대화 정책 진단도 수행합니다. fixture가 지원되는 ListView에만 bounded/observed-budget을 선택하고 실제 보존 hit·View 합계·정상 해제를 검사합니다. 현재 Windows에서는 관측 deadline이 없어 준비 pass가 0이어야 합니다. 독립 정책 실험은 `NELYX_SCROLL_CHILD_POLICY='bounded'` 또는 `'observed-budget'`으로 선택하며 G6 legacy 결과와 구분합니다.

`$env:NELYX_SCROLL_WAIT_FOR_INPUT='1'`은 OS 입력과 queued 진단 모두 빌드를 완료한 뒤 `SCROLL_INPUT_READY`에서 대기합니다. queued 진단도 창을 전면으로 가져옵니다. desktop을 사용할 수 있을 때 마우스·트랙패드 조작을 멈추고 출력된 `file` 경로에 `New-Item -ItemType File -Path '<경로>'`로 임시 신호 파일을 만들면 실행을 시작합니다. 대기를 포함한 전체 실행은 정리 시간을 확보한 20분 deadline을 따릅니다. 신호와 후보는 종료·실패·중단 시 함께 삭제됩니다. 사용 뒤 환경 변수를 해제합니다.
