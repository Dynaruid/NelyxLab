# Nelyx SDK

[English](README.md) | **한국어**

앱은 src/index.ts의 main()에서 위젯 정의를 제공하고 ApplicationSurface에 연결합니다. registerApplication은 DOM 컨테이너에 React 컴포넌트를 마운트합니다. close()는 React 루트를 해제하고 캔버스와 그래픽 리소스 정리가 끝날 때까지 기다립니다. Vite 기본 진입점은 코드 갱신 시 closeAllWebApplications를 기다린 다음 페이지를 다시 엽니다.

브라우저와 Tauri는 같은 SDK와 CanvasKit 렌더러를 실행합니다. Nelyx가 캔버스, 리소스 수명, 선택·IME 입력, DOM 접근성과 브라우저 서비스를 관리합니다. getWebDeployment는 PWA 형식과 browser·tauri 호스트, 판별한 OS를 반환합니다. Tauri IPC 권한은 앱의 메인 WebView와 capability에서 설정합니다.

package.json에 nelyx.app/v3, appEntry, assets, pwa를 선언합니다. pwa에는 React 컴포넌트와 설치 ID, 짧은 이름, 아이콘, 테마색을 둡니다. 기존 v2의 targets.web과 공용 구성은 메모리에서 읽습니다. 자산은 앱 상대 경로를 사용합니다. 러너는 폰트·이미지와 고지를 검증하고 빌드에 포함합니다.

[CLI와 전환 방법](tooling/cli/README.ko.md) · [Core](../README.ko.md) · [렌더러](../skia/README.ko.md)
