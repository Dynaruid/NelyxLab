# Nelyx Skia

[English](README.md) | **한국어**

@nelyx/skia-web 패키지는 브라우저와 Tauri WebView에 고정 CanvasKit/Ganesh WebGL2 런타임을 공급합니다. Vite 개발과 PWA 빌드는 설치 패키지의 JS와 Wasm을 읽고 native-manifest.json의 해시를 대조합니다.

새 checkout에서는 CanvasKit을 빌드하고 패키지에 공급한 뒤 npm run build:sdk를 실행합니다. npm run build:skia는 공급 파일을 검사하고 Web 어댑터를 빌드합니다. [소스 레시피와 고정 버전](eng/source-build/README.md)

재사용한 Skia와 React Native Skia 코드의 출처와 라이선스를 유지합니다. [제3자 고지](THIRD_PARTY_NOTICES.md) · [패키지](packages/web/README.md)
