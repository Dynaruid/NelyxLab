# Nelyx Metro

[English](README.md) | **한국어**

`@nelyx/metro`는 독립 플랫폼 runner용 Metro 설정, 자산 확인, Web bundle과 개발 서버를 제공합니다. Node.js **>=24.3.0 <25**를 사용합니다. 명시적인 빌드·개발 명령의 수명은 [CLI](../cli/README.ko.md)가 관리합니다.

## 모듈

| import | 용도 |
| --- | --- |
| `@nelyx/metro/runner-config` | RN runner cohort 확인과 Metro/TypeScript 설정 생성 |
| `@nelyx/metro/rn-config` | 네이티브 Metro 해석·변환 설정 |
| `@nelyx/metro/babel-config` | 제품 ES2022 static block을 RN class 변환 전에 처리 |
| `@nelyx/metro/assets` | 앱 자산 검증 |
| `@nelyx/metro/web-config` | Web Metro 해석 설정 |
| `@nelyx/metro/web-build` | Web 출력·자산·런타임 파일 빌드 |
| `@nelyx/metro/web-development` | Web 개발 출력 서비스 |
| `@nelyx/metro/web-refresh` | Web refresh 연결 |

모듈을 직접 import합니다. RN preset에는 대상 runner 루트와 정확한 의존성 cohort를 전달합니다. 공통 앱 코드는 `src/`에, 플랫폼 등록 코드는 각 runner의 `main.ts`에 둡니다.

Windows/macOS의 실행 전 `InitializeCore`는 선택한 RNW/RN-macOS façade의 경로를 사용합니다. Metro는 이 절대 경로를 resolver alias 없이 graph와 직접 비교합니다. runner는 façade를 먼저 초기화하고 기본 RN initializer의 중복을 제거하며 사용자 추가 hook을 유지해 AppRegistry 실행 전에 플랫폼 performance/timer 설정을 갖춥니다.

## Runner 설정

네이티브 runner는 `@nelyx/metro/runner-config`의 `createRunnerConfig({target, runnerRoot, appRoot})`를 사용합니다. 전체 예시는 샘플의 [Windows 설정](../../../../sample/nelyx-testbed-app-2/windows/runner/metro.config.cjs)과 [Web 설정](../../../../sample/nelyx-testbed-app-2/web/runner/metro.config.cjs)에 있습니다.

Runner가 Metro/Babel 설정과 의존성을 관리합니다. 일반 빌드에서 공급 ABI, 자산 hash, source map과 모듈 경계를 확인합니다. SDK 런타임 import는 Metro나 빌드를 시작하지 않으며 CLI의 명시적 `dev`·`build`가 도구 수명을 관리합니다.

native `babel.config.cjs`는 `module.exports=require('@nelyx/metro/babel-config')`를 사용합니다. 공통 설정은 runner가 선택한 `@react-native/babel-preset`을 설정 루트에 둡니다. 로컬 archive 변경 후에는 재공급·설치하고 Metro를 다시 시작합니다.

Windows V8 공개 빌드는 `@nelyx/metro/native-v8-transformer`를 사용합니다. 별도 Metro 개발/도구 실행에서는 `createRunnerConfig({target:'windows', runnerRoot, appRoot, javaScriptEngine:'v8'})`로 선택합니다. 고정 RN0.83.10 preset의 Flow/JSX/modules·소비자 Babel 설정·개발 refresh는 유지하고, 표준 class/field/private·lexical scope·구조 분해·async/generator는 V8에서 실행합니다. build ACK와 현재 Windows package manifest에 `v8CompilerPolicy=nelyx.v8-native-es2022-rn0.83.10/v2`을 기록하며, CLI는 이전 builder의 ACK를 packaging 전에 거부합니다. 기본/Hermes runner는 기존 RN 변환을 유지합니다. 사용자 Babel plugin은 `babel.config.cjs`에 두며 별도 Babel transformer는 명시적 합성이 필요합니다.

## 선언 확인

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run check:metro-types
```

Compiler로 도구 선언을 확인하는 명령입니다. 실제 runner 빌드·서비스는 [샘플 가이드](../../../../sample/nelyx-testbed-app-2/README.ko.md)를 참고하세요. 선언 확인만으로 런타임 동작이 입증되지는 않습니다.

Windows host는 검증한 asset bytes를 기존 `Assets/` 경로로 복사하고 Skia loader가 hash를 확인합니다. 별도 native editor font header/registry는 사용하지 않습니다.

## 라이선스

Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 수입 코드 고지는 [`licenses/`](licenses/)에 유지합니다.
