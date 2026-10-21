# Merchant homepage refresh

The Today screen uses the existing merchant APIs and original booking amount/currency snapshots. No backend migration or native dependency is introduced.

The page has a compact illustrated day summary, permission-aware booking/availability/service/money shortcuts, a chronological appointment timeline, live attention items and a responsive tablet side column. Overdue active bookings remain in Remaining but cannot be presented as the next appointment. Completed/cancelled/no-show visits are not upcoming. Empty, loading, stale and failed states are distinct. Business-day filtering uses the selected business timezone and updates the clock while focused.

The selected business name comes from its current provider profile. Single-business accounts no longer show a redundant selector using the older organization name. Booking rows label the saved booking total and payment status explicitly, including a genuine stored zero. They never infer a new price from the current service menu.

Shortcuts into an already mounted Business tab synchronize the selected section. Add service opens the existing guarded editor. Appointment deep links clear stale calendar filters and open the selected booking on focus. Mutations retain their existing review/confirmation steps.

## Illustration

Generated using the built-in image generation tool. Final asset: `assets/bookmiz/merchant-day-illustration.png`. Transparent, decorative and excluded from screen-reader output; hidden on very narrow screens or with large font scaling. Existing fonts and brand assets are unchanged.

Final prompt:

> Use case: stylized-concept. Create a polished editorial illustration asset for BookMiz mobile merchant daily dashboard. A small sculptural navy appointment desk calendar with blank paper tiles, one vivid lime check mark, an elegant curved navy arch and a small potted leaf plant. Sophisticated soft 3D clay / paper-cut illustration, matte surfaces, gentle ambient occlusion, restrained navy #132849, lime #8ee30f, off-white and muted sage palette. Isolated composition, genuinely transparent background, no background rectangle, no text, no letters, no numbers, no logos, no UI mockup. Compact balanced three-quarter view, all objects fully in frame, generous transparent margin. Designed to remain legible as a decorative 110px illustration on a navy dashboard panel; light calendar pages provide contrast. Professional calm service-business planning, avoid cartoon faces and excessive detail.

## Validation

Record typecheck, tests, both native release exports, runtime fingerprints and preview update IDs below after release. Component tests cover historical zero/mixed currencies, today filtering, overdue/terminal visits, navigation, read-only access and request failure states. Component rendering is not a physical-device screenshot or public-release sign-off.
