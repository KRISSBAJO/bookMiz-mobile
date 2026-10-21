# Merchant money preview

Status: the matching backend and Android/iOS preview OTA are deployed. Mobile typecheck and all 66 mobile tests pass. Installed-device acceptance remains pending; see `releases/2026-10-20-merchant-preview.md`. No new store binary or public release has been created for this phase.

Owners/providers open Business → Money. Staff/managers cannot load it directly. The five primary navigation tabs stay unchanged.

- Overview: online-payment preferences, explicit Stripe test/live status, Stripe withdrawable funds, NGN wallet available/pending/requested amounts, and booking values grouped by their original currency and payment status.
- Payments & refunds: paginated booking payment records, gateway mode, original amount/currency, verified Stripe refunded amount, individual Paystack transaction/refund progress and a link to the appointment. A cancelled paid booking stays visibly unrefunded until processor reconciliation confirms the refund.
- Payouts: Stripe payout history, Paystack requests and their recorded mode, cancellation of requests awaiting review, masked bank destinations and default selection.
- Bank setup: search Nigerian banks, resolve the 10-digit account to its holder, review verified details and save through the existing encrypted backend. Editing a bank/number clears verification. The form never saves a bank-number draft. Stripe setup opens its hosted HTTPS onboarding page.
- Payout review: exact minor units, explicit settlement currency, destination, minimum/available-balance checks and confirmation. Before sending, the app persists a reference scoped to user/business/rail. Lost responses and app restarts restore that same request. A confirmed validation failure allows editing again; an uncertain response keeps the reference for checking.
- Payment notifications targeting provider payment settings open native Money. Other provider settings keep their existing destination.

The backend protects against repeated reservations, concurrent withdrawals and cross-organization roles. Pending, requested, approved and paid are separate states. Test-mode history in the legacy Paystack wallet blocks live withdrawals until audited reconciliation; switching a key cannot make sandbox funds real.

## Acceptance and rollout

Record final backend/mobile suite results, actual phone/tablet screenshots, keyboard checks and gateway-backed preview checks here before describing the phase as signed off. The local review uses fictional accounts, an isolated PostgreSQL database and a development-only fictional bank adapter; no real bank/payment data belongs there.

The backend build and 90 automated tests passed, including real PostgreSQL payout concurrency/reservation/cancellation tests and isolated gateway adapters. Mobile component tests cover payout retry persistence across app restarts, duplicate taps, money access, exact currencies, preferences and bank verification invalidation. Device acceptance remains separate. Windows memory/disk pressure was reduced by preserving test caches, dependencies and the BookMiz AVD on E:. Android now boots with its original 2 GB RAM and Appium connects. Automatic approval review rejected starting the local Expo server, even offline, without a detailed reason; do not report the new screens as tested in a local native preview.

The existing TestFlight/APK runtime must be matched before publishing an OTA. Deploy the matching backend and additive migration first. Public release remains separate from the user-requested preview deployment.

Quote proposals continue through chat. Binding quote checkout, discretionary partial refunds and automated Paystack transfers are outside the implemented money routes and remain follow-up work; do not describe them as available.
