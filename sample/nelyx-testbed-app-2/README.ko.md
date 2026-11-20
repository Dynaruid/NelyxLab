# Nelyx Testbed

[English](README.md) | **한국어**

리스트, 텍스트 편집, 접근성을 포함한 Core·Material·Cupertino 위젯을 확인하는 갤러리입니다.

## 공급과 개발 실행

저장소 루트에서 Node.js 24.x와 고정 CanvasKit을 준비합니다. [SDK 준비](../../README.ko.md#testbed와-demo-실행)

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- web sample/nelyx-testbed-app-2
npm.cmd ci --prefix sample/nelyx-testbed-app-2/web/runner --workspaces=false
npm.cmd run dev --workspace @nelyx/testbed-2
```

## PWA와 Tauri

```powershell
npm.cmd run build:pwa --workspace @nelyx/testbed-2
npm.cmd run run:pwa --workspace @nelyx/testbed-2 -- --base /demo/
```

브라우저는 게시된 .nelyx/pwa를 사용합니다. 설치 ID는 버전이 바뀌어도 유지됩니다. OS별 패키징에는 같은 디렉터리를 전달합니다.

```powershell
npm.cmd run prepare:windows --workspace @nelyx/testbed-2
npm.cmd run pack:windows --workspace @nelyx/testbed-2
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

dev:windows를 실행하면 Vite에 연결된 앱 창이 열립니다. Android·Linux·macOS·iOS도 해당 도구를 설치하고 각 플랫폼의 prepare, pack, run, dev 명령을 실행합니다. build:windows는 PWA 빌드와 Windows 패키징을 차례로 실행합니다. [CLI 명령](../../Nelyx/sdk/tooling/cli/README.ko.md#tauri-호스트-추가)

앱에서 공용 소스·자산·라이선스와 src-tauri를 관리합니다. [저장소 문서](../../README.ko.md#문서)
