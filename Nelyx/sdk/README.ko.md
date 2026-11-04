# Nelyx SDK

[English](README.md) | **한국어**

`@nelyx/sdk`는 [Core 프레임워크](../README.ko.md)를 플랫폼 앱, 렌더링 표면, 입력, 자산, OS 서비스와 호스트 수명에 연결합니다. 공통 앱 코드는 `src/`에 두고 각 플랫폼 runner가 등록 코드와 빌드 설정을 제공합니다.

전체 앱 예는 [Testbed 가이드](../../sample/nelyx-testbed-app-2/README.ko.md), 새 앱 생성은 [CLI](tooling/cli/README.ko.md)를 참고하세요.

## 실험용 v2 packet port

`@nelyx/sdk/engine-v2`는 `connectEngineV2Host(host, options)`를 제공합니다. v2 packet transport와 `engine: 'v2'`·`abiMajor`·`schema`를 가진 `identity`를 전달합니다. Facade의 bundle/host 검사 뒤 C++ handshake가 요청한 capability를 검사합니다. 빌드 명령·ACK 재시도·활성화·close/drain은 [Core v2 안내](../README.ko.md#실험용-v2-엔진-protocol)를 참고하세요.

`createBrowserEngineV2Surface(canvas, { root: new URL('/engine/', location.href), profile: 'auto' })`로 공급된 worker runtime을 새 canvas에 연결합니다. 현재 engine dist 전체를 `root`에서 제공해야 합니다. 반환 surface는 packet host·App port·진단·비동기 `close()`를 제공합니다. Main은 bounded input/viewport를 전달하고 C++가 scene 좌표·scroll·hit-test를 소유합니다. `auto`는 격리/shared memory가 있으면 threaded, 없으면 single-worker를 선택합니다. 명시 capability 누락·공급 오류는 v1 fallback 없이 시작 실패로 처리합니다. Close는 provider/worker를 drain하며 다음 session은 새 canvas가 필요합니다.

자체 Windows host와 두 Web profile에서 고정 배치 Testbed 장면을 실행합니다. 빌드/실행 명령은 [Core 안내](../README.ko.md#실험용-v2-엔진-protocol)를 참고하세요. 전체 Widget/layout/편집/gesture·Android 이식은 PARTIAL입니다. [실행 현황](../../work8-1.md#연결-실행-현황)에 기능 증거와 물리 입력·성능 수락을 구분했습니다.

## 앱 API

`@nelyx/sdk`의 정확한 하위 경로에서 import합니다. 대상 이름은 `windows`, `android`, `ios`, `macos`, `linux`, `web`입니다.

| 모듈 | 용도 |
| --- | --- |
| `platforms/<target>/application` | 공통 앱과 backend 구성 |
| `platforms/<target>/surface` | 앱 렌더링 표면 표시 |
| `platforms/<native-target>/controls` | 네이티브 컨트롤 연결 |
| `runtime/config` | 앱 설정 읽기·검증 |
| `runtime/assets` | 선언한 자산 로드·검증 |
| `runtime/providers` | Provider profile과 런타임 요구 조건 확인 |
| `runtime/plugin-port` | 앱 소유 플랫폼 plugin 연결 |
| `runtime/worker-messages` | 명시적인 background 메시지 endpoint 연결 |

공개 export는 [package.json](package.json)에 있습니다. [Web surface 컴포넌트](../../sample/nelyx-testbed-app-2/web/runner/App.tsx)는 runner에서 `main().definition`을 `ApplicationSurface`에 연결하는 예입니다.

Windows `ApplicationSurface`의 기본값은 `windowsSurfaceStatusMode="lifecycle"`이며 backing별 첫 유효 갱신과 수명 전환을 받습니다. Surface-status protocol 1이 필요하므로 SDK와 함께 native host도 재공급·재빌드하세요. 공개 `SkiaGraphiteView`는 기본적으로 연속 callback을 유지합니다. 통지 방식을 비교할 때 `ApplicationSurface`에 `windowsSurfaceStatusMode="continuous"`를 지정할 수도 있습니다. Surface callback은 native 갱신 통지이며 실제 디스플레이 scanout 확인은 아닙니다.

RN `ApplicationSurface`의 실험 옵션 `nativeInputGeometry="retained"`는 편집기 좌표 준비를 C++로 처리합니다. 생략/`false`는 기본 TS 경로이며 `'snapshot'`은 기존 독립 후보를 선택합니다. 마운트한 owner마다 한 번 선택하고 전환할 때 remount하세요. Custom render hook은 TS 동작을 유지합니다. 이 옵션은 native hit-test index를 활성화하지 않습니다. 함께 재빌드한 native inputs·렌더러·SDK를 공급해야 하며 현재 런타임 검증 범위는 Windows입니다. 성능 채택 결과는 저장소 [work5.md](../../history/26/11/03/work5-summary.md)에 기록합니다.

명시적으로 요청한 C++ 서비스의 native capability가 없으면 시작 단계에서 오류를 냅니다. Windows 실행은 선택한 후보, 실제 native geometry commit, TS fallback 사유를 구분해 보고합니다. 저장소의 cadence 검사는 SDK/native 집계 일치와 warm Mixed 비교의 native 처리율 95% 이상을 요구합니다. 옵션 지정이나 API 존재만으로 통과하지 않습니다. 실제 Gallery → Mixed 경로와 활성화 실패 회귀는 `npm.cmd run test:retained-input-geometry`로 확인합니다.

## 설정과 provider

루트 `package.json`의 `nelyx`에 앱 설정을 선언합니다.

```json
{
  "nelyx": {
    "schema": "nelyx.app/v2",
    "name": "MyApp",
    "displayName": "My application",
    "appEntry": "./src/index.ts",
    "assets": [
      {
        "id": "app-font",
        "kind": "font",
        "path": "./assets/AppFont.ttf",
        "fontFamily": "AppFont",
        "notice": {"path": "./assets/AppFont-LICENSE.txt"}
      }
    ],
    "targets": {
      "web": {
        "profile": "ganesh-webgl2",
        "component": "./web/runner/App.tsx"
      }
    }
  }
}
```

실제 글꼴·고지 파일을 사용하세요. npm 패키지 이름과 네이티브 등록 이름인 `nelyx.name`은 별개이며, `displayName`은 화면에 표시할 이름입니다. Windows·Android profile은 [샘플 설정](../../sample/nelyx-testbed-app-2/package.json)에 있습니다.

Runner는 이 설정에서 `app-config.json`을 생성합니다. 변경할 때는 루트 패키지를 수정하고 준비 명령을 다시 실행하세요. 각 runner의 `main.ts(x)`가 플랫폼 컴포넌트를 import하고 `registerApplication`을 호출합니다.

[Provider manifest](providers/)는 대상별 profile, capability와 runtime cohort를 설명합니다. Core·SDK·렌더러 패키지, 네이티브 바이너리와 엔진 입력의 호환성을 맞춰야 합니다. Provider 검증 수준은 제공하는 capability와 별도로 기록합니다.

## 자산

- 글꼴·이미지를 `nelyx.assets`에 선언하고 앱에서 참조할 고정 ID를 지정합니다.
- 라이선스 파일을 `notice.path`로 포함하면 패키징 시 자산과 함께 전달합니다.
- `sha256`을 지정하면 해당 bytes를 요구합니다. 생략하면 도구가 생성된 runner 메타데이터에 해시를 계산합니다.
- `packageSource`는 패키지가 export한 자산·고지를 앱으로 복사합니다. 수정된 기존 파일은 보존하고 충돌로 보고합니다.
- Runner의 Metro 자산 map이 요구하는 위치에는 literal `require` 항목을 추가합니다.

글꼴을 변경하면 패키지를 다시 공급하고 네이티브 앱을 재빌드하세요. 자산 준비 절차는 [Metro 가이드](tooling/metro/README.ko.md)에 있습니다.

## 플랫폼 서비스

앱은 SDK startup·View context를 통해 플랫폼 서비스를 받습니다. 클립보드, 환경·locale 관찰, 플랫폼 메시징과 편집·semantics 연결을 제공합니다. 미지원·권한 거부 OS 작업은 타입이 있는 플랫폼 오류로 보고합니다.

플랫폼 메시지 endpoint는 앱이 소유합니다. Background 연결은 호스트가 전달한 endpoint를 사용하며 Worker나 네이티브 worker runtime 생성은 호스트 책임입니다. Worker를 종료하기 전에 연결의 비동기 해제를 기다리세요.

## 책임과 수명

| 소유자 | 책임 |
| --- | --- |
| Core | 위젯, 상태, 레이아웃, hit test와 논리 semantics |
| SDK TypeScript | Backend 구성, 입력, 자산, 서비스와 View 수명 |
| SDK 네이티브 호스트 | VM·bootstrap, 창, event loop와 앱 종료 |
| Skia 패키지 | 렌더링, 문단, 이미지, GPU 제출과 작업 완료 후 해제 |
| 플랫폼 runner | 의존성, 등록 코드, Metro·Babel과 네이티브 빌드 파일 |

앱 소유 서비스를 정리하고 비동기 해제를 기다리세요. View 종료는 새 입력·프레임 수락을 닫은 뒤 네이티브·GPU 작업 완료를 기다립니다. 완료 확인에 실패하면 종속 자원을 보존하므로 종료 오류를 그대로 처리해야 합니다.

네이티브 호스트 소스는 [native/](native/), 런타임 pin·overlay는 [../upstream/](../upstream/)에 있습니다. 플랫폼 제약은 [프로젝트 가이드](../../README.ko.md#프로젝트-상태)를 참고하세요.

## 빌드와 확인

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run build:sdk
npm run check --workspace @nelyx/sdk
```

SDK 빌드는 Core·디자인·렌더러 패키지도 빌드하고 provider·CLI 입력을 준비합니다. 대상별 빌드는 [CLI 가이드](tooling/cli/README.ko.md), runner 설정은 [Metro 가이드](tooling/metro/README.ko.md)에 있습니다.

## 라이선스

Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 가져온 코드의 고지는 [licenses/](licenses/)에 유지합니다.
