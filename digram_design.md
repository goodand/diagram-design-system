# digram_design.md — Diagram Design System (Version B)

- 성격: **정본(표현 규약).** 이 문서가 도식의 **표현 위계 · 의미 위계 · 둘의 매핑**을 정한다.
  [[concept-gate-h1-wt/docs/diagrams/README_node_system|README_node_system]] 은 **노드 타입과 허용 관계**(논리 쪽)를 정하고,
  충돌하면 **표현에 관해서는 이 문서가 정본**이다.
- 원문: 사용자 작성, **2026-09-13 판(Version B 확정)**. 아래 §1~§10 은 사용자 문서 그대로이고,
  머리말·§11(저장소 기록)·맨 끝 항법 줄만 저장소가 붙였다.
- 앞 판(2026-09-12, 곡선 기반 매핑)은 이 문서가 **대체**한다 — 무엇이 바뀌었는지는 §11.
- 적용판(그림): `docs/formal/expression_hierarchy.html`(보조판) ·
  `docs/formal/design_system_demo_decided.html`(적용판)

---

> 이 문서는 현재까지의 설계 내용을 **있는 그대로** 복제·정리한 것이다.
> **Version B** 선택 확정 (이 세션 기준).

## 1. 설계 원리

- **표현(Expression)**: 유한하고 식별 가능한 시각 형태(edge(Link), node(Vertex), 화살촉, 점선 등)
- **의미(Meaning)**: 키워드를 의미의 대리자(proxy)로 사용
- **매핑(Mapping)**: 표현 ↔ 의미를 1:1 또는 1:N으로 대응, 우선순위 존재
- **언어로서의 design system**: 형태 → 해석 → 의사소통

**해석 우선순위**: 사용자의 현재 프롬프트 > design system 규칙 > 예시 HTML 시각 구현

## 2. 표현 위계

### 위계 기준

- **표현 위계**: 식별력(identifiability) 중심으로 결정
- **의미 위계**: 사용빈도 중심으로 결정

### Core/Main/Sub 명칭에 대한 문제 제기

> Core/Main/Sub 명칭을 없애고, 결정된 우선순위를 모두 명시적으로 표현하는 것도 방법이다.

### 표현 식별력 우선순위

```
Arrowhead 유무 > rect/stadium > dashed/solid > fill > color(5색) > corner rounding > 곡선/직선
```

> 점선/실선은 식별력으로는 Core급이나, 점선 간격이 너무 좁으면 시각적 가독성이 낮아 2순위로 배치되었을 뿐이다.

### 현행 표현 축 정리

| 우선순위 | edge(Link) | node(Vertex) |
|----------|----------|-------------|
| 1 (최고 식별력) | Arrowhead 유무 | 직사각형 / Stadium |
| 2 | 점선/실선 (certainty 축) | 채움(fill) 유무 |
| 3 | 색상 — 흑/백/빨/초/파 5색 (식별 용도, 심미적·Art 영역에서도 사용 가능) | 모서리 각 — 둥근/뾰족 |
| 4 | 곡선/직선 (식별성은 존재하나 시각적 안정성 낮음, edge에서 사용 지양) | 색상 — 흑/백/빨/초/파 5색 |

### 곡선에 대한 결정

- 곡선은 식별성 자체는 존재하나 **시각적 안정성이 낮음** (layout 변경 시 형태 변화)
- **edge(link)에서 곡선 사용은 지양함**
- 식별력 4순위로 배치 (사용은 지양하되 축 자체는 존재)

## 3. 의미 위계

### 위계 기준: 사용빈도

```
execution_flow > execution_flow_whole_part > goal_means > is_a
```

| 사용빈도 순위 | 의미 | 설명 |
|--------------|------|------|
| 1 | **execution_flow** (실행흐름) | Process / Entity 구분. 가장 기본적 관계 |
| 2 | **execution_flow 내 whole_part** | 실행흐름 안에서 whole/part가 메타 수식어로 작동 |
| 3 | **goal_means** (목적/수단) | 수단→목적, N:1 또는 N:N |
| 4 | **is_a** (분류) | 상위개념/하위개념 chain |

