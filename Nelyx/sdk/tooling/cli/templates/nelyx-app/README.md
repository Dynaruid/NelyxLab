# Nelyx application

Install the supplied packages from web/runner with npm ci --workspaces=false. Run npm run prepare:pwa, npm run typecheck and npm run dev there. From the app root, npm run build:pwa publishes .nelyx/pwa and npm run run:pwa serves it.

To add a Tauri host, install @tauri-apps/cli@2.12.6 in the app root, then run npm run prepare:windows and npm run pack:windows. Use the corresponding scripts on other platforms. The host consumes the same published PWA.
