# Build 16 ATT verification - 2026-10-15 (JST)

## Scope and decision

Formal base: online-beta, 947428ada0d64986ae8628a7e8f7d72981871fe8.
Release-configuration Development builds were tested with Screenshot Mode disabled.
User authorized formalization after the checks below. Device UI/regression results
are user observations; debugger results are distinguished explicitly.

## iPhone K - authorized startup

- OS status read at the native advertising gate: 3 (authorized).
- Native ATT finish observed at 23:34:19.963 and 23:34:20.324.
- GADMobileAds startWithCompletionHandler: entered at 23:34:21.079.
- At 23:36:04, SDK adapter status was Ready; exact completion instant was not captured.
- UMP consentStatus=2 (NOT_REQUIRED), canRequestAds=YES.
- Rewarded extras setter received npa=1 at 23:37:06.367.
- Rewarded load method entered at 23:37:06.819.
- Completion returned NSError domain com.google.admob, code 1 (No Fill).
- Retry UI appeared and Home remained accessible (user confirmed).
- Home, Shop, product/pack details, Restore, Online entrance, Collection, Daily,
  CPU and Local basic startup were reported normal after this run.
- Earlier Restore returned three purchases. Owned products could not be bought
  again; no real purchase was attempted.
- After permission was revoked in Settings, Home, retry UI, Shop/owned status
  and Restore remained usable (user confirmed in the earlier run).

Times include debugger pauses and are not startup performance measurements.
One earlier attach/expression attempt was terminated by iOS for memory reasons.
It is recorded as a debugger-associated OS termination, not erased from results
or represented as proof of a normal-runtime crash. Later observed run continued.

## iPad - first ATT denial

- Existing Build 13 was overwritten without uninstall/reset; user confirmed
  previous ownership/progress remained available.
- Native status before answering: 0 (notDetermined).
- User selected the initial request-to-not-track option; native status=2 (denied).
- Native ATT finish at 23:14:08.839 / 23:14:09.308 preceded SDK start at 23:14:09.914.
- UMP NOT_REQUIRED, canRequestAds=YES; rewarded extras received npa=1 at 23:17:22.951.
- Retry UI displayed. Its exact SDK error was not captured in that iPad run.
- User reported Home, Shop, product/pack details, Restore, Online entrance,
  Collection, Daily and retained data normal.
- This is iPad initial denial, not an iPhone initial-denial result.

## Release invariants

- ATT gate precedes AdMob plugin initialization; unresolved/error status fails closed.
- Authorized, denied and restricted statuses may proceed to UMP; UMP canRequestAds
  still gates reward requests. ATT refusal does not gate game/IAP features.
- npa=true remains set even when ATT is authorized.
- Publisher first-party ID stays disabled; publisher privacy personalization stays disabled.
- Native app code does not read or expose the IDFA.
- NSUserTrackingUsageDescription is present; SDK manifests remain independent.
- GMA manifest DeviceID has Tracking=true / Linked=true, with ThirdPartyAdvertising,
  Analytics and DeveloperAdvertising purposes. The other four manifests have no
  per-data Tracking=true entry. Build 16 manifests matched Build 15 during testing.

## Explicitly unverified / not formalization blockers per user

- Initial ATT denial on iPhone (not manufactured through deletion/reset).
- Successful ad display/reward: iPhone request reached SDK No Fill instead.
- Actual purchase of a previously unowned product.
- Exact SDK initialization completion timestamp, network payload contents and
  all third-party backend data uses were not verified by these checks.

No uninstall, privacy reset, production Worker change, ASC change or release
submission was part of device verification. Formal commit/push and a new local
Distribution Archive were separately authorized; upload/publication were not.