### execution_flow 상세: Process와 Entity

- **Process**: Task, Action, AtoB, Module, Pipeline, Function 등의 표현으로 사용될 수 있음
- **Entity**: 어떠한 data, interaction, action, relation을 input/output으로 사용하여 Process의 전/후에 있는 것으로 표현. 일종의 객체라고 표현할 수 있음
- **실제 사용**: 사용자의 직관성·비개발자 이해 용이성 때문에 Process에서는 **Task**로 사용하는 것이 일반적. Task를 구체적으로 표현하려는 의도에서 **Action**으로 표현하기도 함

## 4. 네 가지 의미의 특성 비교

| 특성 | execution_flow | goal_means | whole_part | is_a |
|------|---------------|------------|------------|------|
| 기본 그래프 | DAG + cycles 허용 | DAG | tree (기본) | tree (기본) |
| certainty 적용 | ✓ | ✓ | ? | ✗ |
| 메타 수식 관계 | whole_part, certainty가 내부에서 수식어로 작동 | certainty가 수식어로 작동 | — | — |
| 상대적 chain | — | 수단→목적 | 전체⊃부분 | 상위↔하위 |
| 추상화와의 관계 | — | — | **높은 관련성** (추상화 ≈ 상단 유지, 하단 은닉) | 단어 의미 이해를 위한 chain |

### 의미 간 관계에 대한 관찰

1. **whole/part는 추상화와 직결**: graph 추상화 = tree 상단 유지 + 하단 은닉. whole/part 자체가 이 구조.
2. **whole/part는 execution_flow 안에서도 사용됨**: 메타 수준 수식어로 작동
3. **certainty는 is_a에 적용되지 않음**: is_a는 분류 체계이므로 확실/불확실 축이 부적합
4. **is_a와 whole_part의 tree 예외**:
   - 두 개 이상에서 상속 (다중 상속) → DAG
   - 부분은 같은데 전체가 다른 경우 존재
   - 같은 전체에서 다른 부분 → 이 경우 추상화를 많이 사용
5. **is_a의 용도**: 명제·문장·문단에서 특정 단어의 의미를 이해하기 위해 상위/하위개념 chain으로 표현하거나, 단어들 간의 관계를 표현

## 5. 표현 ↔ 의미 매핑 (Version B)

> Version A(곡선 사용)는 참고용으로 보존하나, 이 세션에서는 **Version B**를 선택.

| 노드 조합 | 의미 |
|-----------|------|
| rect → rect | goal_means |
| stadium chain | is_a |
| rect 단독 또는 rect+stadium 혼합 | execution_flow |
| 포함 영역(region) | whole_part |

### execution_flow와 goal_means 겹침 해결

> 둘 다 rect + arrowhead이지만, **위계를 따라서 맥락에 따라 사용**한다.
> 같이 쓰이는 경우 **채움(fill) 유무, 색상**으로 충분히 표현 가능.

## 6. 확실성 축 (Certainty — 의미 매핑과 직교)

| 상태 | 표현 |
|------|------|
| 확정/존재 | 실선 (solid) |
| 불확실/미정 | 점선 (dashed) |
| 확실성 정도 | dash-gap gradient (좁은 간격=확실에 가까움, 넓은 간격=불확실) |

적용 범위: execution_flow ✓, goal_means ✓, is_a ✗

## 7. 추상화 단계

- **L0** (가장 추상) → **L10** (가장 구체)
- 일반적 출력: L0–L2
- 다음 단계 생성 전 반드시 검증 필요 (코드/문서 대조)

### 추상화에서의 그래프 처리

- tree의 상단을 남기고 하단을 은닉하는 방식
- tree가 아닌 것을 tree로 가정하여 tree 방식으로 사용하는 경우도 존재
- 정보 손실 유형:
  - **구조적 손실**: N:N → 1:N tree로 변환 시
  - **의미적 손실**: 세부사항 생략/캡슐화

