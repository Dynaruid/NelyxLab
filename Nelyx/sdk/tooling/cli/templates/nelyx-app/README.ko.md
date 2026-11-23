# Nelyx 앱

SDK 공급 후 이 디렉터리에서 `npm ci --workspaces=false`를 실행합니다. UI 진입점은 `src/index.ts`입니다. 앱에 백엔드 디렉터리가 있으면 `backend/src/lib.rs`에 공용 Rust 명령을 등록합니다.

웹 타깃은 `npm run prepare:web`, `npm run dev:web`, `npm run build:web`, `npm run run:web`를 사용합니다. Windows Tauri 타깃은 `npm run prepare:tauri -- --platform windows`, `npm run build:tauri -- --platform windows`, `npm run run:tauri -- --platform windows`를 사용합니다. 다른 OS는 준비된 도구에 맞게 플랫폼을 지정합니다. `backend/locks/`에 생성한 Cargo 잠금을 버전 관리합니다.
