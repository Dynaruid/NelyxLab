# Nelyx 애플리케이션

[English](README.md) | **한국어**

이 앱은 TypeScript 상태와 그리기 명령을 `src/`에서 공유하고 독립적인 플랫폼 runner를 사용합니다. `src/index.ts`가 공통 진입점 `main()`을 제공하며, 루트 `package.json` → `nelyx`에서 앱 정보, 자산, profile과 런타임 cohort를 선언합니다. 각 `<target>/runner/main.ts(x)`가 component를 import하고 `registerApplication`을 직접 호출합니다.

Nelyx는 Flutter의 위젯·렌더링 구조를 참고해 TypeScript UI를 구성합니다. 이 템플릿은 공통 Widget·Element·RenderObject로 counter·editor·drawing/text/traversal lab·navigation을 연결합니다. Keyboard lab → Actions and focus에서 상위 override·priority action·동적 shortcut 등록·focus/hover 표시를 확인합니다. 전체 Flutter API와 플랫폼 수락은 미완료입니다. Core0.16.0·SDK0.20.0·Skia0.6.0·Metro/CLI0.10.0을 함께 사용하며 native ABI1/frame wire11/text-style1/boundary2/paragraph API2와 Android keyboard3/semantics2이 필요합니다. RN binding과 공통 native core를 함께 재빌드하세요. 소유 Web runtime은 별도 version의 paragraph API1을 사용합니다.

루트 `package.json`이 앱 구성의 기준입니다. `app.json`, `application.json`, `nelyx.config.ts`와 루트 bootstrap 파일은 필요하지 않습니다. npm 패키지 `name`과 네이티브 앱 등록 이름인 `nelyx.name`은 구분하며, 표시 이름은 `nelyx.displayName`에 둡니다. 번들 이미지(Apple/Linux에서는 폰트도)를 추가할 때 runner main의 자산 map에 정적인 `require` 항목을 추가해 Metro에 포함합니다. Windows는 선언된 자산 전체를 host URI로, Android는 폰트를 hash 기반 네이티브 자산 URI로 연결합니다. CLI prepare는 네이티브 빌드 도구용 `runner/app-config.json`을 계속 생성합니다. 이 파일 대신 루트 패키지 구성을 수정하고 prepare로 갱신하세요.

에셋과 notice의 `sha256`은 생략할 수 있으며 기본 앱 구성에는 넣지 않습니다. runner 준비·타입 검사·Metro 시작 시 현재 파일에서 자동 계산해 생성되는 `runner/app-config.json`에만 저장하고 루트 패키지는 수정하지 않습니다. 각 runner main은 이 내부 자산 메타데이터를 확인한 뒤 등록합니다. 패키지 자산은 설치된 원본과 비교해 복사하며 수정된 기존 대상 파일은 보존하고 오류로 보고합니다. 명시한 해시가 있다면 일치 여부도 확인합니다.

## 시작하기

Windows Release는 RNW host의 Hermes `optimized`를 기본으로 사용합니다. V8/JSC는 명시적으로 선택합니다. 설치된 CLI의 실험적 `--host native-hermes`는 Windows x64 Release에서 bytecode·Static Hermes를 지원하며 같은 `src/index.ts`와 Core layout을 사용합니다. 준비 명령은 CLI 패키지 README를 따르세요. 성능·물리 입력/표시 수락과 향후 iOS 직접 host 구현은 별도입니다.

Node.js **>=24.3.0 <25**와 npm을 사용합니다. 앱 생성 시 선택한 대상의 가이드를 따르세요.

| 대상 | Runner 가이드 |
| --- | --- |
| Web | [브라우저 개발과 정적 빌드](web/runner/README.md) |
| Windows | [네이티브 입력, 빌드와 실행](windows/runner/README.md) |
| Android | [SDK/NDK, 아키텍처와 APK 패키징](android/runner/README.md) |
| iOS | [Xcode, Pods와 시뮬레이터 빌드](ios/runner/README.md) |
| macOS | [Xcode, Pods와 네이티브 빌드](macos/runner/README.md) |
| Linux | [RNL 공급, 네이티브 입력과 GTK 호스트](linux/runner/README.md) |

패키지 archive 공급과 runner lockfile 생성을 마친 뒤 `npm ci --workspaces=false`로 설치합니다. 의존성은 선택한 runner 안에 설치합니다. 다른 대상을 추가하려면 루트 `package.json` → `nelyx` 항목과 일치하는 패키지·네이티브 입력이 필요합니다.

Web은 선택한 runner에 공급을 마친 뒤 앱 루트에서 실행합니다.

```powershell
npm --prefix web/runner ci --workspaces=false
npm --prefix web/runner run check
npm --prefix web/runner run dev
```

`http://127.0.0.1:8081/`에 접속하고 Ctrl+C로 서버를 종료합니다. 네이티브 대상이나 CLI 관리 패키지는 runner 가이드를 참고하세요.

## 앱 책임

공통 앱 로직은 `src/`에, 플랫폼 등록·빌드 설정은 `<target>/runner/`에 둡니다. `@nelyx/core/ui/types`, `@nelyx/sdk/platforms/web/application`처럼 명시적인 모듈에서 import합니다. SDK가 앱·호스트 수명을 연결하고 Skia가 렌더러·GPU 자원을 관리합니다. 생성되는 공급물과 출력은 `.nelyx/`에 둡니다.

Nelyx는 실험적 프로젝트이며 provider qualification은 `notVerified`입니다. 빌드·샘플 실행은 물리 입력, IME, 접근성, GPU 화면 표시나 제품 서명 수락을 입증하지 않습니다. 앱 배포 시 수입한 폰트·런타임·렌더러 라이선스를 유지합니다.
