# Nelyx 격리 웹 렌더러 성능 개선 계획

2026-11-25 · 기준 커밋 `9c883ded` · npm CanvasKit `0.42.0` · **계획 작성 완료, 제품 구현 대기**

첫 화면에서는 메인과 렌더 워커가 검증된 CanvasKit 원본을 재사용한다. 스크롤 중에는 화면에 그릴 `SkPicture`를 워커에서 만들고, 새 리소스를 처음 쓰는 프레임을 등록 요청과 함께 보낸다. 로더 개선은 세 렌더 경로에 공통으로 적용하고, Picture 지연 생성과 프레임 제출 변경은 실제 선택된 경로가 `worker-shared`인 뷰부터 적용한다. [기존 렌더 경로와 인수 기록](work3.md) · [SDK 경로 선택](Nelyx/sdk/src/backends/browser/renderer.ts)

## 1. 현재 기준선

Windows Chrome 158.0.8127.37, Radeon 780M의 ANGLE D3D11 하드웨어 WebGL2에서 Demo 릴리스 `cf47ed6df9e7`을 측정했다. 화면은 1280 × 760, DPR 1이었다. 문서의 격리 상태, 워커를 쓰는 경우 워커의 격리 상태, SDK가 최종 선택한 경로를 확인했다. 아래는 새 브라우저 컨텍스트에서 경로 순서를 바꾸며 세 번씩 실행한 중앙값이다.

| 격리 상태의 렌더 경로 | 탐색 시작 → 첫 GPU 완료 표시 | 입력 → GPU 제출 p95 | 스크롤 구간 GPU 완료 프레임 |
| --- | ---: | ---: | ---: |
| `direct` | 811 ms | 31.2 ms | 37 |
| `worker-transfer` | 931 ms | 31.3 ms | 31 |
| `worker-shared` | 929 ms | 26.5 ms | 32 |

갤러리에 합성 휠 입력 16개를 보냈다. 같은 입력에서도 경로별 처리 프레임과 최종 스크롤 위치에 차이가 있었다. 전후 비교에서는 실제 이동 구간과 완료 프레임 수도 기록한다. 첫 GPU 완료는 fence 응답을 받아 캔버스에 준비 상태를 표시한 시각이다. SDK 기본값은 `direct`이므로 일반 웹에서 격리 경로를 재현할 때는 `?renderMode=auto`로 열고 진단값의 `path === 'worker-shared'`, `workerIsolated`, `sharedConsumed`를 확인한다. [Demo 계측 진입점](sample/nelyx-demo-app/src/app-surface.tsx) · [렌더러 진단값](Nelyx/sdk/src/backends/browser/render-telemetry.ts)

| 별도 진단에서 확인한 비용 | 작업에서 확인할 변화 |
| --- | --- |
| HTTP 캐시와 서비스 워커를 끄면 7,317,345바이트 `canvaskit.wasm`을 `direct`에서 2회, `worker-shared`에서 4회 요청한다. 검증된 JS·Wasm Blob을 재사용한 로더 실험에서는 원본 파일을 각각 1회 요청했고, 메인·워커의 8 × 8 WebGL2 캔버스에서 같은 RGBA `[212, 24, 36, 255]`를 읽었다. | 실제 Demo의 정상 기동에서도 파일별 원본 요청이 1회이고 첫 화면이 그려진다. |
| 공유 경로의 휠 입력 16개를 별도로 두 번 추적했다. 스크롤 구간에 메인이 새 화면용 Picture를 48~49개 컴파일했고 워커가 Picture 45~46개를 새로 등록했다. | 같은 장면에서 워커 표시 전용 Picture의 메인 컴파일 횟수가 0이 된다. |
| 같은 두 진단에서 스크롤 중 리소스 등록 요청부터 확인 응답까지의 p95는 2.8~3.0 ms였다. | 새 리소스를 쓰는 첫 프레임을 보내기 위해 기다리는 등록 확인 왕복이 0회가 된다. 워커의 실제 등록 작업 시간은 따로 측정한다. |
| 세 번의 공유 경로 비교에서 최대 화면 패킷은 23,288바이트였고 인코딩 p95의 중앙값은 0.16 ms였다. | 이번 비교에는 현재의 128 KiB 슬롯 2개와 대형 프레임의 전송 버퍼 경로를 사용한다. |

## 2. 첫 화면에서 CanvasKit 원본 재사용

