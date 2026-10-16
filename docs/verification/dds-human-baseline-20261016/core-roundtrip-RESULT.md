# Core → Full → Core 구조 보존 검사

2026-10-16. 제품 코드를 바꾸지 않은 격리 검증 도구다.

실행: `node outputs/dds-core-roundtrip-20261016/verify.mjs`

입력: 기존 실제 CLI finalize 결과인 `dds-boundary-product-check-20261016/topology/pair-*/out/ir.json` 9개와 각 원본 Core 2개. 원본 Core는 계약 메타데이터 준비 및 독립 비교 oracle에만 사용한다. extract(full, contract)는 원본 Core 파일을 열지 않는다.

1. Core의 ID·버전·상위 참조·소속 ID·입출력 ID만 contracts.json에 저장한다. 노드의 내용·역할, edge의 양 끝, 상태 문구는 저장하지 않는다.
2. 실제 Full 취합 결과에서 node/edge/flow/animation_states/partial membership을 추출한다.
3. 제품의 projectFullBoundaries로 만든 표시용 Full에서도 추출한다. aliases를 사용해 소비자 경계 ID를 복구한다.
4. 원본 Core와 비교한다. 좌표 등 명시한 표시 필드는 제외한다. 노드·edge 배열 및 소속 집합의 순서는 정규화한다.
5. 변조 후 반드시 실패하는지 확인한다: 노드 누락, 라벨 변경, edge 방향 반전, edge 누락, flow 상태 변경, 소속 누락, 내부 edge 추가.

결과: 18 Core × 2단계 = **36 동등성 비교 PASS**, 36 × 7 = **252 변조 검출 PASS**. results.json과 조합별 assembled/projected.core-*.json에 결과를 저장했다. 생성된 Core JSON은 구조 비교 산출물이며 새 Human 승인이나 CLI 재승인 산출물이 아니다.

## 한계

Full만으로 모든 Core의 원래 E2E 구분을 추론하는 기능은 아니다. 계약 파일의 E2E·ID 메타데이터를 재사용하므로 그 메타데이터 자체의 독립적 보존을 증명하지 않는다. 이를 Full만 받는 제품 역변환 기능으로 만들려면 Full 취합 계약에 해당 provenance를 보존해야 한다. 원본 내용을 통째로 반환해 통과시키는 방식은 사용하지 않는다.

임의의 추가 top-level 필드, 다중 경계·깊은 중첩, HTML/DOM 렌더 결과, 화면 가독성, Human의 이해 달성은 이번 검사 범위 밖이다. 애니메이션 state 필드는 존재할 때 비교하지만 현재 fixture에 없는 state 변형의 커버리지는 주장하지 않는다.
