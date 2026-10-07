# goal_means — 수단 → 목적

## 모양과 의미

| 요소 | 모양 | 비고 |
|------|------|------|
| 수단, 목적 | rect → rect | N:1 또는 N:N |
| 관계 | 화살촉 있는 edge, 수단에서 목적으로 | |

## execution_flow와 한 도식에 있을 때

- 둘 다 rect와 화살촉을 쓰므로 모양만으로는 구분되지 않는다. 순위경쟁상 execution_flow가 앞선다([common.md](../common.md) §1).
- 목적 node는 채움(예: 초록 채움)으로 구분하고, 그 뜻을 Legend에 적는다(예: "채움 = goal_means의 목적"). 필요하면 edge에 `label`(예: "목적")을 단다.

## 확실성

- 적용한다. 달성 여부가 불확실한 수단–목적 관계는 점선으로 그린다.

## 위상

- DAG이다. cycle을 만들지 않는다(검증 규칙 `VB-GOAL-DAG`).
