# Nelyx SDK

[English](README.md) | **한국어**

소비자 프로젝트는 **TypeScript >=7.0.0**을 사용하며 생성 runner는 **7.0.2**로 고정합니다. Runner 검사는 설치된 compiler의 공개 package metadata와 실제 실행 버전을 확인합니다. 생성 설정은 폐지된 `baseUrl` 없이 상대 paths와 명시한 app root를 사용합니다.

`@nelyx/sdk`는 [Core 프레임워크](../README.ko.md)를 플랫폼 앱, 렌더링 표면, 입력, 자산, OS 서비스와 호스트 수명에 연결합니다. 공통 앱 코드는 `src/`에 두고 각 플랫폼 runner가 등록 코드와 빌드 설정을 제공합니다.

전체 앱 예는 [Testbed 가이드](../../sample/nelyx-testbed-app-2/README.ko.md), 새 앱 생성은 [CLI](tooling/cli/README.ko.md)를 참고하세요.

## Source 앱 진입점

SDK 0.21.0은 @nelyx/sdk/app의 defineApp({ id, createRoot, defaultFont, assets, startup })으로 앱을 정의합니다. createRoot는 실제 View 서비스와 Source scheduler를 받아 동기 실행합니다. runner는 main().definition을 읽고 bootstrapApplication이 기존 FrameworkRoot를 만듭니다. 자산 로딩과 선택적 비동기 startup은 첫 Source frame 전에 끝납니다.

이전 build/ready/dispose native scene launcher·native 위젯 adapter·engine-v2 앱 export는 삭제했습니다. createRoot와 기존 ApplicationDefinition의 startup/소유 자원 dispose 계약으로 이전합니다. 폰트는 선언된 자산과 선택 backend의 font 서비스를 사용하고, 앱 자원은 startup이 반환하는 disposable에서 해제합니다. deprecated alias·두 번째 Widget 모델·자동 fallback renderer는 제공하지 않습니다.

