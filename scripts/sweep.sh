#!/bin/bash
# Page sweep: horizontal overflow + page errors per URL
# usage: bash scripts/sweep.sh "url1 url2 ..." [viewport]
URLS=($1)
VW=${2:-1440x900}
agent-browser set viewport ${VW%x*} ${VW#*x} > /dev/null 2>&1
for u in "${URLS[@]}"; do
  agent-browser errors --clear > /dev/null 2>&1
  agent-browser console --clear > /dev/null 2>&1
  agent-browser open "$u" > /dev/null 2>&1
  sleep 1.6
  OUT=$(agent-browser eval "(() => { const d=document.documentElement; const ow=d.scrollWidth-d.clientWidth; const eb=document.body.innerText.includes('خطای غیرمنتظره')||document.body.innerText.includes('ErrorBoundary'); return JSON.stringify({ow, eb}) })()" 2>/dev/null)
  ERR=$(agent-browser errors 2>/dev/null | grep -c "Error\|error" || true)
  ERRHEAD=$(agent-browser errors 2>/dev/null | head -2 | tr '\n' ' ' | head -c 120)
  echo "$u | ovf=$OUT | pageErrs=$ERR ${ERRHEAD:+ ⚠ $ERRHEAD}"
done
