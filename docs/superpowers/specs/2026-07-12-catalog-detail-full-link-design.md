# Catalog detail modal: relocate full-page action

## Goal

Reduce crowding in the modal's top-right header controls while keeping the full-page action discoverable and touch-friendly on mobile.

## Design

- Keep the close button in the modal header's top-right corner.
- Move the `เปิดหน้าเต็ม` link from the header action cluster into a title row beside the test title, matching the red-marked area in the provided screenshot.
- Keep the existing link label, destination, accessible name, visual treatment, and minimum 44px touch height.
- On narrow screens, allow the title and link to wrap naturally without horizontal overflow.
- Preserve the existing modal behavior, navigation destination, and close behavior.

## Scope

Only `components/tests/CatalogDetailModal.tsx` markup and its colocated styles are changed. No data, routing, or API behavior changes are required.

## Validation

- TypeScript/build validation for the Next.js app.
- Manual responsive review at mobile and desktop widths to verify the title row, link, and close button remain usable and visually separated.
