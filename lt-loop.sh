#!/bin/bash
while true; do
  npx --yes localtunnel --port 8080 --subdomain copabrasil2026aj >> lt.log 2>&1
  echo "[reinicio tunnel $(date)]" >> lt.log
  sleep 2
done