현재 `instantiateCanvasKit()`은 JS·Wasm을 읽고 SHA-256을 검증한 뒤 factory에 `wasmBinary`와 원본 URL을 반환하는 `locateFile`을 넘긴다. 고정된 0.42.0 배포본은 `locateFile`로 받은 URL을 읽는다. 메인과 워커가 이 과정을 각각 실행한다. 워커의 CanvasKit·WebGL2 준비는 공유 슬롯 검사보다 앞서므로, 검증된 파일을 전달할 지점은 최초 `probe` 메시지다. [공통 로더](Nelyx/sdk/src/backends/browser/canvaskit-loader.ts) · [워커 초기화](Nelyx/sdk/src/backends/browser/canvaskit-worker.ts) · [고정 매니페스트](Nelyx/skia/packages/web/native-manifest.json)

1. 원본 획득·검증과 CanvasKit 인스턴스 생성을 분리한다. 기존 앱 루트·경로·크기·SHA-256 검사를 통과한 JS와 Wasm으로 불변 Blob을 만든다. 같은 페이지의 사전 로드, 뷰 열기, 워커 재시작이 같은 릴리스의 준비 결과를 사용하도록 기존 Promise 캐시를 확장한다. 실패한 준비는 캐시에서 제거하고, 다른 릴리스 해시가 들어올 때의 페이지 재로드 계약을 지킨다. [메인 로더 캐시](Nelyx/sdk/src/backends/browser/canvaskit.ts) · [사전 로드와 뷰 열기](Nelyx/sdk/src/frontend/dom/application.ts)
2. 메인은 기존 script 초기화, 워커는 기존 module 초기화에 같은 검증 원본을 쓴다. `probe`에 매니페스트 식별 정보와 Blob을 넣고 워커에서 세션·버전·파일 식별을 확인한다. 각 실행 영역이 Wasm Blob에 `application/wasm` 객체 URL을 만들어 `locateFile`에서 반환하고, factory 초기화가 끝나거나 실패하면 자신이 만든 URL을 회수한다. 두 CanvasKit 인스턴스는 각자의 Wasm 메모리와 GPU 객체를 소유한다. [렌더 메시지 계약](Nelyx/sdk/src/backends/browser/render-protocol.ts) · [Emscripten의 locateFile](https://emscripten.org/docs/api_reference/module.html#Module.locateFile)
3. 콜드 로드에서는 원본 HTTP 요청 수와 실제 첫 GPU 완료 시간을 각각 검사한다. PWA 오프라인 재시작과 Tauri에서는 해당 호스트의 URL·CSP로 JS 실행과 Wasm Blob 읽기를 모두 확인한다. 워커에만 적용된 정책 차단은 기존 직접 렌더링 복구로 연결하고, 공통 매니페스트·해시·필수 바인딩 오류는 초기화 오류로 보고한다. 기존 배포에서 메인의 Wasm Blob 읽기가 차단되는 경우에도 배포 CSP 아래에서 검증된 바이트로 기동하는 호환 경로를 확인한다. [기존 기동·복구 검사](Nelyx/eng/check-web-renderers.mjs) · [PWA 업데이트 검사](Nelyx/eng/check-pwa-update.mjs)

## 3. 화면용 Picture의 메인 중복 컴파일 제거

`FramePictureService.resource()`는 Picture 객체가 캐시에 없으면 즉시 백엔드의 `compile()`을 호출한다. Web 백엔드는 명령을 CanvasKit recorder에 재생하고 `approximateBytesUsed()`를 얻는다. 워커에는 그 명령을 다시 인코딩해 보내고, 수신 측은 자체 recorder로 새 `SkPicture`를 만든다. 이미 같은 Picture 객체를 재사용하는 캐시가 있으므로, 바꿀 지점은 캐시를 처음 채울 때의 메인 컴파일이다. [Picture 캐시와 수명](Nelyx/src/hosting/pictures.ts) · [Web Picture 구현](Nelyx/skia/packages/web/src/library.ts) · [워커 Picture 등록](Nelyx/sdk/src/backends/browser/render-worker-resources.ts)

1. 뷰에서 `worker-shared`가 선택되면 메인은 화면용 Picture의 ID·세대, 불변 명령 캡처, 의존 리소스의 lease를 보관한다. 워커는 자기 세대에서 그 ID를 처음 등록할 때 한 번 컴파일한다. 메인에 실제 Skia 객체가 필요한 중첩 Picture 재생, `Picture.toImageSync()`, 직접 경로 복구에서는 보관한 캡처로 필요 시 생성한다. 이미 있는 `framePicture()` 복원 경로와 rasterization 캐시를 활용한다. [서비스 조립](Nelyx/sdk/src/backends/browser/services.ts) · [동기 이미지 변환](Nelyx/src/hosting/rasterization.ts)
2. 메인 캐시의 현재 32 MiB 예산에는 캡처와 실제로 생성한 메인 native 객체를 반영한다. 워커의 현재 검사는 메인에서 구한 `nativeBytes`가 상한이라고 가정하므로 송수신 계약도 함께 바꾼다. 등록 전에는 캡처·wire와 대기 중인 등록의 예산을 예약하고, 워커가 컴파일한 뒤 얻은 실제 바이트를 ID·세대별로 회신해 96 MiB 리소스 예산에 정산한다. 메인에서 뒤늦게 컴파일할 때도 추가 바이트를 반영한다. 초과 시 임시 native 객체와 예약을 정리하고 해당 등록의 실패를 전달한다. [리소스 비용 정의](Nelyx/sdk/src/backends/browser/render-protocol.ts) · [송신 측 등록·해제](Nelyx/sdk/src/backends/browser/render-resources.ts)
3. 스크롤만 하는 장면과 동기 readback이 섞인 장면을 나누어 메인·워커 컴파일 수를 센다. 같은 ID의 반복 그리기, 중첩 Picture, 캐시 퇴출, context loss 후 새 워커 등록, 워커에서 직접 렌더링으로 전환한 첫 프레임을 확인한다. 원본 명령, 폰트·이미지와 중첩 Picture의 참조는 GPU 사용이 끝나거나 렌더러 종료가 확인될 때까지 살아 있어야 한다.

## 4. 새 리소스와 첫 사용 프레임을 한 메시지로 제출

현재 `RenderResourceSender.ready()`가 새 리소스를 발견하면 `register`를 보내고, `RenderWorkerFrames.submit()`은 `busy`를 반환한다. 메인은 `registered` 응답 후 보관한 프레임을 즉시 다시 제출한다. 이 경로에는 이미 다음 화면 갱신까지의 대기를 줄이는 처리가 있다. 이번 작업은 메인에서 확인 응답을 받아야 첫 프레임을 보낼 수 있는 순서를 바꾼다. [송신 측 프레임 처리](Nelyx/sdk/src/backends/browser/render-worker-frames.ts) · [준비된 프레임 재제출](Nelyx/src/hosting/runtime.ts)

1. 리소스 묶음을 준비하는 일과 전송하는 일을 분리한다. 공유 경로는 의존 리소스부터 ID를 할당한 뒤, 그 ID로 인코딩한 프레임의 슬롯 번호·ticket과 신규 등록 묶음을 하나의 `frame` 메시지로 보낸다. 폰트·이미지·Picture의 전송용 버퍼를 같은 전송 목록에 포함한다. 슬롯 상한을 넘는 프레임은 기존처럼 전송용 `ArrayBuffer`를 사용한다. 등록할 것이 없는 프레임은 기존의 작은 메시지를 쓴다. [워커 메시지와 슬롯 규격](Nelyx/sdk/src/backends/browser/render-protocol.ts)
2. 워커는 같은 메시지의 리소스를 의존 순서대로 등록한 뒤 해당 프레임을 기존 그리기 대기열에 넣는다. `registered`는 등록 결과와 바이트 정산에 사용한다. 송신 측은 이 확인을 기다리지 않고 **해당 프레임**을 이미 제출했으므로 응답에서 이 프레임을 재제출하지 않는다. 후속 프레임에는 기존 등록 대기 제한을 활용해 미확인 ID의 중복 할당을 막는다. 같은 워커 세대에서 resize·숨김으로 프레임이 폐기돼도 이미 등록된 ID의 상태는 양쪽이 일치해야 한다. [워커 수신·프레임 폐기](Nelyx/sdk/src/backends/browser/renderer-worker.ts)
3. 등록 묶음과 메모리 예약을 준비하고 프레임을 슬롯에 다 쓴 뒤, `Atomics.store`로 길이를 쓰고 마지막에 ticket을 게시한다. 전송 전 확정된 실패는 임시 ID와 예약까지 되돌려 다음 리소스 ID가 연속되게 한다. 일부 등록 후 실패하거나 전송 여부가 불확실하면 해당 워커 세대의 승인을 닫고 종료 처리로 소유권을 회수한다. 정상 경로에서는 슬롯은 소비 후, 프레임 lease는 GPU fence 완료 후 반환한다. 최대 두 프레임, 호출 중 동기 승인 알림, 뷰·워커·컨텍스트 세대와 제출 번호 대조, 프레임당 한 번의 반환을 지킨다. 메시지 형식 변경은 메인과 워커의 프로토콜 버전 검사에 반영한다. [승인·완료 이벤트](Nelyx/src/hosting/renderer-events.ts) · [워커 포트 수명](Nelyx/sdk/src/backends/browser/render-worker-port.ts)

## 5. 구현 순서와 완료 판정

- [ ] **기준선 재현.** 위 세 소스 경로를 먼저 대조하고 기존 브라우저 검사기에 필요한 계측을 추가한다. 같은 장비·릴리스 설정으로 변경 전 세 번을 측정한다. 위 표의 휠 시나리오는 `Filled` 버튼이 속한 목록에 `+15`를 8회, `-15`를 8회 보내고 입력 사이에 화면 갱신 두 번을 둔다. 기존 Demo 검사의 스크롤·텍스트 선택 시나리오도 기능 회귀에 사용한다.
- [ ] **CanvasKit 로더.** 캐시와 서비스 워커를 끈 새 문서에서 JS·Wasm 원본 요청이 파일별 1회이고, 워커 재시작에도 같은 검증 원본을 쓴다. 손상된 파일, 워커 차단, 뷰 닫기 중 기동을 검사한다.
- [ ] **Picture 소유권.** 표시 전용 장면의 메인 컴파일 0회, 같은 워커 세대·ID의 컴파일 1회를 확인한다. 로컬 readback과 직접 경로 복구에서 픽셀을 비교하고, 예산 초과·등록 실패·퇴출 후에도 실제 바이트와 lease가 정확히 정산되는지 확인한다.
- [ ] **리소스와 프레임 동시 제출.** 새 리소스가 있는 첫 프레임이 등록 ACK 전에 한 번 전송되고, 워커가 등록을 마친 뒤 그려지는 것을 같은 제출 번호로 확인한다. 대형 프레임, 두 프레임 대기 중 resize·숨김, 워커 종료·재시작, 부분 등록 실패에서 중복 제출·반환과 이전 세대 접근을 검사한다.
- [ ] **통합 비교.** 격리 상태의 세 경로와 비격리 상태의 `auto → worker-transfer`를 확인한다. 같은 장면에서 클립 픽셀·텍스트 선택 좌표·중첩 Picture·동기 readback 결과를 대조한다. 기동은 탐색 시작부터 첫 GPU 완료까지, 스크롤은 입력→GPU 제출 p95와 메인 프레임 작업 p95로 판정한다. 변경 전후 각 3회의 범위와 중앙값, 실제 이동량, 완료·폐기 프레임 수, 리소스 최대 바이트를 함께 기록한다. 이동량과 완료 프레임이 동등한 조건에서 반복 편차를 넘는 시간 감소를 성능 개선으로 기록한다. 편차가 겹치거나 대조 경로에서 회귀가 생기면 해당 지표와 환경을 이 문서에 남긴다.

### 검증 진입점

다음 명령은 저장소 루트의 PowerShell에서 실행한다. 루트 `build:web`은 SDK 공급과 샘플 설치를 거친 릴리스를 만든다. 각 검사는 저장소 실행기의 20분 제한을 사용한다. [샘플 빌드](Nelyx/eng/build-sample.mjs) · [실행기](Nelyx/sdk/tooling/cli/src/commands.mjs)

```powershell
function Invoke-NelyxCheck {
    node --input-type=module -e "import { execute } from './Nelyx/sdk/tooling/cli/src/commands.mjs'; await execute(process.execPath, process.argv.slice(1), { timeout: 1200000 })" -- @args
    if ($LASTEXITCODE -ne 0) { throw "검사 실패 ($LASTEXITCODE)" }
}

npm.cmd run build:web -- --app sample/nelyx-demo-app
if ($LASTEXITCODE -ne 0) { throw "Demo 빌드 실패" }
$demoRelease = 'sample/nelyx-demo-app/.nelyx/web'
Invoke-NelyxCheck Nelyx/eng/check-web-canvaskit.mjs
Invoke-NelyxCheck Nelyx/eng/check-web-frame-wire.mjs
Invoke-NelyxCheck Nelyx/eng/check-web-renderers.mjs --demo $demoRelease --suite demo --trials 3
Invoke-NelyxCheck Nelyx/eng/check-web-renderers.mjs --demo $demoRelease --suite shared-memory
Invoke-NelyxCheck Nelyx/eng/check-web-renderers.mjs --demo $demoRelease --suite recovery
Invoke-NelyxCheck Nelyx/eng/check-web-renderers.mjs --demo $demoRelease --suite pwa
Invoke-NelyxCheck Nelyx/eng/check-pwa-update.mjs
```

중첩 Picture·동기 readback·대형 프레임은 기존 검증 장면을 앱 엔트리로 빌드한 릴리스를 `--suite scene --fixture <장면 릴리스 경로>`에 넘겨 확인한다. Tauri WebView2에서는 같은 SDK로 Windows Demo를 패키징한 뒤 `node Nelyx/eng/check-tauri-windows.mjs sample/nelyx-demo-app --render-mode=auto`로 실제 선택 경로와 첫 프레임을 기록한다. 임시 장면과 브라우저 프로필은 실행 종료 시 정리한다. [검증 장면](Nelyx/eng/fixtures/web-renderer-scene.mjs) · [브라우저 검사](Nelyx/eng/check-web-renderers.mjs) · [Windows WebView2 검사](Nelyx/eng/check-tauri-windows.mjs)
