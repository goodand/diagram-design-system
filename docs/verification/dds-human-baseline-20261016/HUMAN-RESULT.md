# Human 검수 — 선정 4사례

2026-10-16. Downloads의 저장본 5개를 human-responses/에 원문 그대로 보존했다. 최신 응답은 `dds-selected-four-20261016-human-response (4).json`, recordedAt=2026-10-16T04:30:56.578Z이다. 4개 HTML의 SHA256은 응답에 기록된 해시와 모두 일치한다.

| 사례 | 저장된 판정 | 원문 조건·의견 |
|---|---|---|
| Diamond + Diamond 모두 펼침 | PASS | 의견 없음 |
| Cycle + Cycle 모두 펼침 | PASS | '100%' PASS, '전체 맞춤' 글씨가 작아서 안 보임, Hover는 정상 작동 |
| Diamond 펼침 + Cycle 접힘 | UNREVIEWED | PASS로 보이나 '공유 경계 Hover'와 '내부 노드 Hover'의 차이를 모르겠음 |
| Cycle 펼침 + Diamond 접힘 | PASS | 의견 없음 |

전체 4/4 PASS로 해석하지 않는다. 세 번째 사례의 시각적 긍정 의견과 미확정 Hover 판정을 구분한다. Cycle+Cycle의 전체 맞춤 세부 가독성은 PASS 범위에서 제외한다.

검수 설명 보완: 공유 경계는 두 Core 사이의 타원형 ‘Core 간 산출물’이다. 내부 노드는 펼친 Core 안의 ‘분기’, ‘경로 A/B’, ‘병합’ 등이다. 공유 경계 Hover는 양쪽 소속의 합집합, 내부 고유 노드 Hover는 해당 Core 소속이 강조되는 것이 계약이다. 해당 사례의 실제 조작 결과는 이 설명만으로 판정하지 않는다.

저장 UI의 displayWidth=0은 숨겨진 이미지 요소 측정값이다. live iframe의 실제 너비가 0이라는 의미가 아니다. displayMode=original-size 역시 외부 이미지 모드 필드이며 iframe 내부의 실제 100%/전체맞춤 모드는 기록하지 못했다. 해당 조건은 Human 의견 원문을 따른다. 이 기록 결함을 새 Human 판정으로 보정하지 않는다.

## 후속 Human 명확화 — 애니메이션

원문: “'실제 시간 흐름에서 문구를 읽고 단계별 상태 변화를 따라갈 수 있는지 관찰' 이것도 pass로 해, 읽을 수 있으니깐 1.8초대 pass라고 한거지”

판정: **PASS**. 기존에 검수한 1.8초대 애니메이션의 PASS는 실제 재생 중 문구를 읽고 단계별 상태 변화를 따라갈 수 있다는 판정을 포함한다. 이를 미검증으로 남겨 추가 검수를 요구하지 않는다. 상태 문구의 의미 결정은 Human과 ToolUsingAgent의 관할이며, 매 flow마다 문구 변경을 요구하지 않는다. 1.6초 직접 검수나 임의의 새 문구·속도에 대한 PASS로 확대하지 않는다. 위 네 사례의 개별 응답, 특히 Hover 차이에 대한 보류와는 별도 판정이다.

## 후속 Human 판정 — 세 번째 사례의 내부 노드 Hover

원문: “내부 노드에 Hover 펼친 Diamond 쪽이 강조되는 실제 화면 강조가 잘 되는건 pass로 봐도 괜찮아”

판정: **내부 노드 Hover 강조 PASS**. 대상은 `hover-pair-diamond-then-cycle-task-a`, 설명 화면 `hover-explanation.html`과 실제 캡처 `hover-internal.png`이다. 펼친 Diamond의 내부 노드에 Hover했을 때 해당 부분이 선명해지고 접힌 Cycle이 흐려지는 표현을 승인한 후속 답변이다. 기존 JSON의 UNREVIEWED 원문은 유지하고 이 후속 판정을 함께 해석한다.

공유 경계 Hover는 양쪽 Core의 합집합이 전체 도식이어서 기본 화면과 시각적으로 같다는 점을 확인했다. 이 내부 노드 PASS를 공유 경계 Hover의 별도 Human 승인이나 모든 Hover 조합의 PASS로 확대하지 않는다. 공유 경계 동작의 규칙 검증과 Human 시각 판정은 구분한다.

## 후속 Human 판정 — 공유 경계 및 Core B Hover

원문: “`Core 간 산출물` 위에 포인터 표시 Hover 했을 때 둘 다 잘 보이냐고 하면 잘 보이고, 이건 강조는 아니지만 무제는 없고 Core B 위에 Hover 했을 때 잘 보이니까 충분해보여”

판정: **PASS**. 공유 경계 Hover에서 두 Core 모두 잘 보이며 문제없고, Core B Hover도 충분하다는 Human 판정이다. 공유 경계 Hover는 기본 화면 대비 추가 강조가 보이지 않아도 이 사례에서는 결함으로 취급하지 않는다. 직전 문단의 공유 경계 Human 판정 유보는 이 후속 답변으로 해소한다.

선정 4사례의 요청한 검수는 후속 답변을 포함해 모두 PASS다. Cycle+Cycle은 100% 표시 PASS·전체 맞춤의 세부 글씨는 읽기 어려움이라는 조건을 유지한다. 이를 전체 39상태나 모든 입력의 Human PASS로 일반화하지 않는다. 최초 저장 JSON과 이후 답변은 덮어쓰지 않고 함께 보존한다.
