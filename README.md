# BookMiz mobile

Expo customer and agent app connected to the BookMiz identity and booking APIs.

Install with `npm ci`, run `npm run typecheck`, and start with `npm start`.
The default API addresses point to the deployed BookMiz services. Database and
Stripe secret keys belong only on the backend and must never be added here.

Pushes and pull requests run checks only. A native Android build requires manually
dispatching the workflow with `buildAndroid` explicitly enabled. No EAS build,
submission, or update is part of the checks. Run `npm test` for regression tests.

The manual Android test-build workflow produces an installable APK for internal testing
using the generated development signing key. It is not an App Store or Play Store
release. Store publishing requires the owner's signing and developer accounts.

Payment opens hosted Checkout. Use the BookMiz sandbox and official Stripe test
cards while the backend remains in test mode. Appointment details show paid,
unpaid, refund-pending and refunded states from the backend.

Release configuration targets the existing `@gatherplus/bookmiz` Expo project and
Apple identifier `com.anonymous.bookmiz`. Do not delete the Apple app record or
reuse Dishup's project. OTA updates use native fingerprints and require a new
compatible binary before this code can update installed apps.

Before the next release, deploy the matching backend changes and migrations,
configure APNs and Firebase FCM v1 credentials in the BookMiz project, and supply
the matching Android Firebase configuration via the `GOOGLE_SERVICES_JSON` EAS
file variable (or an untracked local `google-services.json`). Keep backend push
dispatch disabled until credentials and native delivery are verified.

The Android Firebase app is registered in `bookmiz-8a0a9` as
`com.bookmiz.customeragent` (BookMiz Android). Its verified client configuration
is saved locally as the ignored `google-services.json`; Expo config picks it up
without generating a native project or starting a build. A client config file
does not replace the separate FCM v1 server credential required by EAS.

Android FCM v1 is configured in EAS for this application identifier using the
dedicated `bookmiz-expo-push` service account, with only Firebase Cloud Messaging
API Admin on `bookmiz-8a0a9`. A Google validation-only request returned HTTP 200;
no device message was delivered. The Android client config is stored as the
project-scoped `GOOGLE_SERVICES_JSON` secret file for preview and production.
The service-account private key is never part of the app or Git repository.
iOS APNs is assigned in EAS to `com.anonymous.bookmiz`, using the existing
same-team key `A6R758W36W` for Apple team `GXRY3YX2NL`. No key was created or
revoked. Native end-to-end delivery testing remains a release prerequisite.

Push alerts deliberately omit message and payment content. Delivery is queued
and current session/notification access is checked again before dispatch.
Drafts are scoped to each account and encrypted with SecureStore on devices;
the web preview uses session storage. Document copies are removed from app cache
after upload or sharing.

Account deletion is a tracked review request, not automatic record removal. Users
can submit, track and withdraw it in Security. Super admins review the queue in
the website's Admin Security page. The matching identity migration is required;
financial and booking records remain intact while obligations and retention are
reviewed. No completed status is offered before deletion is actually fulfilled.

## App updates and release status

Account now includes App updates with the installed version, a manual check,
download progress, connection-error retry and an explicit Restart to update
action. Background downloads also surface a restart action. Restart is never
forced while the user is working. Rollbacks to the embedded version use the
same user-initiated restart flow. Web/development previews explain why native
OTA is unavailable instead of claiming they are up to date.

This does not bypass native compatibility. EAS serves updates for the installed
channel and native fingerprint. SDK changes, notification modules, permissions,
or native configuration need a new binary. Updates have been published only to the preview channel.

On October 19, 2026, internal test builds were authorized; public release remains
on hold. BookMiz's signing certificate and App Store profile now expire October
19, 2027. Push Notifications is enabled on `com.anonymous.bookmiz`, and the
replacement profile was checked for `aps-environment=production` before building.
The previous shared certificate was left valid for the other apps that use it.

The SDK 54 iOS build 3 and the October 12 Android installation do not provide the
new native notification/update baseline. Replacement test builds use the preview
channel and the fingerprint policy. Generated native directories are excluded
from the fingerprint because Expo generates them from app config and native
dependencies; those inputs remain included. LF line endings keep Windows and
cloud fingerprints consistent. Local comparison with and without generated
Android files produced the same fingerprint.

The preview EAS environment contains the BookMiz API destinations, so an OTA
publication cannot accidentally inherit the local development API URLs. Firebase
client configuration is supplied separately as an EAS secret file variable.

## Completed remediation overview

- Auth: logout/refresh and profile-save races, mobile MFA/recovery login,
  password changes, verification, authenticator setup and session management.
- Booking: daily availability after summary failure, stale response guards,
  date paging, explicit staff selection, cancellation deadlines and payment terms.
- Requests/chat: encrypted account-scoped drafts, input validation, separate
  conversation drafts, visible chat modal and incoming-message polling.
- Inbox/push: readable notification details, cursor paging, read-state errors,
  tap navigation, foreground refresh and authenticated device registration.
- Documents: scoped customer upload tokens and authenticated file opening,
  with temporary-cache cleanup.
