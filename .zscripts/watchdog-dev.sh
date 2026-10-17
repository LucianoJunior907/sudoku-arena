#!/bin/bash
# Watchdog: keeps the Next.js dev server alive.
# The sandbox reaper kills detached processes after ~1 request,
# so this loop relaunches `next dev` whenever it exits.
cd /home/z/my-project

while true; do
  echo "[$(date '+%H:%M:%S')] Starting next dev..."
  node node_modules/.bin/next dev -p 3000 > dev.log 2>&1
  EXIT=$?
  echo "[$(date '+%H:%M:%S')] next dev exited with code $EXIT, restarting in 3s..."
  sleep 3
done
