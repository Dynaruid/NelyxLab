# Nelyx 애플리케이션

[English](README.md) | **한국어**

공통 TypeScript UI·상태, 편집기, drawing·text·keyboard 예제와 내비게이션을 제공하는 Nelyx 시작 앱입니다. `src/index.ts`와 `src/`의 모듈을 수정해 공통 UI를 작성합니다.

각 플랫폼은 의존성, 등록 코드와 네이티브·브라우저 빌드 설정을 위한 독립 runner를 사용합니다.

## 시작하기

Node.js **>=24.3.0 <25**와 npm을 사용합니다. 새로 만든 Web 앱은 앱 루트에서 실행합니다.

```powershell
npm --prefix web/runner install --workspaces=false
npm --prefix web/runner run check
npm --prefix web/runner run dev
```

`http://127.0.0.1:8081/`에 접속하고 Ctrl+C로 서버를 종료합니다. 정적 출력은 `npm --prefix web/runner run build`를 사용합니다.

이미 공급된 lockfile이 있는 앱은 해당 runner에서 `npm ci --workspaces=false`로 설치합니다. 네이티브 대상을 빌드하기 전에 호환되는 패키지 archive와 네이티브 입력을 공급하세요.

## 플랫폼 가이드

앱 생성 시 선택한 대상의 가이드를 따르세요.

| 대상 | Runner 가이드 |
| --- | --- |
| Web | [개발과 정적 빌드](web/runner/README.md) |
| Windows | [네이티브 입력, 빌드와 실행](windows/runner/README.md) |
| Android | [SDK·NDK와 APK 빌드](android/runner/README.md) |
| iOS | [Xcode, Pods와 시뮬레이터 빌드](ios/runner/README.md) |
| macOS | [Xcode, Pods와 네이티브 빌드](macos/runner/README.md) |
| Linux | [RNL 공급과 GTK 호스트](linux/runner/README.md) |

Windows 기본값은 RNW의 Hermes bytecode입니다. 대체 엔진과 실험적인 직접 Hermes 호스트에는 명시적인 CLI 옵션과 대응하는 공급 파일이 필요합니다.

## 앱 설정

루트 `package.json`의 `nelyx`에 앱 진입점, 네이티브 등록 이름, 표시 이름, 자산과 대상별 profile을 선언합니다. 각 `<target>/runner/main.ts(x)`가 플랫폼 컴포넌트를 등록합니다.

루트 설정을 수정하고 준비 명령으로 생성된 `runner/app-config.json`을 갱신하세요. 글꼴·이미지와 고지를 함께 선언합니다. 도구가 생략된 해시를 계산하고 명시한 해시를 검사합니다. Runner의 Metro map이 요구하는 위치에는 literal 자산 `require`를 추가합니다.

## 프로젝트 구성

| 경로 | 용도 |
| --- | --- |
| `src/` | 공통 UI와 앱 로직 |
| `assets/` | 앱 자산과 고지 |
| `<target>/runner/` | 대상별 의존성, 등록 코드와 도구 |
| `.nelyx/` | 생성된 공급 파일과 빌드 출력 |

`@nelyx/core/framework/widgets/basic`·`@nelyx/sdk/platforms/web/surface`처럼 명시적인 패키지 하위 경로에서 import합니다. 앱이 소유한 controller·자원은 소유자가 끝날 때 해제하세요.

Nelyx는 실험적인 프로젝트로 프레임워크·플랫폼 지원이 불완전합니다. 앱을 배포할 때 가져온 글꼴·런타임·렌더러 라이선스를 유지하세요.
