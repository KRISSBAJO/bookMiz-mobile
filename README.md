# BookMiz mobile

Expo customer and agent app connected to the BookMiz identity and booking APIs.

Install with `npm ci`, run `npm run typecheck`, and start with `npm start`.
The default API addresses point to the deployed BookMiz services. Database and
Stripe secret keys belong only on the backend and must never be added here.

The Android test-build workflow produces an installable APK for internal testing
using the generated development signing key. It is not an App Store or Play Store
release. Store publishing requires the owner's signing and developer accounts.

Payment opens hosted Checkout. Use the BookMiz sandbox and official Stripe test
cards while the backend remains in test mode. Appointment details show paid,
unpaid, refund-pending and refunded states from the backend.
