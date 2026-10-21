# Merchant operations and money preview

Published 2026-10-21 04:35 UTC (October 20, Chicago). This is a preview/sandbox release, not public-release sign-off.

## Deployed artifacts

- Backend: `1087bbea11ee5be95e4d639bc5a31720f6cbff8b`, DigitalOcean `/opt/bookmiz-backend/current`. Additive payout-mode migration applied; booking and identity containers healthy. Identity runtime code unchanged.
- Mobile main implementation: `ce4ccb4`; frozen preview source: `04e985137b337ac3a224bc68c6e7eadafbabd0aa`, branch `codex/merchant-preview-20261020`.
- Android preview group: `44347a33-4271-460c-b526-b65f6c21c731`; update `01a15cbe-7af5-7706-8c43-0a04d66b704a`; runtime `b458e56796edaa9a0aebce320d6c491163561b33` (existing APK version code 2).
- iOS preview group: `4efa79b9-5245-4086-a819-8aeb563daf4a`; update `01a15cbe-7af5-7d48-aa8f-c5e595169b1f`; runtime `8c9848a7e198a913d8d8d10b79445326921c0f70` (existing TestFlight 1.0.0 build 5).
- Channel `preview` points to branch `preview`. Both runtime-specific manifest requests returned HTTP 200 and the expected new update IDs.

No runtime override was used. Dependency relocation initially changed fingerprint paths; recreating a local dependency layout produced the exact original fingerprints on both platforms. All 78 Android and 77 iOS hashed native inputs matched. No new native dependency, build or store submission was needed.

Both exported Hermes bundles contain the deployed HTTPS identity/booking APIs and no local fixture API/secret. Preview image-upload configuration was saved as the existing public Cloudinary project variables. Private server credentials and local fictional bank adapters were excluded.

## Verification and limits

Backend build plus 90 automated tests passed; mobile typecheck plus 66 tests passed. Database tests cover concurrent payout reservations, retry idempotency, cancellation, sandbox/live boundaries and scoped permissions. Deployed API smoke verified merchant access, customer denial, bounded pagination, exact boolean validation and the payout-mode migration. Both gateways remain test mode; the deployment smoke created no charges.

Both native release bundles exported successfully. The installed Android walkthrough remains unverified: the Windows emulator showed a System UI ANR after boot and Appium could not proceed reliably. Earlier local Expo server starts were rejected by automatic approval review, including an offline attempt, without a detailed reason. Physical iPhone acceptance is pending. These are not passing device tests.

On an existing preview installation, use Account → Check for updates and apply/restart. With a merchant login, enter Your business workspace → Business → Money. Check overview, booking payments/refunds, masked bank destinations, payout review/retry and the keyboard on an actual phone/tablet before public release. Never create live charges as part of this sandbox acceptance.

Binding quote checkout, discretionary partial refunds and automated Paystack transfers remain outside this implementation. Paystack payouts are reviewed requests. Live Paystack payout activation with historical sandbox/unclassified wallet activity requires audited reconciliation first.

The frozen preview branch preserves the old `eas.json` solely to reproduce installed runtime fingerprints. Do not submit a new iOS build from it: main has the corrected App Store Connect target. Use main and re-check signing/configuration for future binaries.
