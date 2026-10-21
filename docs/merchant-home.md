# Merchant scheduling redesign

Booksy references supplied by the user on October 21, 2026 informed the structure: calendar first, compact date navigation, flatter rows and focused editing. BookMiz retains its own branding, illustration and existing functionality. Booksy assets and promotional claims are not copied.

## Today daily briefing (October 21 follow-up)

User device feedback showed that sharing the schedule component made Today and Calendar indistinguishable. Today now has its own implementation: business-local greeting/date, a next-client spotlight, upcoming/completed/pending counts, attention tasks, an open/all compact agenda, and a New appointment action for managers. There is no week navigation, date browsing, team filter or hourly grid on Today. Calendar retains these planning controls.

The next appointment excludes terminal and overdue visits. Pending appointments remain labelled pending; a scheduled time does not imply the client checked in. Past-time active appointments remain visible as tasks. Counts are appointment counts, never mixed-currency revenue totals. Saved zero and mixed-currency booking amounts remain intact. Failed schedule or request reads do not masquerade as a successful empty day. Attention uses a tablet side column and flows before the agenda on phones. The existing illustration appears in the empty spotlight.

Calendar separator/ellipsis/arrow strings had been incorrectly encoded; the UTF-8 source is repaired and rendering coverage rejects the reported mojibake. Today creation and details reuse the existing reviewed, permission-checked editors.

Source `030ea65`, compatible preview source `2f2062b`. Tests cover distinct navigation/structure, original currency, pending/overdue tasks, open/all agenda, detail dismissal, and read-only/error states. Physical-device visual acceptance remains pending; no native build or public release is introduced.

## Business cover follow-up

User device feedback requested business imagery instead of the large navy next-client card. Today now leads with the published business cover, falling back to the saved booking-page banner, then a bundled neutral default. Either public-profile or authenticated-settings failure is tolerated independently. Failed remote image downloads switch to the bundled image; a changed cover URL can load normally. Unpublished businesses can use their saved booking banner. Only HTTPS or application-relative image URLs are accepted.

The appointment spotlight is replaced by a compact time/client/service row. On phones, management shortcuts follow the agenda rather than pushing it below the fold. Booking status, stored amount/currency, permissions and reviewed editing remain unchanged. Calendar remains the scheduling grid.

Source `3ac8512`, compatible preview source `18dc72e`. All 78 mobile tests and type checking pass, including cover priority, unpublished/offline businesses, unsafe URL rejection, image-error fallback and a changed image URL. Native visual acceptance remains pending.

### Default cover asset

Saved project asset: `assets/bookmiz/default-business-cover.png`. Generated with the built-in image generation tool in `stylized-concept` mode; original generation retained in the Codex generated-images directory. The image is a neutral abstract architectural composition rather than a depiction of a real business. It is decorative, with the business name rendered separately on a solid background for readable contrast.

Final prompt:

> Use case: stylized-concept. Asset type: default wide business cover image for the BookMiz merchant mobile homepage. Create a premium architectural still life, warm ivory plaster arches and softly curved sculptural surfaces, one deep navy element and a muted sage botanical leaf, subtle lime accent. Abstract and welcoming, refined editorial 3D photography, tactile matte materials, soft natural side light, generous negative space, landscape panoramic composition approximately 3:1, beautiful full bleed crop. This is a neutral default cover across many service businesses, not an image of any real business. No people, no scissors, no nail polish, no industry-specific equipment, no calendar or phone UI, no text, no logos, no borders, no watermark. Opaque background.

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

## Business cover preview delivery

Published October 21, 2026 to the existing preview channel:

- ios: update `01a15e92-f39d-7418-9290-85149a992244`, group `d9aa22d6-0dfd-48f5-a72a-1bfe2f5a3a5a`, unchanged installed runtime `8c9848a7e198a913d8d8d10b79445326921c0f70`.
- android: update `01a15e92-f39d-7f58-b413-4da3bc179dbc`, group `3bec1490-da38-4924-8a4f-146bba03ac2a`, unchanged installed runtime `b458e56796edaa9a0aebce320d6c491163561b33`.

Both runtime-specific manifests, Hermes bundles and the new default cover asset were downloaded and verified by SHA-256. Evidence: `E:/BookMiz-merchant-testing/today-cover-delivery-verification.json`. All 78 tests and type checking passed. This is an OTA preview update; no native build, backend change or public release was triggered. Physical-device visual acceptance remains pending.

## Requests and Messages separation

User requested distinct layouts for these two tabs. Requests is now a service-brief queue with New/In conversation/Accepted counts, queue filters, customer details, original-currency budget and preferred date. Pressing a brief opens the existing reviewed unlock/quote/decline flow; viewing a request does not charge or accept it.

Messages has its own screen and flat conversation rows: customer initials, name, service context, latest message, provider “You:” prefix and activity time, with All/Open/Closed filters. Threads are ordered by latest recorded message activity. No unread counters or presence indicators are invented. Managers open chat directly; staff retain preview/linked-request access and cannot gain reply permissions. Closed history remains accessible. Request and conversation deep links remain scoped to the selected business; chat links are consumed on dismissal. Alerts can return to Messages.

Source `495409c`, preview equivalent `441b0e0`. Type checking and all 83 mobile tests pass. Both platform exports succeed and use deployed HTTPS BookMiz APIs. Native visual review remains pending. Preview publication and delivery verification are recorded below.

Existing mobile availability is under Business → Availability, with working hours, breaks and time off scoped to staff/location where applicable. Full team/location management, business profile/cover editing and advanced settings remain future mobile work; this UI separation does not claim to implement them.

## Requests / Messages preview delivery

Published October 21, 2026 after Windows connectivity was restored. Final source includes `bda3b6c` (preview equivalent `b48ca42`) so empty closed/read-only threads do not invite users to start replying.

- ios: update `01a15ea7-b664-77c2-8c04-7ab5289bddbb`, group `fe1b723d-175a-44fb-b6cd-5904055692e1`, unchanged installed runtime `8c9848a7e198a913d8d8d10b79445326921c0f70`.
- android: update `01a15ea7-b664-7074-bcce-0c652d6f2230`, group `d7357516-674f-4b88-a315-5d67dd12eb55`, unchanged installed runtime `b458e56796edaa9a0aebce320d6c491163561b33`.

Both runtime-specific manifests, bundles and the existing default cover were downloaded and their SHA-256 hashes verified. Evidence: `E:/BookMiz-merchant-testing/request-messages-delivery-verification.json`. Type checking and all 83 tests pass. No backend change, native build or public store release was triggered. Physical-device visual acceptance remains pending.