- Agent desk: queue paging, stale-detail guards, bank-resolution checks,
  currency-separated balances and atomic payout commission claims.
- Explore/home/account: consistent search filters/paging, visible load errors,
  profile display and edit behavior, and reliable notification preference saving.
- Deletion: tracked request, withdrawal/status/reference and admin review queue.
- Release controls: existing BookMiz Expo/Apple identities, native fingerprints,
  checks on pushes and native builds only through explicit manual dispatch.

The mobile test suite now has 43 passing tests, including notification behavior
for mocked iOS/Android modules and six OTA interaction tests. These are automated
regressions, not proof of delivery to a physical device. Backend `f4baa8e` was
deployed October 19 with database backups and the four mobile migrations. Both
public readiness endpoints and authenticated demo-account smoke checks passed.
The push worker was enabled after confirming there were no registered devices
or queued jobs. Mobile changes have been pushed to GitHub; the matching website
admin-review change remains a separate deployment concern.

### October 19 internal testing record

- Backend deployment: `f4baa8e586a99acfbfccb6a0881c31568118a177`; GitHub deployment run `39275379531` completed successfully. Public identity and booking readiness checks returned 200. Authenticated demo sign-in, security summary, deletion-request status and scoped inbox checks passed.
- iOS: version 1.0.0 (5), EAS build `a9d341cc-720c-4091-bd44-c1374ee571df`, submitted successfully (`5ce6cc3e-3e13-401b-8655-1ec842babb07`). Apple reports VALID / IN_BETA_TESTING for BookMiz app **6759222510**, bundle `com.anonymous.bookmiz`. Internal Team (Expo) only; no public App Store release.
- Android: version 1.0.0, versionCode 2, EAS build `61001833-c28a-420d-bc14-7cf9cd882bdc`. Signed APK saved to the user's Downloads as `BookMiz-Android-1.0.0-build2-test.apk`. SHA-256: `e7e04f768f9432af258d563bc5717f078486faf45770582948a25c38a3fc82de`. Android signature verification passed. The older local test APK used a different signing key, so an uninstall was needed on the fictional test installation.
- Latest preview OTA: commit `5a2d922`, iOS group `bb4c97ae-431b-40d9-8004-3f19b1d4722f`, Android group `7580dc88-5a72-4d27-b55d-a2bcc58448c3`. Production channel was not updated. Includes the permission-resume registration race fix and readable, retryable network/token errors.
- Automated verification: 43 mobile tests and TypeScript pass. Backend build/regressions pass; isolated PostgreSQL inbox, payout, quote and identity checks also pass.
- Installed Android verification so far: demo sign-in and Account screen work; unavailable-network update checks show a retry message; a successful initial check reports no update; the preview bundle downloads and exposes explicit Restart to update. The application recovered and retained sign-in after a slow reload, but the original emulator also had launcher ANRs. A fresh isolated BookMiz emulator subsequently completed the restart: the new update copy rendered, sign-in was retained, and a subsequent check reported the current version. Actual notification delivery remains pending.
- The emulator's HTTPS certificates are intercepted by Norton; server-side checks show a valid Let's Encrypt certificate. A user-approved, temporary, domain-restricted SSH relay preserves TLS validation for test traffic. No trust checks were disabled in the app. Google device-token acquisition returned SERVICE_NOT_AVAILABLE on both emulators; this is not a successful delivery test. The APK was checked directly: Firebase app ID, sender ID, project ID and client API key match the verified BookMiz configuration. Firebase Installations accepted a synthetic client registration (HTTP 200), and its cleanup also returned 200. iPhone notification/update testing and physical Android delivery verification require a tester to enable device notifications.

The active preview binaries use Android runtime `b458e56796edaa9a0aebce320d6c491163561b33` and iOS runtime `8c9848a7e198a913d8d8d10b79445326921c0f70`. The maintenance branch `codex/mobile-preview-20261019` preserves their matching configuration and current JS updates. Publish updates for these binaries from that branch and verify both fingerprints first. Main corrects the App Store submission target to 6759222510; EAS includes eas.json in its fingerprint, so main's next native baseline has a different fingerprint. Do not build or submit from the maintenance branch; use main for the next native baseline and store submission. Never override a runtime merely to force an update onto an incompatible binary.

Public release remains on hold until actual iOS and Android notification delivery and update restart checks are complete.

### Profile review follow-up, October 19

- Account profile layout now uses a constrained tablet width, compact contact rows, a heading-level secondary Edit profile action, and explicit device notification status. The name is displayed once; contact details remain selectable and the whole screen scrolls.
- Preview-only layout update: Android group `69569f9d-11f7-4cb9-98d3-e066bedb5a9d`, iOS group `46a6437a-6dcd-48d0-a672-ceedc28fe407`, source `e57ee1e` (main equivalent `0810582`). Both native fingerprints match the existing test binaries. No new native build was triggered.
- Physical Android tester successfully registered the demo customer's device. A scoped test notification was sent through the deployed worker; Expo/Firebase receipt status is `RECEIPT_OK` after one attempt. The tester confirmed seeing the Android alert (“You have a new update”). Tap navigation still requires confirmation.
- Installed Android downloaded and applied the profile update using Check for updates → Restart to update, retaining sign-in. Profile display, Edit profile and Cancel were exercised. Phone and tablet-width screenshots were inspected; the tablet content is constrained and phone labels remain readable.
- TypeScript and all 43 mobile tests pass.

