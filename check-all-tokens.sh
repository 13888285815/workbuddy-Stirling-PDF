#!/bin/bash
# Try all available tokens
for acc in "87047954" "13888285815"; do
  T=$(grep "$acc" ~/.git-credentials | sed "s|https://$acc:||" | sed 's|@github.com||')
  echo "--- Trying account $acc (token len=${#T}) ---"
  export GH_TOKEN=*** gh auth status 2>&1
done
