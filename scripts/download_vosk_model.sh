#!/usr/bin/env bash
set -euo pipefail

# Downloads a small Vosk model into android and ios asset folders.
# Usage: ./scripts/download_vosk_model.sh fr

LANG=${1:-fr}
MODEL_NAME="vosk-model-small-${LANG}-0.15"
BASE_URL="https://alphacephei.com/vosk/models"

DEST_ANDROID="android/app/src/main/assets/models/${MODEL_NAME}"
DEST_IOS="ios/Models/${MODEL_NAME}"

mkdir -p "${DEST_ANDROID}" "${DEST_IOS}"

echo "Downloading ${MODEL_NAME}..."
TMP="/tmp/${MODEL_NAME}.zip"
curl -L "${BASE_URL}/${MODEL_NAME}.zip" -o "${TMP}"
unzip -o "${TMP}" -d "/tmp"
mv "/tmp/${MODEL_NAME}" "${DEST_ANDROID}"
cp -R "${DEST_ANDROID}" "${DEST_IOS}"
rm -f "${TMP}"

echo "Model installed to ${DEST_ANDROID} and ${DEST_IOS}"
