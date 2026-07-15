# Crisp Hospital Logo Design

**Date:** 2026-07-15

## Goal

Make the blue-and-pink Chonburi Hospital logo render sharply and consistently everywhere it appears in the web interface, without changing the circular Medical Technology logo, surrounding text, or overall visual identity.

## Current Problem

The hospital logo source file is a 1536 × 1024 PNG with a 3:2 aspect ratio. Current web usages force it into a square box and request a square optimized derivative from `next/image`. At small display sizes, this reduces the effective detail available to the logo and makes its fine lettering appear soft compared with the adjacent Medical Technology logo.

The web interface currently displays the hospital logo through:

- `components/lab/Logo.tsx`, used by the public header and footer
- `app/login/page.tsx`, which renders the hospital logo directly

The PDF cover uses a separate hospital seal asset and is outside this change because it is not the blue-and-pink logo shown in the reported screenshot.

## Design

Create one reusable hospital-logo component that owns the asset path, intrinsic 3:2 aspect ratio, accessibility text, and rendering-quality settings. The component will accept a display height and derive the corresponding width, so the image is never stretched or cropped into a square.

The component will render the existing high-resolution source without Next.js image recompression. It will use `object-fit: contain`, preserve its intrinsic ratio, and remain non-shrinking inside the existing logo rows.

Replace both direct web usages with this shared component:

- The shared `Logo` row used by the public header and footer
- The logo row on the login page

The Medical Technology logo retains its current size and rendering behavior. Text, navigation spacing, color, and interaction behavior remain unchanged except for the hospital logo receiving its natural width.

## Responsive Behavior

The hospital logo height follows the same responsive size as the adjacent Medical Technology logo. Its width remains 1.5 times its height. Existing mobile rules that resize logo images must be adjusted so they do not force the hospital logo back to a square.

If horizontal room is constrained, the existing text truncation and navigation controls continue to handle overflow; the hospital logo itself must not be distorted.

## Verification

Add a focused static regression test that verifies:

- The reusable hospital-logo component preserves the 3:2 dimensions
- It bypasses image recompression and uses contained fitting
- The shared `Logo` component and login page both use it
- No remaining web UI code directly renders `/images/logo-chonburi.png`

Run the focused test, the existing test suite relevant to layout/static checks, and a production build. Visually inspect the public header, public footer, and login page at desktop and mobile widths to confirm sharpness, alignment, and absence of clipping.

## Non-goals

- Redrawing or altering the hospital logo artwork
- Replacing the logo with an unverified SVG
- Changing the Medical Technology logo
- Changing the separate hospital seal used in generated PDF covers
- Redesigning header, footer, or login layouts
