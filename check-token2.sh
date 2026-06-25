#!/bin/bash
T=$(grep "87047954" ~/.git-credentials | sed 's|https://87047954:||' | sed 's|@github.com||')
echo "Token length: ${#T}"
echo "Token prefix: ${T:0:10}"
export GH_TOKEN=*** gh auth status 2>&1
