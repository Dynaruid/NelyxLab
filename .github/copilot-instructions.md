# Instructions

- Tests must use a 20-minute timeout.
- 수백번 이상의 반복검증은 불필요 대부분의 검증은 30번 이내로 확인하기
- 필요하면 pwsh과 playwright사용가능

- 검증 로그·immutable receipt·checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile을 누적 보관하지 않는다.

- 검증용 임시 디렉터리는 한 실행에 필요한 것만 사용하고 성공·실패·중단 시 finally에서 삭제한다. 재실행 때마다 전체 package/SDK/cache를 복제하거나 과거 산출물을 다시 복사하지 않는다. 자동으로 다른 드라이브에 보관 archive를 만들지 않는다.

- 패키지 빌드는 현재 dist만 남긴다. 교체에 사용한 이전 dist와 staging은 실행 종료 시 삭제하며 last-sdk-\* 같은 이전 출력 사본을 누적하지 않는다.

- Android 번들링때 IDE의 Oracle Java 서버가 dist-android/project 디렉터리 핸들을 잡고 있으면 잠김. 해당 서버 프로세스를 종료한 뒤 dist-android/project를 삭제하고 재실행한다.
