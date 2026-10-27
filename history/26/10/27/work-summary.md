# 2026-10-27 — Windows 표시·리사이즈·스크롤 입력과 문서 정리 요약

기록일: 2026-10-27 KST · Git 범위: `e65e861`~`ed99ba3` · 근거: 해당 커밋의 소스 변경과 루트 `work.md`

상태: **Windows 리사이즈 동기화·그림자·트랙패드 수정 반영 / 리사이즈 FPS 개선 PLANNED**. `resizePerformanceAccepted=false`이며, W18의 `performanceAccepted=false`와 미검증 경계를 유지한다. 이 문서는 당일 작업 요약이고 현재 실행 계획은 [루트 work.md](../../../../work.md)에 있다. 기록 작성 중 새 빌드·앱 실행·성능 측정은 수행하지 않았다.

## 당일 변경 범위

| 커밋 | 작업 | 결과의 범위 |
| --- | --- | --- |
| `e65e861` | 기존 설계·작업 문서 19개를 날짜별 요약으로 정리하고 루트 원문 제거 | 기존 PARTIAL·미수락 상태 보존, scroll 검사의 문서 참조 경로 갱신 |
| `9a9202a` | README 31개를 소개·설치·실행·API 중심으로 정리 | 문서 변경이며 새 플랫폼·제품 수락이 아님 |
| `708d9ed` | Windows 리사이즈 사전 준비·합성·입력 경로와 Core·샘플의 갱신 범위 수정 | 화면 정합성 개선과 FPS 미달을 구분 |
| `de112c2` | 창 크기 조절 FPS 개선 계획 작성 | S0~S5 NOT_STARTED, 구현 미착수 |
| `a14a035` | elevation 애니메이션의 그림자 경로 수정·회귀 검사 추가 | W18의 이동 보정 spot mesh 이후 변경 |
| `ed99ba3` | 트랙패드 제스처 상태·중복 입력 소유자 수정과 실행 패키지 반영 | 사용자 반복 스크롤·ListView 왕복 재확인, 장시간·다른 장치 수락은 별도 |

## Windows 리사이즈 동기화와 입력

`WM_SIZING`에서 제안된 client 크기의 프레임을 먼저 준비하고, 실제 `WM_WINDOWPOSCHANGED` 크기가 일치할 때 표시한다. RNW의 독립적인 창 layout 통지 대신 host가 Arrange와 전체 창 viewport를 소유한다. `windowViewport`를 선언한 표면은 HWND의 실제 물리 크기·DPI를 사용하고, embedded 표면은 기존 Fabric layout을 사용한다.

전체 창 표면을 최상위 HWND의 native DirectComposition target에 연결했다. host가 최상위·bridge HWND의 pointer/wheel·capture/cancel을 같은 viewport 좌표로 전달하고, keyboard·TSF·UIA는 RNW island의 owner를 유지한다. 준비된 프레임의 GPU copy retirement와 실제 크기를 확인한 뒤 composition commit을 진행한다. 오래된 프레임 확대·축소나 빈 배경 채우기로 크기 차이를 숨기지 않는다.

준비 대기는 native Skia mailbox만 처리하는 최대 100ms rendezvous이며, 이후 합성 클록 대기는 최대 32ms다. 두 값은 매번 소비하는 고정 시간이 아니다. native commit 완료 대기·`DwmFlush`의 실제 비용과 표시 지연은 별도로 확인해야 한다. 취소된 후보도 GPU retirement 뒤 반환하고, 실제 layout과 표시 epoch가 다르면 pointer·텍스트·semantics geometry 사용을 제한한다.

루트 작업 문서에 남은 선행 검증은 Material·ListView·Cupertino × 우하단·좌상단의 **6조합 / 304개 캡처 샘플**에서 배경 노출·글자 크기 변화·표시 경계 불일치·준비 timeout 0건이다. 클릭·테마·휠·최대화·복원·종료 코드 0도 기록됐다. 이는 당시 화면 정합성 결과이며 연속 리사이즈 FPS나 전체 scanout 수락이 아니다.

## Core 접근성·의존성과 갤러리 갱신

- frame capture가 환경 객체를 복사하므로, 접근성 snapshot의 환경 동일성을 객체 주소 대신 safe area·keyboard·text scale·gesture 값으로 비교하도록 바꿨다. 같은 환경이 매번 변경으로 판정되던 경로를 수정했다.
- layout의 geometry 변경과 semantics 설정 변경을 구분하고, active 접근성 트리에 기여하지 않는 offstage·미방문 fragment가 전체 갱신을 유발하지 않도록 했다. 크기만 바뀌는 접근성 geometry는 앱이 선택한 갱신 간격으로 모으되 content·자식 구성·scroll action·focus·입력 geometry·DPI·환경 변경은 즉시 반영한다.
- `readMetrics`와 MediaQuery의 의존성을 scale·text metric 등 필요한 필드 단위로 좁혔다. 실제 변경 필드를 읽은 위젯을 갱신하며 크기에 의존하는 RenderObject는 새 constraints로 layout한다.
- Material·Cupertino 갤러리는 같은 responsive 구간에서 Widget 구성을 재사용하고 breakpoint·theme·State revision이 바뀌면 다시 만든다. 페이지 변경 notifier를 함께 연결해 category·theme·design·준비 중 항목 전환이 오래된 구성에 머물지 않게 했다.

이 변경들은 스크롤·화면 움직임의 반복 작업에도 영향을 줄 수 있다. 개별 변경의 CPU 기여율이나 현재 제품 전체의 FPS 개선율은 새로 측정하지 않았다.

