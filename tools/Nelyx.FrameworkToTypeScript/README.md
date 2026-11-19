# Nelyx.FrameworkToTypeScript

Nelyx 프레임워크 소스 이전과 생성 코드 관리를 위한 독립적인 Bun·TypeScript 개발 도구입니다. 고정된 원본의 선언·AST를 분석하고, 명시적인 변환 규칙과 소유권 메타데이터를 사용합니다.

제품 SDK와 앱은 저장소에 추적된 TypeScript를 빌드합니다. 일반 앱 개발이나 SDK 빌드에 이 도구를 설치·실행할 필요는 없습니다.

활성 Flutter pin은 `71e4717a61786faab4c7aa39825989305ed29e8a`입니다. [flutter-source.mjs](flutter-source.mjs)는 명시적으로 선택한 Flutter Git 저장소의 immutable commit/blob을 읽습니다. 로컬 reference 디렉터리나 설치 SDK의 HEAD를 원본 identity로 추정하지 않습니다. [framework-ports.mjs](framework-ports.mjs)는 이식한 선언의 원본 span과 현재 목적지 hash를 [framework-ports.json](data/framework-ports.json)에 기록하며, 모든 기록의 의미 수락 범위는 `PARTIAL`입니다.

```powershell
node Nelyx/eng/framework-inventory.mjs --source C:/path/to/flutter-git
node tools/Nelyx.FrameworkToTypeScript/framework-ports.mjs --source C:/path/to/flutter-git --dart C:/path/to/dart.exe --check
```

새 이식 범위를 검토한 뒤에만 `framework-ports.mjs --write`로 현재 출처를 갱신합니다.

W11 디자인 스캔은 두 공개 라이브러리에서 도달하는 Analyzer 인벤토리를 읽습니다. 고정 Git blob과 선언 span을 현재 TypeScript exports, 아이콘 소유권, 의존성 단위에 연결합니다. `designs:resolve`는 Flutter `DEPS`가 지정한 Dart SDK와 도구 lock으로 다시 분석하고 기존 기준판과 선언별 차이를 출력합니다. `--write`로 검증한 기준판을 `Nelyx/upstream/flutter-coverage.json`에 반영합니다.

```powershell
npm.cmd --prefix tools/Nelyx.FrameworkToTypeScript run designs:resolve -- --source C:/path/to/flutter-git --dart C:/path/to/pinned/dart.exe --write
npm.cmd --prefix tools/Nelyx.FrameworkToTypeScript run designs:scan -- --source C:/path/to/flutter-git --family W11-01
npm.cmd --prefix tools/Nelyx.FrameworkToTypeScript run designs:probe -- --source C:/path/to/flutter-git --dart C:/path/to/pinned/dart.exe --family W11-01 --graph --emitter
```

스캔에서 `--output`을 생략하면 집계를 출력합니다. `--family`는 해당 기능군과 선행 참조 단위를 고릅니다. 새 기준판은 타입, 런타임 타입 검사, 상속, 상수, 지연·인스턴스 초기화, 인자 기본값, 실행, 선언 주석, 문서 링크를 구분합니다.

`designs:probe --graph`는 실행 참조의 강한 연결 요소를 Body IR 단위로 구성합니다. `--with-dependencies`를 함께 주면 선택 기능군의 전이 실행·타입 의존성도 포함합니다. 실행 단위는 의존성부터 처리하며, 순환 가능한 타입 참조와 Core·외부 바인딩은 인벤토리에 별도로 기록합니다. 같은 Git 입력을 서로 다른 임시 경로에서 해석해 결과 바이트를 비교하고 Dart 리비전을 기록합니다. `--emitter`는 모듈별 TypeScript 후보의 해시와 첫 차단 바인딩을 출력합니다. `--summary`를 붙이면 전체 선언 로그 대신 집계와 차단 유형별 개수가 출력됩니다. 단위 전체가 확인된 `dart:core` Duration 상수이고 정수 밀리초로 손실 없이 표현할 수 있을 때만 해당 단위에 밀리초 lowering을 적용합니다. 후보 생성은 제품 승격이 아니며 정적 타입, 원본 동작, 배포를 별도로 검증해야 합니다.

