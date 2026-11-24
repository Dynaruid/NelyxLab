# Nelyx 앱

SDK 공급 후 이 디렉터리에서 `npm ci --workspaces=false`를 실행합니다. UI 진입점은 `src/index.ts`입니다. 앱에 백엔드 디렉터리가 있으면 `backend/src/lib.rs`에 공용 Rust 명령을 등록합니다.

웹 타깃은 `npm run prepare:web`, `npm run dev:web`, `npm run build:web`, `npm run run:web`를 사용합니다. Windows Tauri 타깃은 `npm run prepare:tauri -- --platform windows`, `npm run build:tauri -- --platform windows`, `npm run run:tauri -- --platform windows`를 사용합니다. 다른 OS는 준비된 도구에 맞게 플랫폼을 지정합니다. `backend/locks/`에 생성한 Cargo 잠금을 버전 관리합니다.

Tauri 앱에서 모바일 햅틱과 Android 시스템 뒤로 가기를 켜려면 `nelyx.targets.tauri.windows`의 해당 창에 `haptics: true`, `androidBack: true`를 추가합니다. `npm run prepare:tauri -- --platform android --update-lock`으로 Cargo 잠금을 갱신합니다. 스타터의 Copy·Paste 버튼은 표준 위젯 클립보드 API를 사용합니다. 창 설정에서 `clipboard.read`나 `clipboard.write`를 `false`로 지정하면 해당 네이티브 작업을 끕니다. `clipboard`를 생략하면 WebView 클립보드를 사용합니다.
