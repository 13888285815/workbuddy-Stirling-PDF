#!/bin/bash
T=$(grep "13888285815" ~/.git-credentials | sed 's|https://13888285815:||' | sed 's|@github.com||')
export GH_TOKEN=*** gh auth status 2>&1
