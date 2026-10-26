# Nelyx Metro

[English](README.md) | **한국어**

`@nelyx/metro`는 Nelyx의 독립 플랫폼 runner를 위한 Metro 설정, 자산 준비, Web 번들과 개발 서버를 제공합니다. Node.js **>=24.3.0 <25**를 사용합니다. 명시적인 빌드·개발 작업은 [CLI](../cli/README.ko.md)가 담당합니다.

## 모듈

| Import | 용도 |
| --- | --- |
| `@nelyx/metro/runner-config` | 네이티브 runner 설정과 의존성 cohort 검사 |
| `@nelyx/metro/rn-config` | 네이티브 Metro 해석·변환 |
| `@nelyx/metro/babel-config` | 공통 네이티브 Babel 설정 |
| `@nelyx/metro/assets` | 자산 복사·검증 |
| `@nelyx/metro/web-config` | Web runner 설정 |
| `@nelyx/metro/web-build` | Web 출력, 자산과 런타임 파일 |
| `@nelyx/metro/web-development` | Web 개발 서버 |
| `@nelyx/metro/web-refresh` | Web refresh 연결 |
| `@nelyx/metro/runtime-inventory` | 설치된 Windows Metro 소스 그래프 조사 |

하위 경로에서 직접 import합니다. 전체 export는 [package.json](package.json)에 있습니다.

## Runner 설정

Windows의 `metro.config.cjs` 예입니다.

```js
const path = require('node:path');
const {createRunnerConfig} = require('@nelyx/metro/runner-config');

module.exports = createRunnerConfig({
  target: 'windows',
  runnerRoot: __dirname,
  appRoot: path.resolve(__dirname, '../..'),
});
```

네이티브 `babel.config.cjs`는 `module.exports = require('@nelyx/metro/babel-config')`를 사용합니다. Web에서는 `@nelyx/metro/web-config`의 `createWebRunnerConfig({runnerRoot, appRoot})`를 사용합니다.

전체 설정은 샘플의 [Windows](../../../../sample/nelyx-testbed-app-2/windows/runner/metro.config.cjs)·[Web](../../../../sample/nelyx-testbed-app-2/web/runner/metro.config.cjs)에 있습니다. 각 runner는 의존성과 등록 코드를 소유하며 공통 UI는 앱의 `src/`에 둡니다.

엔진별 변환은 runner·CLI 설정으로 선택합니다. 사용자 Babel plugin은 runner의 `babel.config.cjs`에 두고, transformer를 조합할 때 선택된 엔진 정책을 유지하세요.

## 자산과 로컬 패키지

루트 `package.json`의 `nelyx.assets`에 자산을 선언합니다. 생략한 자산·고지 해시는 생성되는 `runner/app-config.json`에 계산하고, 명시한 해시는 일치를 확인합니다.

`materializeAppAssets(appRoot, assets, resolveModule)`은 `packageSource`로 선언한 누락 자산을 설치된 패키지에서 복사합니다. Export된 자산·고지 bytes를 확인하며 수정된 대상 파일은 충돌로 보고합니다. Runner의 모듈 resolver를 전달하세요.

새 로컬 archive를 공급하면 runner에서 `npm ci --workspaces=false`로 설치하고 Metro를 다시 시작합니다. 같은 패키지 버전이라도 내용이 다를 수 있으므로 runner가 설치된 archive의 식별도 확인합니다.

## 런타임 목록

`inspectRuntimeInventory({runner, appRoot, signal})`은 설치된 Windows Release serializer, 모듈 그래프, 시작 호출과 source map을 조사합니다. Static AOT 도구용 구문 목록을 메모리로 반환하며 앱을 컴파일·발행하지는 않습니다. 사용자 serializer와 호환되지 않는 Metro 버전은 거절합니다.

## 선언 확인

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run check:metro-types
```

Runner 빌드·실행은 [Testbed 가이드](../../../../sample/nelyx-testbed-app-2/README.ko.md)를 참고하세요.

## 라이선스

Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 가져온 코드의 고지는 [licenses/](licenses/)에 유지합니다.
