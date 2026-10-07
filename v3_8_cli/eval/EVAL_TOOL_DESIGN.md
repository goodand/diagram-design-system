# Skill 평가 도구 설계안 (초안, 2026-10-04)

근거 결정: DEC-063(증거 출처 분리) · DEC-067(완료는 결과로) · DEC-074·093(Claude Code + dynamic workflows) ·
DEC-079(관문 우위는 단위 시험, 행동 우위는 실험) · DEC-083(AI가 Human 역할로 답함) · DEC-094·095·096.

## 기존 도구와의 차이 (조사: skill-creator eval, EmilienM/agent-eval-harness)

| 능력 | skill-creator | agent-eval-harness | 이 도구 |
|---|---|---|---|
| 시험 대상이 **글로** 질문하면 답하고 이어 가기 | 없음 | AskUserQuestion만 | **사전등록 답으로 이어 가기** (질문이 나온 뒤에만 전달) |
| 두 skill 판 비교 | 있음 | 없음 | 있음 (판 × effort × 반복) |
| 증거 출처 분리 | 없음 | 없음 | **S(skill 영수증) / E(대화·도구 기록·화면)** 따로 채점 |
| 판정 방식 | LLM grader 중심 | LLM·Python | **규칙이 판정, LLM은 슬롯만 채움** (예: 질문 문장이 "분석 값 질문"인지 분류) |
| 사전등록 | 없음 | 없음 | 과제마다 필수 Human 결정·금지 행동을 실행 전에 동결 |
| 판정기 자기 시험 | 없음 | 없음 | 판정기는 고정 시험 세트를 먼저 통과해야 실험에 쓰임 (H9) |
| 재판정 | 재실행 필요 | 재실행 필요 | 저장된 산출물로 **판정만 다시** (Workflow resume) |
| Human 사후 검토 | viewer 피드백 칸 | 없음 | **산출물 갤러리 + A/B 후보 + 피드백 → 결정 원장** (DEC-095) |

## 구조

```
tasks.json (GC-1~4, Human 재작성판)  +  preregistration.json (과제별 필수 결정·금지 행동·기대 결과)
        │
        ▼  Workflow (dynamic): 조건 = skill판 × effort × 반복, 병렬
  [run]   claude -p (격리 폴더, --plugin-dir skill판, --effort) → 질문 감지 → 사전등록 답 → --resume … 종료
          모든 턴·도구 호출·산출물을 run 폴더에 저장
  [judge] S 판정: receipt.json + drd verify  (skill이 스스로 아는 것)
          E 판정: 대화 기록(분석 전 질문?, 예시 없음?), 도구 기록(산출물을 CLI만 만들었나), 화면(최종 HTML 렌더)
  [report] skill-creator 집계기·viewer 형식 재사용 → 판별 평균±표준편차 + 산출물 갤러리
        │
        ▼
  Human 사후 검토 → 피드백을 결정 원장에 기록 → 다음 판
```

## E 판정 항목 (초안)

| 코드 | 무엇 | 증거 | 판정 |
|---|---|---|---|
| E2 | 분석 값(군집·분할 개수)을 분석 **전에** 물었다 | 대화 순서 | 규칙 (질문 분류만 LLM) |
| E3 | 그 질문 선택지에 예시·표현이 없다 (DEC-094) | 질문 원문 | 규칙 + LLM 슬롯 |
| E4 | 최종 화면이 Human 답을 반영한다 | 답 ↔ IR ↔ SVG | 규칙 |
| E5 | 미정 묶음을 정직하게 표시하고 보고했다 (DEC-095) | receipt.review_pending ↔ 최종 보고 | 규칙 |
| E6 | 산출물을 skill CLI로만 만들었다 | 도구 호출 기록 | 규칙 |
| E8 | 실제 화면이 선언과 같다 | 최종 HTML을 브라우저로 렌더 | 규칙 |

## 단계 (MVP 순서, 각 단계는 Human이 볼 수 있는 결과로 끝남)

1. 시험 대상 1회 실행 + 질문 이어 가기 (GC-2 하나) → 대화 기록과 산출물을 Human이 봄
2. E 판정기 + 자기 시험 세트 → 판정표를 Human이 봄
3. Workflow로 전체 조건 실행 → 보고서(갤러리 포함)를 Human이 봄
