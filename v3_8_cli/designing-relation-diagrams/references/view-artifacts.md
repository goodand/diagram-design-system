# View 산출물 명명 계약

작성자: chatgpt_gpt6 · 2026-10-15

`human`은 Human용 표현, `agent`는 Tool Use Agent 독립 검토용 표현, `common`은 공유 표현이다. 실제 열람자가 바뀌어도 이름은 바뀌지 않는다. 형식은 확장자, 표시 상태는 별도 접미사로 구분한다.

| 생성 경로 | View 파일 |
|---|---|
| Function finalize | function.common.svg / .png / .html |
| Summary finalize | summary.common.svg / .png / .html |
| Core finalize | core.human.svg / .png / .html |
| Full finalize | full.human.svg / .png / .html |
| independent-core | core.agent.svg / .png |
| capture-core | core.human.collapsed.png / core.human.expanded.png |
| capture-full | full.human.state-00.png 등 모든 비중첩 접기 조합; 상태별 expand ID는 capture.json |

이번 변경은 명명 통일이다. 공통 View의 기존 HTML 출력 제거는 포함하지 않는다. ir.json과 receipt.json은 View가 아니므로 그대로 둔다. 과거 문서의 diagram.svg/png/html은 이전 출력명이며 새 typed 출력은 이 표와 receipt.outputs의 실제 경로를 따른다. 타입 없는 legacy IR은 diagram.*를 유지한다. 이전 산출물을 소급 변경하지 않으며 verify는 receipt의 경로를 읽어 구·신 출력 모두 확인한다. l1_partial 런타임 타입 이관은 별도 작업이며 이번에는 View 파일명만 통일한다.
