# Nelyx Skia

[English](README.md) | **한국어**

브라우저와 Tauri WebView는 npm 패키지 `canvaskit-wasm@0.42.0`의 기본 WebGL2 빌드를 사용합니다. 프런트엔드 빌드는 설치된 JS와 Wasm의 해시를 매니페스트와 대조한 뒤 두 파일을 앱의 로컬 자산으로 포함합니다. [런타임 매니페스트](packages/web/native-manifest.json)

`npm install`를 실행한 뒤 `npm run build:sdk`로 SDK를 빌드합니다. `npm run build:skia`는 Web 어댑터를 컴파일합니다.

네이티브 전경을 켠 Tauri 창은 Web frame wire v1의 투명 clear, 평행이동, 사각 클립, 사각형, 둥근 사각형과 선을 Skia로 그립니다. SDK가 고정된 아카이브 길이와 SHA-256을 확인한 뒤 Cargo 잠금 파일로 빌드합니다. Windows는 premultiplied BGRA 픽셀을 D3D11로 DirectComposition에 업로드하고, Android는 premultiplied RGBA 픽셀을 투명 `TextureView`에 게시합니다. Linux는 premultiplied BGRA 픽셀을 Cairo로 `GtkOverlay`에 그립니다. iOS와 macOS는 클립 범위의 premultiplied BGRA 픽셀을 Metal로 투명 `CAMetalLayer`의 drawable에 복사합니다. [공급 매니페스트](../sdk/tooling/cli/templates/tauri/skia-foreground/supply.json) · [Windows 독립 검사](eng/build-native-foreground.mjs)

저장소 루트에서 실행합니다.

```powershell
node Nelyx/skia/eng/build-native-foreground.mjs test
```

재사용한 Skia와 React Native Skia 코드의 출처와 라이선스를 유지합니다. [제3자 고지](THIRD_PARTY_NOTICES.md) · [패키지](packages/web/README.md)
