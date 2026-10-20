# Android closed-test v2 packaging

Base: online-beta / 2db30c230757db700a8f9374b7939627fb22f622.
Android only: jp.nyanchase.game / versionName 1.0 / versionCode 2.

## Generate and build

Run only in the Android-specific worktree:

```powershell
node scripts/prepare-android-closed-test.cjs
npx.cmd cap sync android
# Use the existing protected upload signing configuration and JDK 21.
# Run android/gradlew.bat :app:bundleRelease with that environment.
```

Do not run iOS asset sync/build/archive/upload. No Worker change/deploy is required.

The dedicated generator calls the existing production Android asset generator,
then transforms Android www only. Root index.html, game.js, storekit-ui.js,
style.css, release-features.js and every iOS file remain untouched.

Android outputs contain NYAN_ANDROID_CLOSED_TEST={skillMode:false,paidSkills:false,shop:false}
and scoped CSS/entry guards. The entire Shop and Home/result entry routes are hidden and guarded.
The underlying Shop and free skill descriptions remain intact. Paid skills,
Pack, purchase/restore controls, Skill Mode and its ad-unlock entry are unavailable.
Billing and Rewarded implementations, credentials, ownership and effects remain intact.
Daily rewarded ads are not disabled by this policy.

As approved, an Android guest receiving an ability-rule Room leaves using the
existing reset path and displays a normal-room instruction. Normal Room handling
and all iOS/Worker code remain unchanged.

The Android Gradle release gate checks both source/bundled hashes and exact
Android policy transformations. Running the ordinary generator alone is not
sufficient for versionCode 2: the Release build fails instead of exposing paid UI.
Changed upstream anchors also fail packaging for review rather than silently
reintroducing a hidden route.

An iOS build from this commit continues using the original shared sources and
existing iOS generation command. The Android packaging script is never called
by that path. Tests verify byte-identical iOS inputs and original Shop routes.

Service Worker uses an Android-only cache name. When replacing an earlier QA
build with cached assets, allow SW activation and restart; do not erase server data.