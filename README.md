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
APNs setup and native end-to-end delivery testing remain release prerequisites.

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
