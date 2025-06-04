#!/bin/bash
cd /home/kavia/workspace/code-generation/pokerdatesync-27978-62150d07/poker_date_sync
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

