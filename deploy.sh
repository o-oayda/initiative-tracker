#!/bin/bash

# Usage: ./deploy.sh [target-directory]
TARGET_DIR="${1:-obsidian-test-ground}"
# Plugin folder must match manifest.json "id"
PLUGIN_ID="initiative-tracker-custom"
TARGET_PATH="$HOME/Documents/${TARGET_DIR}/.obsidian/plugins/${PLUGIN_ID}/"
SRC_DIR="$HOME/Documents/initiative-tracker"
FILES=(main.js manifest.json styles.css)

# build main.js, manifest.json and styles.css
npm run build

# Check if target directory exists
if [ ! -d "$TARGET_PATH" ]; then
  echo "Error: Target directory $TARGET_PATH does not exist."
  exit 1
fi

# Check if source files exist
for file in "${FILES[@]}"; do
  if [ ! -f "$SRC_DIR/$file" ]; then
    echo "Error: Source file $SRC_DIR/$file does not exist."
    exit 1
  fi
done

# copy each file individually and log success
for file in "${FILES[@]}"; do
  cp "$SRC_DIR/$file" "$TARGET_PATH"
  if [ $? -eq 0 ]; then
    echo "Copied $file to $TARGET_PATH"
  else
    echo "Failed to copy $file to $TARGET_PATH"
    exit 1
  fi
done

echo "All files copied successfully to $TARGET_PATH."