### Profile photos and location selection, October 19

- Backend `1c61b226816b39f53369414098c370da397fdd88` deployed successfully through run `39288833594`. Profile photos use a persistent identity upload volume included in encrypted deployment backups; no database migration was needed.
- Profile supports Add/Change/Remove photo, using the existing system file picker. JPG, PNG and still WebP files up to 3 MB / 24 megapixels are decoded, cropped/resized to a maximum 512px square, re-encoded as JPEG without original metadata, and exposed only while selected by the profile. The Home avatar uses the same photo with initials as fallback.
- Free-text profile location fields are replaced by searchable Country → State/region → City selectors driven by `/marketplace/supported-geography`. Changing a parent clears its children and coordinates. An incomplete new location cannot be saved. Unchanged legacy locations are retained during unrelated edits. The catalogue currently exposes US/NG, seven regions and 27 cities; additional locations remain an administrator catalogue task.
- Preview-only OTA: source `7947d6f` (main equivalent `bf0166e`), Android group `f3aa7f9a-f7b1-4588-a796-6b862594ffc1`, iOS group `dae5a4e8-5173-4393-882c-57d46ed95a93`. Both match the existing native runtimes. No new native build or public release.
- Verification: 45 mobile tests and TypeScript pass. Backend build and 41 regressions pass (five database-dependent checks skip locally); deployment CI also passed. Live HTTPS fixture checks passed authentication, invalid-image rejection, upload/read, resizing, replacement, cross-account isolation, removal and location saving. Fixtures were cleaned afterward.
- Installed Android emulator downloaded/restarted into the update and exercised the real system file picker, upload/display in Account and Home, and removal back to initials. Linked selectors changed US/Illinois/Chicago to Nigeria/Lagos/Ikeja, filtered the city search and saved the correct backend codes and coordinates. A dedicated temporary identity was removed afterward. iPhone interaction testing remains pending.

### Chat, notifications, requests and compact actions, October 19

- Backend `39b2684dcc430000ad04a50c0c4c852e1a1985c1` deployed successfully in run `39292517617`. Read requests now have a separate rate-limit bucket from authentication/sensitive writes and chat sends, so refreshing a conversation cannot exhaust the send allowance. Native HTTP rate-limit errors retain their 429 status and Retry-After. Backend regressions: 43 passed locally, five database-dependent checks skipped locally; deployment CI passed.
- Chat uses a dedicated keyboard-safe modal with provider/request headings, virtualized history, date separators, timestamps, sent indicators and a composer outside the history. Drafts stay separate per conversation, survive incoming messages and preserve text typed during sending. Refresh failures have a retryable notice and respect server backoff. Sent indicators do not claim read receipts or presence.
- Notification details have a readable full body, category/date, back control and clear action. Supported BookMiz destinations open the matching native request/booking/account screen; untrusted destinations are rejected. Only supported HTTPS BookMiz website fallbacks are allowed.
- Home quick actions retain Book/Get quote/Bookings/Saved but use a compact 108dp minimum height instead of 132dp, smaller padding and responsive two/four-column layouts. Long or enlarged text can expand them.
- Quote Accept is shown only for unlocked matches on an active, unselected request. Accepted/cancelled/expired requests and available/declined/expired matches cannot expose it. Concurrent taps are guarded, competing actions disappear immediately after successful selection, and a stale-device rejection refreshes the request.
- The request wizard now uses a full-height, top-aligned keyboard-aware layout. Bottom-aligning its keyboard-avoiding container caused its measured position to shift repeatedly as Android opened the keyboard; removing that alignment keeps the form and footer visible.
- Mobile TypeScript and all 47 tests passed. A dedicated fictional customer and hidden provider exercised the real Android app at phone size and 600dp tablet width. Chat sending, incoming-message polling while typing, draft preservation, visible keyboard/composer, notification details and native request action passed. Native quote selection changed to Booked and removed Accept immediately. Request fields and Continue stayed above the keyboard at both sizes; Continue advanced to Location while the keyboard was open. No booking or payment was created. All temporary fixture identities, provider, request, conversations and associated records were removed after verifying ownership and absence of financial records. The scoped test relay was stopped and emulator settings restored.
- Latest cumulative preview OTA: source `7a428e2` (main equivalent `722dba4`), Android group `447cfcc0-7fe3-43bd-b54a-97bd76c8de0f`, iOS group `bd7586b5-ea55-4a2b-ad3c-5bf9767f4e33`. Both runtime fingerprints match the existing test binaries. Installed Android downloaded/restarted into this update and retained sign-in. No new native build or public release was started. Physical iPhone keyboard, notification and update checks remain pending.
