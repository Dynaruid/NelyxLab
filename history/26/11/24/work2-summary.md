# 디바이스 API의 Tauri 플러그인과 web-sys 바인딩

원문 `work2.md` · 작성·실행 2026-11-24 KST · 기준 `tauri-backend` `7cb6ab32` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work2.md`

**당시 판정은 추가 디바이스 API 구현 완료, 실기기 인수 대기다.** [Rust 백엔드와 빌드 전환](../23/work-summary.md)

## 구현

- 백엔드 프로토콜 2에서 기존 `Clipboard`와 `HapticFeedback` API에 Web의 `web-sys`·`wasm-bindgen` 및 Tauri 창별 플러그인을 연결했다. 자체 IPC `describe`·`clipboard_policy`의 TypeScript 호출 타입은 Specta로 생성한다. 모바일 메뉴는 사전 읽기 없이 명시적 붙여넣기 때 내용을 읽는다. Tauri의 클립보드 설정을 생략한 창은 WebView 경로를 쓰고, 네이티브 호출의 거절은 호출자에게 전달한다.
- Android 뒤로 가기는 소유 뷰에서 `popRoute`를 한 번 시도하고 미처리 시 WebView 기록이나 Activity의 기본 동작에 위임한다. 뷰 종료 시 클립보드 권한 관찰과 뒤로 가기 리스너를 해제한다. 예측형 뒤로 가기 진행 동작은 별도 범위다.
- 프로토콜 3에서 `deviceServicesFor(context.services)`로 위치·알림·파일·링크·저장·카메라·바코드·NFC·인증·배터리·센서·BLE·공유를 공개했다. 지원되는 호스트 API와 창별 권한으로 연결하고 뷰 종료 시 구독과 연결을 해제한다. 앱 저장소는 앱 전용 파일의 키·값을 취급하고 Android 딥링크 선언은 호스트 생성 시 갱신한다. Demo의 **Device services**에서 사용자 동작으로 호출한다. [공개 SDK 계약](../../../../Nelyx/sdk/src/devices.ts)

## 당시 검증

| 환경 | 확인 결과 |
| --- | --- |
| 공통 검사 | Specta 재생성, Rust 정책, SDK·샘플 타입과 확장 서비스 검사 통과. 확장 검사에서 하드웨어 결과를 다루는 경로에는 테스트 입력을 사용했다. |
| Web·PWA | Demo `22e493545e19`의 Wasm 위치, 서비스 워커 알림, 바이너리 파일 읽기와 설정 복원을 확인했다. Demo·Testbed와 기본 Wasm 정적 스타터를 루트와 `/demo/`에서 확인했다. 모바일 편집 메뉴의 사전 읽기 0회·명시적 붙여넣기 1회, Tauri 런타임 의존성 0건이 기록됐다. |
| Windows x64 | Demo의 네이티브 클립보드와 Testbed의 WebView 경로, 다중 WebView의 읽기·쓰기 권한 조합을 확인했다. 프로토콜 3 Demo `9a0c14cef868`에서 앱 저장소, 바이너리 파일 선택, 선택 범위 밖 읽기와 미허용 URL 차단, 최초·실행 중 딥링크를 확인했다. |
| Android x64 에뮬레이터 | API 33에서 OS 클립보드, 제스처·키 뒤로 가기, 햅틱 IPC 8종, 여백과 딥링크를 검증했다. 저장소 왕복과 위치·카메라·알림 권한, NFC·생체 인증의 가용성 응답을 확인했다. |
| Android ARM64·iOS | ARM64 디버그 서명 APK와 미서명 AAB의 ABI·해시를 확인했다. iOS는 잠긴 Cargo 그래프와 권한 문구, NFC entitlement, 딥링크 생성까지 확인했다. |

웹 Demo Wasm은 76,507 → 85,504 → 87,091바이트였다. 최종 위치 바인딩 포함 빌드의 시작 시간은 Chrome 단일 실행에서 루트 26ms, `/demo/` 24ms였다.

당시 Galaxy 설치·실행, Android와 iOS의 햅틱 촉감, 카메라·바코드·NFC·생체 인증 등 실기기 동작과 iOS Xcode 빌드가 남았다. [디바이스 검사](../../../../Nelyx/eng/check-device-services.mjs) · [확장 서비스 검사](../../../../Nelyx/eng/check-expanded-device-services.mjs)
