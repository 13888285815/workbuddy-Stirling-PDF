#!/bin/bash
T=$(grep "87047954" ~/.git-credentials | sed 's|https://87047954:||' | sed 's|@github.com||')
export GH_TOKEN=*** Enable Pages
echo "=== Creating GitHub Pages site ==="
RESULT=$(gh api repos/13888285815/workbuddy-Stirling-PDF/pages \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -f source_branch=main 2>&1)
echo "$RESULT"

echo ""
echo "=== Getting Pages status ==="
STATUS=$(gh api repos/13888285815/workbuddy-Stirling-PDF/pages 2>&1)
echo "$STATUS"

URL=$(echo "$STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html_url','N/A'))" 2>/dev/null || echo "parse failed")
echo ""
echo "=== GitHub Pages URL ==="
echo "$URL"
