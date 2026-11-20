# Nelyx 앱

web/runner에서 npm ci --workspaces=false로 공급 패키지를 설치합니다. npm run prepare:pwa, npm run typecheck, npm run dev 순서로 실행합니다. 앱 루트에서 npm run build:pwa로 .nelyx/pwa를 만들고 npm run run:pwa로 제공합니다.

Tauri는 앱 루트에 @tauri-apps/cli@2.12.6을 설치하고 npm run prepare:windows와 npm run pack:windows로 준비합니다. 다른 플랫폼도 해당 스크립트를 사용합니다. 패키저는 이미 게시한 PWA를 내장합니다.
