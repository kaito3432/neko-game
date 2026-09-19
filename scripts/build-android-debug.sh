#!/bin/zsh
set -euo pipefail
project_root=${0:A:h:h}
cd "$project_root"
npx cap copy android
cd android
./gradlew :app:assembleDebug
echo "$project_root/android/app/build/outputs/apk/debug/app-debug.apk"
