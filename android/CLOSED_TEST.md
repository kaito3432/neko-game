# Android closed-test v2 packaging

Base: online-beta / 2db30c230757db700a8f9374b7939627fb22f622.
Android only: jp.nyanchase.game / versionName 1.0 / versionCode 3.

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
sufficient for versionCode 3: the Release build fails instead of exposing paid UI.
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

## Android Interstitial (versionCode 3)

Android AdMob unit: NyanChase Android Interstitial,
ca-app-pub-6462457361541481/5028330850. App ID and Rewarded ID remain unchanged.
The Android generator alone copies android/web/interstitial.js and injects its
script/configuration and result-button hooks. iOS generation never includes it.

The existing endGame outcome path records completed CPU/local games once per
game instance. Online counting uses the existing nyan-online-ended server event
(the local predicted endGame never counts an online result) and Room review exclusions
(invalid/cancelled results and finishReason are excluded), with matchId deduplication.
No Room protocol or Worker changes are required. An Android-only localStorage
key, nyanAndroidInterstitialV1, persists the completion count and recent match IDs.
Every third completion is eligible, but nothing shows on result presentation.
Only Home/rematch result actions consume the opportunity and may display the
already-preloaded ad; no load is awaited. Missing/failed ads continue immediately.
Dismissal or show failure continues the original handler once. The plugin's
show promise resolves at display start, so it is not used as a dismissal signal.

Preload uses the existing Rewarded provider initialization and Android UMP
canRequestAds gate, NPA=true and the existing UNSPECIFIED/G native policy.
No automatic retry loop is used. A new game or ad dismissal may preload the next
ad; requests are coalesced and ready ads expire after 55 minutes.
The underlying Billing, Rewarded and ownership implementations remain intact.
No SDK dependency is added. Existing advertising data categories/purposes must
remain disclosed. Unlike optional Rewarded playback, Interstitial preload is automatic
after consent eligibility: if the current Android Data Safety answers describe all
advertising collection as optional, re-evaluate required/optional before release.
This implementation does not alter any Console privacy declaration or shared policy.

VersionCode 2 is preserved in the ignored local audit artifacts before rebuilding.
Use Google test ads for development display testing; the production AAB must
contain only the approved Interstitial configuration, not a test ID override.