## 8. 위상(Topology) 규칙

| 의미 | 허용 위상 |
|------|-----------|
| execution_flow | DAG + cycles |
| goal_means | DAG |
| whole_part | tree (기본), DAG 가능 (다중 전체) |
| is_a | tree (기본), DAG 가능 (다중 상속) |

## 9. UX 분석

### 식별 용이성 순위

```
Arrowhead > rect/stadium > dashed/solid > fill > color(5색) > corner rounding
```

### 시각 안정성

- 곡선: 식별성은 있으나 **시각적 불안정** → edge에서 사용 지양

### 손그림 편의성

**node(Vertex)**: 직사각형 > 선 > 원 > 채움 색상 설정 > 각 둥근 직사각형 > Stadium

**edge(Link)**: 점선 > 화살표

### 그래프 표현 수준

**위상 복잡도**: tree → DAG → DAG with cycles

**Edge 복잡도**: 단일 type → 2–3 types → edge에 설명 필요

**상대적 chain**:

| 의미 | chain 방향 |
|------|-----------|
| whole/part | 전체 ⊃ 부분 |
| goal/means | 수단 → 목적 |
| is_a | 상위개념 ↔ 하위개념 |

## 10. 이 세션에서 해결된 사항

1. **Version A vs B 선택** → **Version B** 확정
2. **곡선 사용 여부** → edge에서 곡선 사용 **지양**, 점선/실선만 남음
3. **execution_flow와 goal_means 표현 겹침** → 위계·맥락에 따라 사용, 동시 사용 시 채움(fill)/색상으로 구분
4. **의미 위계 기준 명확화** → 사용빈도 기준
5. **표현 위계 기준 명확화** → 식별력(identifiability) 기준
6. **점선/실선의 식별력** → Core급이나 가독성 이유로 2순위 배치
7. **색상 5색 확정** → 흑/백/빨/초/파, edge·node 양쪽 4순위에 배치

---

## 10b. 규격 시트(HTML)에만 있던 것 — 정본으로 옮김

사용자가 만든 시각 정본 **「도식 표기 규격 B」**(artifact `facbf3da`, 10 plate)에는 위 §1~§10 이 담지 못한
**그리기 규칙**이 들어 있다. 그림이 곧 규칙인 항목이라 여기 문장으로 옮긴다(그림 자체의 정본은 그 시트다).

### 매핑의 구체 표기 (plate 04)

| 의미 | 노드 | 간선 | 비고 |
|---|---|---|---|
| goal_means | rect → rect | 실선 + 화살촉 | 여러 수단이 한 목적으로 수렴(N:1) |
| is_a | stadium | **실선 + 화살촉 없음** | 방향은 간선이 아니라 **위아래 배치**가 말한다(위가 상위). **점선을 쓰지 않는다** |
| execution_flow | Entity(stadium) ↔ Process(rect) 교대 | 실선 + 화살촉 | Process 를 채워 Entity 와 가른다 · 되돌아오는 간선으로 cycle |
| whole_part | 부분들을 둘러싼 region | 선 없음 | **region 테두리는 점선** — region 이 node 가 <b>아님</b>을 표시 |

### 겹침 해결의 구체 배정 (plate 05)

- **execution_flow = 채움 없음 · 흑** · **goal_means = 채움 있음 · 파**. 구조는 완전히 같고 채움과 색만 다르다.
- 기본은 맥락이 결정하고, **한 도면에 함께 쓰일 때만** 다음 순위 축(채움 → 색)을 꺼낸다.

