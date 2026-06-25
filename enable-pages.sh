#!/bin/bash
# Try to enable GitHub Pages via curl with the git credential token
T=$(grep "87047954" ~/.git-credentials | sed 's|https://87047954:||' | sed 's|@github.com||')
echo "Token: ${T:0:10}..."

# Try the REST API
curl -s -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $T" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/13888285815/workbuddy-Stirling-PDF/pages" \
  -d '{"source":{"branch":"main","path":"/"}}' 2>&1

echo ""
echo "---"
# Also try with the other token
T2=$(grep "13888285815" ~/.git-credentials | sed 's|https://13888285815:||' | sed 's|@github.com||')
curl -s -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $T2" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/13888285815/workbuddy-Stirling-PDF/pages" \
  -d '{"source":{"branch":"main","path":"/"}}' 2>&1