## 그림자 후속 수정

W18의 [10월 25일 요약](../25/work18-summary.md)에 있는 device 이동 보정 spot mesh는 이전 상태다. `a14a035`에서는 소수점 elevation 애니메이션 중 tessellator의 내부 mesh 구조가 달라지는 경로를 피하도록, 지원되는 Graphite의 평평한 Z·방향성·affine 그림자를 Skia mask blur로 일관되게 처리한다. ambient·spot의 반경과 이동은 기존 Skia metric에서 얻고, 미지원 조건은 기존 shadow 경로로 처리한다.

retained Picture에는 native shadow 명령을 보존하고 replay 때 최종 부모 transform·clip을 적용한다. DPR 1/1.25/1.5/2와 직접·retained Picture에서 press/release/hover-exit의 그림자 밝기 연속성·양의 elevation·elevation 0의 소멸을 검사하도록 보강했다. 공급된 실제 Windows archive를 링크하는 `test:native-shadows`도 추가했다. 검사 추가를 이 기록 작성 시의 새 Vulkan 실행 PASS나 CPU/GPU 성능 수락으로 바꾸지 않는다.

## 트랙패드 반복 스크롤 중단 수정

실행 진단에서 같은 Skia 화면의 부팅 중 DirectManipulation 객체가 **17개** 만들어지고 스크롤 중에도 추가되는 것을 확인했다. `TextInputSkiaSurface::resolve`가 서비스·접근성 좌표 조회마다 트랙패드 viewport를 등록했고, 좌표 조회자의 수명이 실제 입력 소유자를 교체하고 있었다.

실제 `WindowsSkiaViewState`가 입력 객체 **1개**를 소유하게 바꿨다. 좌표 매퍼의 생성·해제가 입력 객체를 교체하지 않으며 화면 binding 종료 때 contact·viewport·clock·매퍼를 정리한다. 접촉 BEGIN/END와 초기화 중 compositor tick, 실제 READY 판정, 관성 없는 종료의 transform 초기화와 취소 시 native contact 종료도 보강했다.

`work.md` §9의 기록 범위에서 `windows-precision`·`windows-window-pointer`·`windows-pointer-timing` **3/3 PASS**, 실제 Fabric 화면의 좌표 매핑 12회 생성·해제 후 입력 객체 동일성·입력/GPU drain 검사 **PASS**다. 후자는 `NELYX_WINDOWS_INPUT_CLOSE_ONLY=1` 범위다. SDK·Skia 공급과 설치 header 일치 확인 뒤 **Static Hermes / optimized / x64 Release 빌드 PASS**가 기록됐다.

사용자가 반복 스크롤·ListView 왕복에서 정상 동작을 재확인했고, 진단 구간의 초기화 객체·입력 pointer는 1개, 오류는 0건이었다. 첫 제스처 상태 수정의 자동 검사만으로는 실제 재발이 해결되지 않았고 중복 소유자 수정 뒤 해당 재현 구간을 통과했다. 창 전환·리사이즈 후 물리 재입력, 다른 장치의 장시간 사용과 전체 TSF/UIA/IME는 **notVerified**다. `NELYX_TRACKPAD_DIAGNOSTICS=1` 진단은 현재 실행 콘솔에만 출력한다.

## 공급 식별자와 성능의 남은 경계

| 구분 | 실행 파일 SHA-256 | native inputs SHA-256 |
| --- | --- | --- |
| 리사이즈 정합성 선행 기록 / Hermes bytecode optimized | `99422cc8a9920dd9069059091d85a3f8d779ac5fdb4ee2b5f1ea1ce0b5573d1f` | `2bbc534572a81996b56325345cf190631c3399e35ea13e6fe3b31a957d38ea2e` |
| 트랙패드 수정 공급 / Static Hermes optimized | `9f52c765b57e5d5ec2efeef71dc69988475478de9bad46957cbdf28c32d6406a` | `9fa53dc1f48284aa645f3efbb63a8d7d1a03d18df227e986c8357273596bc13b` |

리사이즈 선행 기록은 JS frame CPU p95 약 **26~32ms**, 요청→surface update p95 약 **58~83ms**, surface update 최대 간격 약 **67~86ms**다. 약 1초에 실제 geometry 16~18회 변화는 낮은 빈도의 단서이며 정식 FPS 측정값이 아니다. 기존 입력 fixture 자체가 기본 35ms 간격이므로 60fps 입증에 사용할 수 없다. 이 수치를 이후 Static Hermes 공급의 재측정 결과로 승계하지 않는다.

후속 FPS 계획은 고빈도 입력·geometry·surface update·표시 변화의 빈도를 분리하고 한 transaction의 JS 예약·CPU·GPU·commit/flush 비용을 측정하는 S0/S1에서 시작한다. S0~S5는 **NOT_STARTED**, `resizePerformanceAccepted=false`다.

당일 W18 전후 성능 검토는 Git에 남은 기존 측정과 코드 비교였다. W18 초반 대조 소스 대비 선정 후보의 대표 ListView CPU p95 약 **18~28% 감소**는 이전 직접 host 진단이며, 당일 RNW 공급의 새 FPS·물리 표시 측정이 아니다. 빠른 스크롤·최종 성능·메모리·물리 입력·플랫폼 수락의 잔여를 완료 처리하지 않는다.

[W18 기반 개편](../25/work18-summary.md) · [현재 작업](../../../../work.md) · [Windows 입력·합성 계약](../../../../Nelyx/skia/packages/rn/native/windows/README.md) · [현재 사용 안내](../../../../README.ko.md)
