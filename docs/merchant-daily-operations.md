# Merchant daily operations

Status: implementation and automated checks complete; native visual acceptance is pending. No OTA, cloud build, store submission or public release has been started for this feature.

## Workspace

The `/business` tab group provides Today, Calendar, Requests, Messages and Business. Signed-in business members can open it from Account; new merchant sign-ins open it automatically. Switching back to the customer workspace does not change the account's backend permissions. A business switch remounts the workspace so old requests, open forms and cached records cannot cross into another business.

Businesses come from the authenticated organization's memberships. Owners, providers and staff managers can change operations. Staff have read-only access in this stage. Customer identities cannot gain merchant access through the switcher. Platform administration remains on the website.

## Implemented

- Today: appointments in the business timezone, operational counts, business selection, new appointments and notification access.
- Calendar: seven-day navigation, customer/service search, status and staff filters, booking detail, confirmation, check-in, completion, no-show, rescheduling and cancellation confirmation. Terminal appointments expose no status actions.
- Appointments: live service/customer/team/location selection, native date controls, available slots from the backend, review before saving and expected price/currency checks. Existing bookings retain their original amount and currency when rescheduled.
- Services: creation, categories, photos through the existing Cloudinary upload configuration or an HTTPS image URL, prices and explicit currencies, duration, buffers, booking instructions, channel selection, approval and active state. Unchanged gallery images are preserved. Archive makes a service inactive and retains booking history.
- Availability: weekly hours, date overrides, breaks and staff time off. Business timezone conversion validates daylight-saving gaps. Removing availability leaves existing appointments intact. A scoped existing rule retains its scope; create a new rule to use a different scope.
- Requests: details, separate request/service currencies, status filters, existing credit unlocking, decline confirmation and proposal composition in chat. Customer selection remains the final acceptance action.
- Messaging: shared native chat component with provider-side message alignment, keyboard avoidance, saved drafts scoped to user/business/match, foreground polling, rate-limit backoff and protection against stale refreshes replacing a sent message.
- Notifications: existing inbox/read behavior and native destinations for business bookings, requests and settings. Existing push registration is reused; no new native dependency is introduced.

Quote proposals in this stage are chat messages, not a new binding-price or payment record. They never silently overwrite a service price or trigger a charge. Card-based lead unlocking and payment-account administration use the existing website until the money-management stage.

## Backend changes required alongside the mobile feature

- Workspace writes verify the managing role in the selected organization, not a global managing role from a different organization.
- Staff cannot mutate services, availability or appointments.
- Merchant booking creation accepts and validates the reviewed service amount and currency.
- Availability creation/editing rejects invalid clock times and reversed windows; midnight closing (`24:00`) is supported.

Do not publish the mobile feature against an older backend that rejects the new expected-price fields.

## Validation

- Mobile typecheck passed.
- 61 mobile tests passed, no skips. Added exact-price/currency, duplicate-save, staff, timezone/DST, terminal-state, booking-slot and business-session tests.
- Backend build passed; 78 backend tests passed, no skips, using isolated PostgreSQL databases on port 56783.
- The database workflow covers service creation, hours, stale-price rejection, booking creation, overlapping-slot rejection, rescheduling, check-in/completion, cancellation, staff time off, provider/customer messages, unrelated-organization denial and archive/history preservation.
- Expo web export successfully generated all merchant routes during development. Later source changes passed typecheck and tests; final native acceptance is still required.

## Local acceptance environment

Development dependencies were copied to `E:/BookMiz-merchant-testing/app` because the C drive ran out of space. The official Expo Go SDK 57 APK is in `E:/BookMiz-merchant-testing/Expo-Go-57.0.9.apk`; its SHA256 was verified against the official Expo release metadata.

Android testing uses the existing `BookMiz_Test_API_35` emulator only. Startup is currently blocked by Windows commit-memory exhaustion. The failed attempt did not install or release the merchant app.

The preview at `http://localhost:8090/business` uses an isolated booking API on port 3112 and an isolated identity API on port 3111. Both bind to loopback only. Their PostgreSQL databases use port 56783; payment gateways, background jobs, push delivery and outbox publishing are disabled. SMTP points to a closed loopback port. Fictional local owner/customer identities use the existing demo login names; their sessions and writes stay in the local databases. Authenticated HTTP checks successfully loaded bootstrap, services, settings and requests. The earlier production identity relay was stopped and replaced with this fully local identity service. Preview configuration is temporary and must not be committed or deployed.

Before release: complete actual phone/tablet and keyboard checks; verify business switching and notification navigation on-device; review screenshots; deploy the matching backend; then publish a compatible preview update for acceptance testing. A public release is a separate step.
