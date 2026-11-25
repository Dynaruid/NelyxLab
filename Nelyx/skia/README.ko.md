# Nelyx Skia

[English](README.md) | **한국어**

브라우저와 Tauri WebView는 npm 패키지 `canvaskit-wasm@0.42.0`의 기본 WebGL2 빌드를 사용합니다. 프런트엔드 빌드는 설치된 JS와 Wasm의 해시를 매니페스트와 대조한 뒤 두 파일을 앱의 로컬 자산으로 포함합니다. [런타임 매니페스트](packages/web/native-manifest.json)

`npm install`를 실행한 뒤 `npm run build:sdk`로 SDK를 빌드합니다. `npm run build:skia`는 Web 어댑터를 컴파일합니다.

재사용한 Skia와 React Native Skia 코드의 출처와 라이선스를 유지합니다. [제3자 고지](THIRD_PARTY_NOTICES.md) · [패키지](packages/web/README.md)