CLI와 생성 템플릿도 같은 Source 앱 정의를 사용합니다. Windows native/Hermes·RN 플랫폼 surface·Web CanvasKit surface는 기존 drawing/자원/OS backend를 재사용하며 위젯별 native 정책 adapter를 설치하지 않습니다. backend capability 오류는 명시적으로 실패합니다. 원본 대조와 플랫폼/IME/reader/성능의 남은 확인은 [현재 수락 범위](../../work12.md#11-현재-구현과-확인-범위)에 기록합니다.

## 앱 API

`@nelyx/sdk`의 정확한 하위 경로에서 import합니다. 대상 이름은 `windows`, `android`, `ios`, `macos`, `linux`, `web`입니다.

| 모듈                                 | 용도                                     |
| ------------------------------------ | ---------------------------------------- |
| `platforms/<target>/application`     | 공통 앱과 backend 구성                   |
| `platforms/<target>/surface`         | 앱 렌더링 표면 표시                      |
| `platforms/<native-target>/controls` | 네이티브 컨트롤 연결                     |
| `runtime/config`                     | 앱 설정 읽기·검증                        |
| `runtime/assets`                     | 선언한 자산 로드·검증                    |
| `runtime/providers`                  | Provider profile과 런타임 요구 조건 확인 |
| `runtime/plugin-port`                | 앱 소유 플랫폼 plugin 연결               |
| `runtime/worker-messages`            | 명시적인 background 메시지 endpoint 연결 |

공개 export는 [package.json](package.json)에 있습니다. [Web surface 컴포넌트](../../sample/nelyx-testbed-app-2/web/runner/App.tsx)는 runner에서 `main().definition`을 `ApplicationSurface`에 연결하는 예입니다.

Windows `ApplicationSurface`의 기본값은 `windowsSurfaceStatusMode="lifecycle"`이며 backing별 첫 유효 갱신과 수명 전환을 받습니다. Surface-status protocol 1이 필요하므로 SDK와 함께 native host도 재공급·재빌드하세요. 공개 `SkiaGraphiteView`는 기본적으로 연속 callback을 유지합니다. 통지 방식을 비교할 때 `ApplicationSurface`에 `windowsSurfaceStatusMode="continuous"`를 지정할 수도 있습니다. Surface callback은 native 갱신 통지이며 실제 디스플레이 scanout 확인은 아닙니다.

RN `ApplicationSurface`의 실험 옵션 `nativeInputGeometry="retained"`는 편집기 좌표 준비를 C++로 처리합니다. 생략/`false`는 기본 TS 경로이며 `'snapshot'`은 기존 독립 후보를 선택합니다. 마운트한 owner마다 한 번 선택하고 전환할 때 remount하세요. Custom render hook은 TS 동작을 유지합니다. 이 옵션은 native hit-test index를 활성화하지 않습니다. 함께 재빌드한 native inputs·렌더러·SDK를 공급해야 하며 현재 런타임 검증 범위는 Windows입니다. 성능 채택 결과는 저장소 [work5.md](../../history/26/11/03/work5-summary.md)에 기록합니다.

명시적으로 요청한 C++ 서비스의 native capability가 없으면 시작 단계에서 오류를 냅니다. Windows 실행은 선택한 후보, 실제 native geometry commit, TS fallback 사유를 구분해 보고합니다. 독립 cadence·회귀 도구는 정리했으며, 옵션 지정이나 API 존재가 실제 실행·성능 수락을 뜻하지 않습니다.

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

V2 SDK 앱은 `nelyx.v2.json`에 asset을 선언합니다. 두 App 모델의 `context.asset(name)`과 canonical `rootBundle`/`PlatformAssetBundle`은 같은 패키지 bytes를 읽습니다. Original의 `DefaultAssetBundle.of(context)`는 ImageService 없이 App root를 쓰며 상위 bundle override를 보존합니다. CLI는 Nx variant가 포함된 binary manifest와 Web용 JSON/base64를 생성합니다. UTF-8 이름·공백을 지원하고 structured cache miss는 문자열 캐시를 거치지 않아 parser 실패 뒤 실제 bytes를 다시 읽습니다.

Canonical buffer API import는 동기 복사 요구를 알리며 SDK는 이 요구가 있으면 build 전에 공유 App 서비스를 준비합니다. Asset 읽기도 같은 서비스를 쓰며 Web은 해당 128 MiB CanvasKit heap·320 MiB host 예약을 사용합니다. Native는 할당 전 파일 크기, Web은 HEAD metadata 또는 생성한 asset index를 사용해 admit한 크기에 stream을 읽고 SHA-256을 검증합니다. 일반 HTTP 서버는 HEAD·공급자 hash header 없이 사용할 수 있습니다. Index는 별도의 제한된 credit을 보유하고 논리적 close 때 반환합니다. 실패·취소는 미전달 credit을 반환합니다. IO 대기 32개·admit된 buffer 64개·누적 admit data 32 MiB를 기존 App quota 안에서 제한하며 읽기마다 IO/복사·캐시 UTF-16을 위해 `3 * size + 65536` bytes를 예약합니다. 전달한 ByteData는 호출자가 보유할 수 있어 App realm 종료까지 credit을 유지합니다. Clear/evict는 Source cache를 지우지만 호출자 bytes를 회수하지 않습니다. 임의 parser 결과는 호출자가 관리합니다. Close는 새 IO를 거부하고 소유 IO를 취소·drain하며 Native runtime/Web worker 종료까지 전달 credit을 보존합니다. 전체 AssetBundle API 완료는 아닙니다.

Canonical `AssetBundle.loadBuffer()`와 `ImmutableBuffer`(`@nelyx/core/ui/immutable-buffer`에서도 제공)는 엔진 소유의 읽기 전용 bytes를 만듭니다. `fromUint8List()`는 Promise 반환 전에 선택한 view를 복사하므로 이후 caller 변경의 영향을 받지 않습니다. `fromAsset()`은 패키지 App 소유자, Native `fromFilePath()`는 UTF-8 로컬 경로를 사용하며 Web 파일 로딩은 명시적으로 실패합니다. Native는 SkData, Web은 CanvasKit 할당을 사용하고 Web upload/readback bytes는 SDK가 복사합니다. 모든 public buffer를 dispose하세요. 내부 엔진 holder나 진행 중인 읽기는 마지막 참조가 끝날 때까지 할당과 credit을 보유합니다. 살아 있는 buffer/reader와 해제 실패가 남으면 정상 close로 처리하지 않습니다. 복사 전에 할당당 `2 * size + 65536` bytes를 admit하며 owner별 live handle/할당 64개·live data 32 MiB·IO 대기 32개를 제한합니다. Buffer 전용 asset staging은 캡처 후 반환하고, 외부에 전달한 mutable ByteData credit은 별도로 realm 종료까지 유지합니다. `debugDisposed`와 중복/reentrant dispose 검사는 모든 build에서 동작합니다. 필수 `loadBuffer` 추가는 기존 구조적 클래스 타입을 확장하므로 해당 호환성 검토는 아직 미완료입니다.

```ts
import { rootBundle } from '@nelyx/core/services/asset-bundle';

export async function assetByteLength(key: string): Promise<number> {
  const buffer = await rootBundle.loadBuffer(key);
  try {
    return buffer.length;
  } finally {
    buffer.dispose();
  }
}
```

`NetworkAssetBundle`은 base URL 문자열에 상대 key·query·fragment와 절대 HTTP(S) key를 해석합니다. 매번 새로 요청하며 HTTP stack의 cache만 따릅니다. HTTP 200만 성공입니다. Windows는 비동기 WinHTTP의 gzip/deflate·OS proxy/TLS·redirect 5회·IO timeout 30초, Web은 fetch stream과 browser CORS·TLS·redirect 정책을 사용합니다. 공통 App 소유자가 시작 중·실행 중 IO를 취소합니다.

Standalone Android는 별도 native IO worker에서 Android HttpURLConnection을 사용합니다. UTF-8·space를 포함한 URL, query/fragment·redirect 5회·교차 origin credential 제거와 같은 corpus를 적용하며 connect/read timeout은 3초/2초입니다. 종료는 취소 flag를 전달하고 현재 bounded IO가 끝나 실제 connection/stream과 callback owner가 회수될 때까지 credit을 보유합니다. UI에서 network worker를 join하지 않습니다. Emulator의 로컬 HTTP는 개발 profile에서만 허용합니다.

HTTP 시작 전에 요청당 metadata·callback/전송 복사용 512 KiB를 admit하고 공통 IO 대기는 32개로 제한합니다. 길이가 있으면 읽기 전에 저장 공간을 확보하며 길이 미상·압축 stream은 할당 전에 `3 * capacity + 65536` bytes의 credit을 늘린 뒤 실제 전달 길이로 줄입니다. 누적 data 32 MiB와 App quota도 적용합니다. Raw caller bytes는 realm credit을 유지하고 `loadBuffer`는 불변 캡처 후 내부 staging을 반환합니다. Native 요청 credit은 마지막 close callback과 빌린 JSI 복사가 끝날 때까지 유지합니다. Browser/OS network buffering은 측정하는 소유 메모리 밖입니다. Data·Original App 선언 모두 Native ES2022에서 DOM ambient type을 요구하지 않으며 Web surface 인자는 정확한 browser 타입을 유지합니다.

```ts
import { NetworkAssetBundle } from '@nelyx/core/services/asset-bundle';

export async function remoteAssetByteLength(baseUrl: string, key: string): Promise<number> {
  const buffer = await new NetworkAssetBundle(baseUrl).loadBuffer(key);
  try {
    return buffer.length;
  } finally {
    buffer.dispose();
  }
}
```

App-ready의 `buildElapsedMs`에는 서비스 준비 비용을 포함하며 `servicesPreparationElapsedMs`도 별도로 보고합니다.

Web App bootstrap 계약 1은 App 종료·시작 실패 때 quota 대기·서비스 모듈·CanvasKit/폰트 다운로드도 취소합니다. Provider 다운로드 하나가 실패하면 나머지를 중단하고 모두 끝난 뒤 staging credit을 반환합니다. WebAssembly 초기화는 중단할 수 없어 결과를 기다리고 늦은 backend가 Source build나 asset reader에 전달되지 않게 합니다. 확정 heap과 고정 host 예약 320 MiB는 논리적 dispose 뒤에도 실제 worker 종료까지 유지합니다. Bootstrap capability가 없으면 provider 초기화 전에 실패합니다.

- 글꼴·이미지를 `nelyx.assets`에 선언하고 앱에서 참조할 고정 ID를 지정합니다.
- 라이선스 파일을 `notice.path`로 포함하면 패키징 시 자산과 함께 전달합니다.
- `sha256`을 지정하면 해당 bytes를 요구합니다. 생략하면 도구가 생성된 runner 메타데이터에 해시를 계산합니다.
- `packageSource`는 패키지가 export한 자산·고지를 앱으로 복사합니다. 수정된 기존 파일은 보존하고 충돌로 보고합니다.
- Runner의 Metro 자산 map이 요구하는 위치에는 literal `require` 항목을 추가합니다.

글꼴을 변경하면 패키지를 다시 공급하고 네이티브 앱을 재빌드하세요. 자산 준비 절차는 [Metro 가이드](tooling/metro/README.ko.md)에 있습니다.

## 플랫폼 서비스

앱은 SDK startup·View context를 통해 플랫폼 서비스를 받습니다. 클립보드, 환경·locale 관찰, 플랫폼 메시징과 편집·semantics 연결을 제공합니다. 미지원·권한 거부 OS 작업은 타입이 있는 플랫폼 오류로 보고합니다.

플랫폼 메시지 endpoint는 앱이 소유합니다. Background 연결은 호스트가 전달한 endpoint를 사용하며 Worker나 네이티브 worker runtime 생성은 호스트 책임입니다. Worker를 종료하기 전에 연결의 비동기 해제를 기다리세요.

## 이미지 descriptor와 Codec

두 v2 App 모델은 사용자 build 전에 canonical `ui/image-descriptor`·`ui/image-decoder`를 연결합니다. ImageDescriptor를 import하면 App image service 2가 필요하며 없으면 build 전에 실패합니다. `ImageDescriptor.encoded(buffer)`는 실제 Skia decoder로 정보를 읽고, 동기 `raw(buffer, {width, height, rowBytes, pixelFormat})`는 premultiplied rgba8888/bgra8888·행 padding을 받습니다. Descriptor는 공개 buffer와 독립적으로 backing을 유지하고 Codec은 descriptor를, 반환 canonical Image는 ImageService/ResourceRegistry를 통해 독립 frame을 유지합니다. 각 소유 handle을 dispose하세요. instantiateImageCodecFromBuffer/WithSize는 실패 때도 buffer 소유권을 가져가며 instantiateImageCodec(bytes)는 첫 await 전에 호출자 bytes를 캡처합니다.

```ts
import {instantiateImageCodec} from '@nelyx/core/ui/image-decoder';

export async function firstImagePixels(encoded: Uint8Array): Promise<Uint8Array | null> {
  const codec = await instantiateImageCodec(encoded);
  try {
    const {image} = await codec.getNextFrame();
    try { return await image.toByteData(); }
    finally { image.dispose(); }
  } finally { codec.dispose(); }
}
```

현재 decoder control은 실제 Native SkCodec과 기존 소유 CanvasKit heap의 PNG·2-frame GIF 순서/시간/반복·RGBA/BGRA·resize·clone/read·취소/해제를 확인합니다. Encoded 16 MiB·각 축 8192·16 Mi-pixel·descriptor/codec 각 32·frame 64·resident 64 MiB 제한 안에서 픽셀 할당 전에 작업 메모리를 확보합니다. Native descriptor는 SkData를 공유하고 Web encoded/raw transport 복사는 확보한 credit을 사용합니다. 반환 premultiplied rawRgba/rawUnmodified ByteData는 별도 credit(64결과·합계 32 MiB)을 App realm 종료까지 유지합니다. Image native 픽셀은 마지막 holder/read가 끝나면 해제합니다.

이 v2 경로의 floating-point raw/target·PNG/straight-alpha readback은 명시적으로 거부합니다. Canvas 연결·나머지 형식/복구 승인은 미완료입니다. Decoder 검증은 표시된 이미지 frame이나 성능 승인이 아닙니다.

v2 `ImageResource` 경로는 큰 encoded 이미지를 256 KiB chunk로 나누며 기존 packet 1 MiB·resource 32 MiB 예산을 유지합니다. `EngineViewClient`의 `beginImageUpload`·`appendImageUpload`·`finishImageUpload`·`readImageResource`·`releaseImageResource`를 사용합니다. 전체 upload를 마친 뒤에만 자원을 게시하고 token별 동일 재전송은 허용하며 바뀐 bytes는 거부합니다. SceneWriter는 첫 await 전에 큰 payload를 캡처하고 불확실한 upload는 terminal 재확인까지 유지합니다. Content read는 preparation 또는 보유 frame에 묶이므로 producer 해제와 slot 재사용 뒤에도 이전 bytes를 읽습니다. Native Content는 decode한 픽셀을 기록하고 Web Content는 bounded chunk를 읽어 Picture를 Render로 전달합니다. Canonical RawImage는 아래의 별도 Scene snapshot 계약을 사용합니다. CPU·Web pixel 검증은 물리 display·성능 승인이 아닙니다.

기본 Original App bridge는 canonical `RawImage`/`RenderImage` frame을 불변 RGBA Scene 자원으로 그립니다. 사용자 build 전에 App image service 2를 요구합니다. 같은 App의 Image/clone은 확보한 snapshot 한 개를 공유하며 호출자 Image나 codec을 해제해도 보유 Scene/Picture 픽셀은 유지됩니다. Snapshot credit은 반환 `toByteData` credit과 별도이며 수락된 이전 트리·불확실한 upload·마지막 참조 해제까지 유지합니다. Core가 이미지 크기/scale·모든 BoxFit·alignment·repeat tile·RTL 반전·nine-patch 배치와 박스 밖 그리기 범위를 계산합니다. Native Skia와 CanvasKit은 같은 배치에 opacity·tint/blend·색 반전·filter quality를 적용합니다. Attach하지 않은 Source render object의 opacity 변경은 View scheduler가 관찰합니다. Canvas 연결·나머지 형식/복구는 미완료입니다. Native CPU·Web 픽셀 검증은 물리 display·성능 승인이 아닙니다.

기본 Original App은 canonical Image Widget과 MemoryImage·AssetImage·ResizeImage·NetworkImage를 공통 ImageService/ImageCache와 예산을 확보한 불변 buffer decoder에 연결합니다. Native FileImage는 절대 file:/// URI를 사용하며 Web 로컬 파일 IO는 지원하지 않습니다. Image frame과 timer는 View의 실제 Core timestamp와 절대 deadline을 사용하며 callback 수를 제한하고 eviction/close 때 취소합니다. TickerMode는 움직이는 stream의 픽셀 진행을 정지합니다. NetworkImage는 제한한 호출자 header·수신 byte 진행률·진행 중 읽기 취소를 지원하며 기본 Original App은 사용자 build 전에 HTTP header service 2를 요구합니다. Native는 빈 asset key의 정확한 URL을 보존하고 교차 origin redirect에서 호출자 Authorization/Cookie header를 제거합니다. 공개 asset/file/network ByteData credit은 decoder·Scene credit과 별도로 realm 종료까지 유지합니다. Native decoder/IO control과 일반 Web 픽셀 검사는 cache 재사용·resize·GIF frame·회수를 확인하며 visibility/복구·Canvas 연결과 물리/성능 승인은 별도입니다.

## 책임과 수명

| 소유자              | 책임                                                |
| ------------------- | --------------------------------------------------- |
| Core                | 위젯, 상태, 레이아웃, hit test와 논리 semantics     |
| SDK TypeScript      | Backend 구성, 입력, 자산, 서비스와 View 수명        |
| SDK 네이티브 호스트 | VM·bootstrap, 창, event loop와 앱 종료              |
| Skia 패키지         | 렌더링, 문단, 이미지, GPU 제출과 작업 완료 후 해제  |
| 플랫폼 runner       | 의존성, 등록 코드, Metro·Babel과 네이티브 빌드 파일 |

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
