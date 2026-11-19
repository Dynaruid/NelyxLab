# Nelyx.FrameworkToTypeScript · 동결된 변환 도구

이 도구는 초기 이식의 원본과 변환 방식을 확인하기 위한 참고 자료입니다. 도구나 recipe를 더 개발하지 않습니다. SDK·앱 빌드, 위젯 이전, 제품 수정 및 검증에 이 도구나 Dart SDK 설치가 필요하지 않습니다.

[W11 패키지 이전 계획](../../work11.md)에 따라 기존 후보를 [Material](../../packages/material/src/)과 [Cupertino](../../packages/cupertino/src/)의 기능 모듈에 반영하세요. 생성 이력이 있는 파일도 현재 패키지에서 직접 수정합니다. 생성기 실행으로 제품 소스를 덮어쓰거나 변환 당시의 해시와 맞추지 않습니다. 현재 패키지 빌드·공개 API·동작을 검증하고 원본 식별 정보와 라이선스를 보존하세요.

## 이전 변환의 출처

- Flutter pin: `71e4717a61786faab4c7aa39825989305ed29e8a`. [원본 로더](flutter-source.mjs)는 고정 Git blob을 읽었습니다.
- [변환 데이터](data/README.md)와 [출처 매핑](data/framework-ports.json)은 당시 입력·대상·소유권의 기록이며 현재 제품의 완료 판정표가 아닙니다.
- 도구 자체의 [BSD-3-Clause](LICENSE.md)와 이식한 코드의 원본 고지는 계속 적용됩니다.
