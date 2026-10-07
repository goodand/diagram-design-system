#!/bin/zsh
# main experiment: 36 runs, sequential, resumable (skips runs with run.json)
cd "$(dirname "$0")"
for rep in 1 2 3; do for c in GC-1 GC-3 GC-4; do for e in low medium; do
  for arm in v3.7 v3.8; do
    [[ $arm == v3.7 ]] && sk=../_baseline_v37/designing-relation-diagrams || sk=../designing-relation-diagrams
    rid=${c}_${arm}_${e}_r${rep}
    [[ -f runs/$rid/run.json ]] && { echo "skip $rid"; continue; }
    echo "$(date +%H:%M) start $rid"
    python3 drd_eval.py run --case $c --skill $sk --arm $arm --effort $e --rep $rep || echo "ERROR $rid"
  done
done; done; done
echo "$(date +%H:%M) ALL DONE"; ls -d runs/GC-*_r* | wc -l