> **해소(2026-09-13, 사용자 결정)**: 잠시 긴장이 있었다 — plate 04 는 execution_flow 안에서 **Process 를 채워** Entity 와 가르고,
> plate 05 는 execution_flow 전체를 **채움 없음**으로 두어 goal_means 와 가른다. 채움 하나가 두 구분을 맡는 꼴이었다.
> 사용자: *「execution_flow 안에서 Process, Entity 는 rect, stadium 으로 표현해서 식별하면 되잖아」* — 그렇다.
> **Process / Entity 는 모양(1순위 축)이 이미 가른다**. 따라서 **채움은 그 구분에 쓰지 않는다**:
>
> | 구분 | 쓰는 축 | 순위 |
> |---|---|---|
> | Process / Entity (execution_flow 내부) | **모양** rect / stadium | 1 |
> | execution_flow / goal_means (겹칠 때) | **채움** 없음 / 있음 (+ 색) | 2 (·3) |
>
> **채움은 한 뜻만 진다.** 낮은 순위 축을 아끼는 이 순서가 규칙이다 — 위 순위 축으로 이미 갈리면 아래 축을 꺼내지 않는다.
> plate 04 의 Process 채움은 이 규칙에서는 **불필요한 장식**이다(모양이 이미 갈라 준다).

### 확실성의 실제 단계 (plate 06)

- 두 끝(확정·미정)만 고정이고 사이는 눈금이 아니라 **방향**이다. 실선과 구별이 어려워지는 촘촘한 간격은 쓰지 않으므로
  **실제로 쓰는 단계는 셋**(실선 · `6 6` · `2 9`).

### 추상화의 그리기 규칙 (plate 08)

- 절단선은 노드만이 아니라 **간선까지 끊는다** — 은닉된 층은 흐려지는 것이 아니라 도면에서 **분리된다**.
- **구조적 손실**: 분기는 tree 가 담지만 **병합은 담지 못한다**. 그것이 tree 가 아닌 것을 tree 로 가정할 때 치르는 값이다.
- **의미적 손실 = 캡슐화 = region 이 node 가 되는 일**. 위상은 그대로 두고 내용만 접는다 —
  whole_part 에서 전체만 남기고 부분을 감추는 조작과 같다.

### 그림 편의성 (plate 09)

- node: 직사각형 > 선 > 원 > **색상 변경** > 둥근 각 > Stadium · edge: 점선 > 화살표
- **색상 변경은 채움의 전제다** — 4순위 항목은 칠하는 행위가 아니라 *색을 바꿀 수 있는가*이고,
  바꿀 수 없으면 2순위(채움) 자체가 성립하지 않는다.
- **대가**: 그리기 가장 쉬운 직사각형이 식별력 1순위 축에 있고, 가장 어려운 Stadium 이 그 축의 반대편을 맡는다 —
  **가장 비싼 획이 가장 중요한 구분을 진다**.

### 흑/백의 해석 (plate 02)

- 흑 = 그 테마의 **전경색**, 백 = **배경색**. 밝은 배경에서는 검정/흰색, 어두운 배경에서는 그 역.

### 시트의 SVG 클래스 규약

`s-ink`(실선) · `s-faint`(흐린 선) · `n-out`(빈 노드) · `n-fill`(채운 노드) · `n-faint`(은닉 노드) ·
`tn`(노드 라벨) · `t-s`(작은 주석) · `t-r`(빨간 주석) — 여덟 개가 모든 도면을 그린다.
시트 파일에는 `<!doctype>`·`<html>`·`<head>`·`<body>` 가 **의도적으로 없다**(artifact 가 껍데기를 씌운다) —
다른 곳으로 옮길 때만 감싼다.

---

## 11. 앞 판에서 바뀐 것 — 저장소 기록 (2026-09-12 → 2026-09-13)

앞 판(곡선 기반 Version A 계열)을 이 문서가 대체한다. **표현을 늘리지 않고 줄이는 방향**으로 바뀌었다.