## 개발 환경

저장소 루트에서 실행합니다.

```powershell
cd tools/Nelyx.FrameworkToTypeScript
bun install --frozen-lockfile
```

패키지 의존성은 [package.json](package.json)·[bun.lock](bun.lock)에 고정되어 있습니다. AST 분석과 출력에는 TypeScript Compiler API를 사용합니다.

JS/TS 포맷 기준은 루트의 [Oxfmt 설정](../../.oxfmtrc.json)을 공유합니다. 루트에서 `npm run format`으로 적용합니다. 생성 결과를 직접 정리하면 기존 base/fingerprint를 보존하고 adopted 출력의 현재 productHash와 소유권 SHA를 갱신하세요. 포맷 변경은 원본 동작이나 네이티브 실행의 검증을 대신하지 않습니다.

Dart 분석은 대응하는 Dart SDK와 [dart/](dart/)의 analyzer 입력을, C# 분석은 .NET과 [roslyn/](roslyn/)의 SourceReader를 사용합니다. 선택한 입력 언어와 recipe에 필요한 도구만 준비하세요.

## 구성

| 경로 | 역할 |
| --- | --- |
| [src/main.ts](src/main.ts) | 언어 선택, 선언 분석과 CLI 진입점 |
| [src/batch.ts](src/batch.ts) | Recipe 기반 batch 처리 |
| [src/class-model.ts](src/class-model.ts) | 클래스·상속·멤버 소유권 모델 |
| [dart/](dart/) | Dart analyzer 기반 원본 분석 |
| [roslyn/](roslyn/) | C# 구문·의미 분석 |
| [data/](data/README.md) | 패키지 등록, recipe, 수동 경계와 생성 소유권 |
| [product-module-layout.mjs](product-module-layout.mjs) | 제품 모듈 경로와 소유권 연결 |

최상위 `generate-*` 도구는 각 기능의 원본·데이터·출력 계약을 가진 별도 생성기입니다. 생성기를 실행하기 전에 해당 파일의 입력과 관리 대상 출력을 확인하세요.

## 사용 원칙

- 원본 revision, 선언 식별, 숫자 타입·주석과 라이선스를 유지합니다.
- 자동 변환이 지원하지 않는 선언은 진단으로 거절합니다. 빈 구현으로 대체하지 않습니다.
- 생성·adopted 출력의 소유권과 제품 직접 수정을 보존하고, 충돌을 덮어쓰지 않습니다.
- Recipe를 재사용하기 전에 현재 제품에 맞는 검증 경로를 연결합니다. 검증 누락은 실패로 처리합니다.
- 타입 검사와 생성 성공은 원본 동작·플랫폼 실행 검증과 별개입니다.

일부 recipe는 현재 제공하지 않는 validator를 참조할 수 있습니다. `batch resume all`이나 validate·promote를 일괄 실행하기 전에 recipe와 현재 입력·검증 경로를 검토하세요.

## 제품 소스와의 관계

제품 기능은 Core·디자인 패키지의 현재 소스에서 유지합니다. 기능을 수정할 때마다 전체 변환이나 재생성을 수행할 필요는 없습니다. 생성 대상에 손댈 때는 [소유권 데이터 안내](data/README.md)를 따르세요.

프로젝트 사용법은 [루트 README](../../README.ko.md), 프레임워크 API는 [Core](../../Nelyx/README.ko.md)에 있습니다.

## 라이선스

도구의 Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 변환한 원본의 라이선스와 출처 고지는 제품 소스와 [Nelyx/licenses/](../../Nelyx/licenses/)에 유지합니다.
