# Merchant scheduling redesign

Booksy references supplied by the user on October 21, 2026 informed the structure: calendar first, compact date navigation, flatter rows and focused editing. BookMiz retains its own branding, illustration and existing functionality. Booksy assets and promotional claims are not copied.

## Today daily briefing (October 21 follow-up)

User device feedback showed that sharing the schedule component made Today and Calendar indistinguishable. Today now has its own implementation: business-local greeting/date, a next-client spotlight, upcoming/completed/pending counts, attention tasks, an open/all compact agenda, and a New appointment action for managers. There is no week navigation, date browsing, team filter or hourly grid on Today. Calendar retains these planning controls.

The next appointment excludes terminal and overdue visits. Pending appointments remain labelled pending; a scheduled time does not imply the client checked in. Past-time active appointments remain visible as tasks. Counts are appointment counts, never mixed-currency revenue totals. Saved zero and mixed-currency booking amounts remain intact. Failed schedule or request reads do not masquerade as a successful empty day. Attention uses a tablet side column and flows before the agenda on phones. The existing illustration appears in the empty spotlight.

Calendar separator/ellipsis/arrow strings had been incorrectly encoded; the UTF-8 source is repaired and rendering coverage rejects the reported mojibake. Today creation and details reuse the existing reviewed, permission-checked editors.

Source `030ea65`, compatible preview source `2f2062b`. Tests cover distinct navigation/structure, original currency, pending/overdue tasks, open/all agenda, detail dismissal, and read-only/error states. Physical-device visual acceptance remains pending; no native build or public release is introduced.

## Calendar and Business implementation

Calendar provides a white native scheduling workspace with a seven-day date strip, week navigation, date selection, team/unassigned filters, search and status filters. Pastel appointment blocks sit at their business-local times, with collision columns and a current-time marker. Agenda is available explicitly and is selected automatically for large text, crowded narrow screens and repeated daylight-saving hours. Exact timezone-labelled start/end times are shown in appointment details. The visual calendar does not claim that blank time is bookable: the existing booking editor checks actual backend availability.

Creation carries the selected date and team member into the existing reviewed booking flow. Original saved booking prices/currencies, including a stored zero, remain unchanged. Appointment mutations keep existing permission checks and confirmations. Scoped deep links open the appropriate details and are consumed on dismissal; rescheduling remains mounted until its editor closes.

Business uses an identity header, flatter service/hours/team sections and a compact service menu. Service actions open in a focused detail editor; staff cannot edit or access owner money tools. The existing payment/refund/payout workspace remains available to its authorized roles. Checkout, marketing, referrals and a broader onboarding redesign are not introduced by this visual change.

The selected business name comes from its current provider profile. Single-business accounts do not display a redundant selector with an older organization name. Auxiliary team/setup loading failures do not suppress separately loaded appointments. Loading, failed and empty states remain distinct.

## Illustration

Generated using the built-in image generation tool in stylized-concept mode. Final asset: `assets/bookmiz/merchant-day-illustration.png`. Transparent and decorative, used in the calendar empty state. Existing fonts and native dependencies are unchanged.

Final prompt:


> Use case: stylized-concept. Create a polished editorial illustration asset for BookMiz mobile merchant daily dashboard. A small sculptural navy appointment desk calendar with blank paper tiles, one vivid lime check mark, an elegant curved navy arch and a small potted leaf plant. Sophisticated soft 3D clay / paper-cut illustration, matte surfaces, gentle ambient occlusion, restrained navy #132849, lime #8ee30f, off-white and muted sage palette. Isolated composition, genuinely transparent background, no background rectangle, no text, no letters, no numbers, no logos, no UI mockup. Compact balanced three-quarter view, all objects fully in frame, generous transparent margin. Designed to remain legible as a decorative 110px illustration on a navy dashboard panel; light calendar pages provide contrast. Professional calm service-business planning, avoid cartoon faces and excessive detail.

## Validation and deployment

Type checking and all 76 mobile tests pass. Coverage includes overlap separation, business-local dates, overnight clipping, repeated clock hours, original zero/mixed currencies, selected date/staff creation, details dismissal, staff permissions and independent auxiliary failures. Both native release exports succeed and point to deployed HTTPS BookMiz APIs. No backend migration or native dependency change is required.

Source commits: `2cb6243`, `5575cd8`, `fd0ce38`; preview checkout equivalent: `bce2fc1`. Preview publication and verification are recorded below. Public release remains pending device acceptance.

Published to the existing `preview` branch/channel on October 21, 2026. No native build or public store release was triggered.

- ios: update `01a15e59-3ccc-764c-8b3f-be9c142d7ffa`, group `dbac4fe8-9b37-4240-a541-0f866181e0cb`, runtime `8c9848a7e198a913d8d8d10b79445326921c0f70`.
- android: update `01a15e59-3ccc-7749-93c9-081626112e4d`, group `64382b15-e166-474f-9296-0b39fbe4828f`, runtime `b458e56796edaa9a0aebce320d6c491163561b33`.

Runtime-specific manifest requests selected the expected releases. Both Hermes bundles and the illustration were downloaded with Expo-provided asset authorization headers and their SHA-256 hashes verified. No runtime override was used. Delivery evidence: `E:/BookMiz-merchant-testing/merchant-schedule-delivery-verification.json`.

The earlier card-based homepage was viewed on the Android emulator, but that screenshot does not validate this replacement calendar design. Starting the emulator/Appium for this version was rejected by automatic approval review with only “blocked by policy”; it was not retried. Native visual acceptance, tablet layout and physical iOS testing remain outstanding. Use Account → Check for updates, apply/restart and open the business workspace. This preview is not a claim of production readiness for the whole application.

## Distinct Today preview delivery

Published to the existing preview channel on October 21, 2026:

- ios: update `01a15e69-6d9e-7fdf-aa1c-5abba895af10`, group `b8b6aebb-7f1b-461c-b201-bd6423a86500`, unchanged runtime `8c9848a7e198a913d8d8d10b79445326921c0f70`.
- android: update `01a15e69-6d9e-7a74-9fb0-054f70e3a7bc`, group `2932400f-afdd-45a2-95fb-7e2d8a05b480`, unchanged runtime `b458e56796edaa9a0aebce320d6c491163561b33`.

Runtime manifests, both bundles and the decorative artwork were downloaded and their SHA-256 hashes verified. Evidence: `E:/BookMiz-merchant-testing/today-briefing-delivery-verification.json`. All 76 tests and type checking passed before publication. No native build or public release was triggered. Native visual acceptance remains pending; the previously blocked emulator startup was not retried.