| 무엇 | 앞 판(2026-09-12) | 이 판(Version B) | 귀결 |
|---|---|---|---|
| **매핑의 둘째 축** | 곡률(직선/곡선) | **양 끝 노드의 조합**(rect / stadium) | 곡선이 매핑에서 빠진다 |
| 실행흐름 | 직선 + 촉 | **rect 단독 또는 rect+stadium 혼합** + 촉 | Entity 가 Process 앞뒤에 놓이는 형태 자체가 표지 |
| 목적/수단 | 곡선 + 촉 | **rect → rect** + 촉 | 수단·목적이 둘 다 Process 라서 |
| is_a | 곡선 + 촉 없음 | **stadium chain** | 개념은 Entity(있는 것)라서 |
| 전체/부분 | 영역 | **영역**(유지) | 2026-09-07 결정 그대로 · 추상화와 직결 |
| 곡선 | Main 축, 두 의미를 나름 | **식별력 4순위 · edge 에서 사용 지양** | layout 이 바뀌면 형태가 변해 불안정 |
| 색 | 「확정하지 않는다」 | **5색 확정**(흑/백/빨/초/파) · edge·node 4순위 | 식별 축으로 편입, 심미적 사용도 허용 |
| 위계 기준 | 명시 안 됨 | 표현 = **식별력** · 의미 = **사용빈도** | 두 위계가 서로 다른 자로 재어진다 |
| certainty | 모든 의미에 겹침 | **is_a 에는 적용 안 함** · whole_part 는 미정(?) | 분류 체계에 확실/불확실 축이 안 맞음 |
| Core/Main/Sub | 위계 이름 | **이름을 없애고 우선순위를 명시하는 안**이 제기됨 | 미결 |

**저장소 쪽에 남는 일**: 적용판 둘(`expression_hierarchy.html` · `design_system_demo_decided.html`)이 아직 곡선 매핑으로 그려져 있고,
슬라이드 생성기(`docs/formal/gen_goal_slides_l12.py`)와 `README_node_system.md` 도 마찬가지다.
앞 판 원문은 세션 임시본(`scratchpad/digram_design_20260912.md.bak`)에만 있다 — 정본이 아니다.

## 11b. 이 판 이후 결정 원장에서 바뀐 것 — 저장소 기록 (2026-10-04 반영, 2026-10-05 추가)

§1~§10 은 사용자 원문이므로 고치지 않는다. 고정은 불변이 아니라 **변경의 기준선**이다(DEC-013). 아래 결정이 본문보다 우선한다.

| 본문 위치 | 본문(2026-09-13) | 바뀐 결정 | 근거 |
|---|---|---|---|
| §10b 매핑 표 whole_part 행 · §11 certainty 행 「whole_part 는 미정(?)」 | region 테두리는 점선 | **결정된 묶음 = 실선 영역, 미정인 묶음 = 짧은 점 `2 6`**. 간격 = 확실성을 모든 요소에 통일, 미정에는 정도를 두지 않는다 | DEC-007 (2026-09-28, Human) |
| §10b 매핑 표 whole_part 행 (DEC-007 이후) | (본문에 없음) 「결정된 묶음」의 주체 | **「결정」은 Human의 결정과 무관하게 Agent의 결정도 포함한다.** Agent가 정해 그린 묶음은 Human 검토 전에도 **실선**으로 그리고, 검토 대기는 그림이 아니라 **보고 글**로 알린다. `2 6` 점선은 「내용 미정」 한 뜻만 갖는다. 조건: 도식이 정합해야 하며 그리기 전·후에 검증한다(형식·규칙 + 렌더 이미지와 실제 내용의 의미 정합) | DEC-133·134 (2026-10-05, Human), DEC-137~140 |

발견 경위: 판 중립 판정기(`v3_8_cli/eval/JUDGE_CRITERIA.md` J7)가 이 본문만 읽고 실선 영역을 FAIL 로 판정했다(DEC-113).

<!-- 항법 -->
- 논리 쪽 규약 [[concept-gate-h1-wt/docs/diagrams/README_node_system|README_node_system]]
- 적용판 `docs/formal/expression_hierarchy.html`(보조판) · `docs/formal/design_system_demo_decided.html`(적용판)
- 상태 정본 [[concept-gate-h1-wt/HANDOFF|HANDOFF (worktree 루트)]]
