# IR 작성

**읽는 때**: IR(JSON)을 쓰기 전. Agent가 쓰는 것은 IR(과 `decisions.json`)뿐이다. SVG·HTML·PNG는 `drd.mjs finalize`만 만든다.

```json
{
  "w": 780, "h": 160,
  "legend": {"verify": {"color": "green", "label": "검증하는 Task"}},
  "nodes": [
    {"id": "src", "role": "entity", "label": "원문", "x": 90, "y": 80},
    {"id": "grp", "role": "process", "label": "검증 묶음", "x": 330, "y": 80, "expandAt": 0, "drawRegion": true, "source": "request"},
    {"id": "chk", "parent": "grp", "role": "process", "kind": "verify", "label": "대조", "x": 330, "y": 80}
  ],
  "edges": [{"from": "src", "to": "chk", "meaning": "execution_flow", "certainty": "solid"}]
}
```

- **node**
  - `role`: 모양을 정한다(`process` = rect, `entity` = stadium). 유형 파일이 정한 뜻대로 고른다.
  - `x`, `y`: 중심 좌표. `w`, `h`로 크기를 바꿀 수 있다(기본 176 × 44). `w`를 주지 않으면 라벨 길이에 맞춰 넓어진다. `w`를 준 경우 라벨이 넘치면 `VB-LABEL-FIT` 경고.
  - `kind`: 종류. 색은 `legend`에 정의한다.
  - `parent`: 이 node를 품는 전체 node의 id.
- **전체(group) node**
  - `x`, `y`: 접혔을 때의 위치. 접힐 수 있는 전체 node에는 반드시 준다(없으면 부분 node들의 중심에 자동 배치하고 `VB-GROUP-POS` 경고).
  - `expandAt`: 이 L 단계부터 펼쳐진다. 그보다 낮은 단계에서는 접혀 [+]가 붙는다. 접혀도 자기 `role`의 모양을 유지한다.
  - `drawRegion: true`: 펼쳤을 때 영역을 그린다.
  - `"certainty": "dashed"`: 원천이 묶음의 내용을 미정으로 표현한 경우에만 준다(DEC-141). Human 검토 대기나 Agent 자신의 불확실만으로 설정하지 않는다. 영역이 짧은 점 `2 6`으로 그려진다.
  - `source`: **묶음을 누가 정했는지**에 관한 출처다. 도식이 표현하는 내용의 원천 존재 여부와 구분한다. `"request"`(요청에 명시) 또는 `"human"`(Human이 고름, `decision_ref` 필수). 둘이 아니거나 `human`인데 유효한 `decision_ref`가 없으면 `finalize`가 그 묶음을 실선으로(점선은 원천이 미정이라고 표현한 경우만, DEC-141) 그리고, 검토 대기는 REVIEW 보고 글로 알린다 (DEC-133). `STATUS REVIEW_PENDING`으로 Human 검토 대기를 표시한다. **실제 Human 답이나 명시 요청 없이 `request`/`human`을 쓰지 않는다**([human-decisions.md](human-decisions.md)).
- **edge**
  - `meaning`: 관계 유형.
  - `certainty`: `solid`, `dashed`, 또는 간격 숫자.
  - `arrow: false`: 화살촉을 없앤다.
  - `label`: edge 이름.
  - `from`·`to`는 그 단계에서 **보이는 node**여야 한다. 펼친 전체 node(영역)는 끝점이 될 수 없다. 영역 안의 부분 node를 가리킨다(`VB-EDGE-ENDPOINT`).
  - `loop: true`: 되먹임(cycle). 강조 범위 계산에서 뺀다.
  - `sdx`, `tdx`: 출발점·도착점의 가로 이동.
  - `route`
    - `"hvh"` + `busX`: 여러 입력이 한 node로 모일 때(fan-in) 쓴다. 가로로 나와 `busX`에서 세로로 모인 뒤 가로로 들어간다. 여러 node가 세로로 쌓여 한 곳으로 모이면 기본 경로 대신 이것을 써서, 선이 형제 node를 관통하지 않게 한다.
    - `"curve"`: 우회가 필요할 때만 쓴다.
