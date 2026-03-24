#!/bin/bash

# Debug info (optional)
echo "Branch: $VERCEL_GIT_COMMIT_REF"
echo "Commit message: $VERCEL_GIT_COMMIT_MESSAGE"

# Only deploy if on main AND commit contains [deploy]
if [[ "$VERCEL_GIT_COMMIT_REF" != "main" ]] || [[ "$VERCEL_GIT_COMMIT_MESSAGE" != *"[deploy]"* ]]; then
  echo "Skipping build: Not main branch or missing [deploy]"
  exit 0
fi

# Run the real build
echo "Building project..."
npm run build