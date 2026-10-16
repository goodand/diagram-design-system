# 検証基準 / 검증 기준선 — 2026-10-16

선정 4사례는 후속 Human 답변을 포함해 PASS다. Cycle+Cycle은 100% 표시 PASS이며 전체 맞춤의 작은 글씨까지 승인한 것은 아니다. 1.8초대 애니메이션의 시간 가독성도 Human PASS다. 원문과 후속 판정은 HUMAN-RESULT.md 및 JSON 파일에 보존한다.

의미·상태 문구의 결정은 Human과 ToolUsingAgent, Human 이해 달성 판정은 Human의 관할이다. 개발 검증은 표현·조작 품질과 실제 취합 과정의 구조 보존을 다룬다. 현재 확인된 수정 대상은 없으므로 이 범위의 구현을 기준선으로 보존한다. 모든 그래프·39상태 전부의 Human 승인으로 일반화하지 않는다.

제품 소스 168/168, 추출 패키지 브라우저 4/4 검증 기록은 상위 폴더에 있다. 후속 실제 Hover·접기·펼치기 4사례는 interaction-check.json, 구조 동등성 36회 및 변조 검출 252회는 core-roundtrip-results.json에 있다.

core-roundtrip-verify.snapshot.mjs는 실행 당시 코드 원문이다. workspace outputs 경로에 의존하므로 이 보존 위치에서 독립 실행하는 테스트로 주장하지 않는다. 재실행 원본은 workspace outputs/dds-core-roundtrip-20261016/verify.mjs다. Core별 ID/E2E 계약 메타데이터를 사용한다는 한계는 core-roundtrip-RESULT.md에 명시한다.

manifest의 로컬 URL은 원본 검수 화면 위치이며 저장소 안에 모든 HTML/이미지를 복제한 것은 아니다. JSON의 hash는 해당 검수 파일 식별용이다. 원문 displayWidth/displayMode의 live iframe 측정 한계는 HUMAN-RESULT.md에 보존한다.
