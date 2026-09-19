#!/bin/zsh
set -euo pipefail

project_root=${0:A:h:h}
derived_path=${NYAN_SANDBOX_DERIVED_DATA:-/private/tmp/nyan-storekit-sandbox-derived}

cd "$project_root"
npx cap copy ios
cp api-environment.sandbox.js ios/App/App/public/api-environment.js
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$derived_path" \
  -allowProvisioningUpdates \
  build

echo "$derived_path/Build/Products/Debug-iphoneos/App.app"
