#!/bin/bash
# Simple script to run Claude with a prompt from a file

PROMPT_FILE="$1"
if [ -z "$PROMPT_FILE" ]; then
  echo '{"error": "No prompt file provided"}'
  exit 1
fi

# Run Claude with the prompt from file
claude -p "$(cat "$PROMPT_FILE")" --output-format json 2>&1