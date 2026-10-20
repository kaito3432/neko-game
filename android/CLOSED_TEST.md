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

## Permanent Android / iOS separation rules

1. Treat android/closed-test-v2 as an Android-only branch and use a dedicated worktree.
2. Never automatically merge or merge without explicit authorization into online-beta; Android work does not authorize pushing online-beta.
3. Do not modify the iOS native project during Android work.
4. Do not modify or regenerate iOS web assets during Android work, including the approved Apple Version 1.0 / Build 17 assets and archives.
5. Do not change Apple IAP, ATT, UMP or iOS AdMob settings for Android requirements.
6. Do not modify or deploy the Production Worker solely for Android requirements.
7. If shared source changes are necessary, tests must prove that existing iOS presentation and behavior remain identical.
8. Before and after every Android change, compare hashes of protected iOS files and generated assets against a preserved baseline. Preserve that baseline outside tracked release assets.
9. If any iOS difference or protected hash mismatch is detected, stop and report it before continuing.
10. iOS asset sync, build, archive and upload require explicit instructions; otherwise they are prohibited.
11. Manage Android versionCode independently of the iOS Build number. Android versionCode changes must not change iOS CFBundleVersion.
12. Gate Android-only features through platform checks or Android-only asset generation; never disable a shared feature globally for Android.

For each Android change, review both tracked iOS/Worker differences and protected
file hashes, preserve existing uncommitted work and stashes, and report the results.
These are operating rules, not GitHub branch protection: no merge, push, deploy or
store upload is authorized by this document itself.
