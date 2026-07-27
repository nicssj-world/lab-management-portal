# Equipment Map Visual Symbols Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Show immediately recognisable, classification-driven equipment symbols on the laboratory map while retaining the existing independent PM/CAL and survey status cues.

**Architecture:** Add a pure classification-to-symbol resolver. Include the existing `classification` field in the pin DTO, then have the SVG map render the resolver's shape and a compact legend. The operational status glyph/ring remains separate from the equipment type.

**Tech Stack:** Next.js 16, React, TypeScript, inline SVG/CSS, existing TSX source-contract tests.

## Constraints

- Use the persisted equipment `classification` as the primary source; only use a normalised equipment name as a fallback.
- Do not alter room geometry, door geometry, marker positions, status meanings, filters, or PM/CAL behaviour.
- Keep every marker keyboard-accessible and preserve its current click behaviour.
- Do not use emoji or colour alone to convey equipment type.
- Preserve the current status glyphs (`✓`, `!`, `?`, `✕`, `◐`) as a separate overlay.

## Task 1: Add the pure symbol resolver

**Files:** Create `lib/equipment-map/pin-symbol.ts`, create `lib/equipment-map/pin-symbol.test.ts`.

1. Write failing resolver tests for classifications `07`, `02`, `12`, and `11`, expecting `refrigerator`, `centrifuge`, `microscope`, and `bsc`; also test name fallback only when classification is absent, and unknown => `code` / `EQ`.
2. Run `npx tsx lib/equipment-map/pin-symbol.test.ts` and confirm it fails because the resolver does not exist.
3. Implement exported `EquipmentPinSymbolKind`, `EquipmentPinSymbol`, and `getEquipmentPinSymbol(classification, name)`.
4. Map refrigerator/centrifuge/microscope/BSC to `FR`/`CF`/`MS`/`BSC` with Thai labels. Map other known classifications to short codes: `01 AC`, `03 WB`, `04 HB`, `05 IC`, `06 BL`, `08 TH`, `09 VP`, `10 AP`, `13 WT`, `14/15 AN`, `16 RT`, `17 VX`, `18 TM`, `19 UP`; unknown uses `EQ`.
5. Re-run the test; commit `feat: add equipment map pin symbol resolver`.

## Task 2: Include classification in map-pin data

**Files:** Modify `lib/equipment-map/types.ts`, `lib/equipment-map/server-builder.ts`, `scripts/equipment-map-server-builder.test.ts`.

1. Add a failing server-builder assertion that an assigned pin retains the source classification; run `npx tsx scripts/equipment-map-server-builder.test.ts`.
2. Add `classification: string | null` to `EquipmentPinDTO` and set it from `row.classification` during assigned-pin construction.
3. Re-run the test; commit `feat: expose equipment classification on map pins`.

## Task 3: Render classification-based SVG markers

**Files:** Modify `components/equipment-map/EquipmentMapCanvas.tsx`, `components/equipment-map/EquipmentMapStyles.tsx`, `scripts/equipment-map-ui.test.ts`.

1. Add failing UI source assertions requiring `getEquipmentPinSymbol(pin.classification, pin.name)`, a dedicated pin-shape renderer, and separate status overlay rendering. Run `npx tsx scripts/equipment-map-ui.test.ts`.
2. Replace the fixed circle body with `PinShape` rendering:
   - refrigerator: tall rounded cabinet labelled `FR`;
   - centrifuge: rounded square with small internal rotor circle, labelled `CF`;
   - microscope: compact SVG microscope silhouette, labelled `MS`;
   - BSC: wide rounded cabinet with three grille lines and `BSC`;
   - other: small rounded rectangle with its short code.
3. Keep the pin group focusable/clickable, preserve `data-due` and `data-surveyed`, and include the type label in the existing accessible label.
4. Render the current status glyph in a small fixed badge, independent of the symbol body. Preserve the current glyphs/meaning.
5. Add CSS for a navy shape with white text, status outline, focus visibility, and zoom-safe sizing; do not change room colours/boundaries.
6. Re-run test; commit `feat: render equipment-specific map symbols`.

## Task 4: Add the compact symbol legend

**Files:** Modify `components/equipment-map/EquipmentMapClient.tsx`, `components/equipment-map/EquipmentMapStyles.tsx`, `scripts/equipment-map-ui.test.ts`.

1. Add a failing source assertion for `equipment-map-symbol-legend` and labels `ตู้เย็น`, `เครื่องปั่นเหวี่ยง`, `กล้องจุลทรรศน์`, `ตู้ชีวนิรภัย`; run UI test.
2. Add a responsive legend below the status legend with matching swatches and `รหัสย่อ = อุปกรณ์อื่น`.
3. Ensure it wraps on narrow screens and does not obscure map controls or the panel.
4. Re-run test; commit `feat: add equipment symbol legend to map`.

## Final verification

Run:

```powershell
npx tsx lib/equipment-map/pin-symbol.test.ts
npx tsx scripts/equipment-map-ui.test.ts
npx tsx scripts/equipment-map-server-builder.test.ts
npx tsx scripts/equipment-map-domain.test.ts
npx tsx scripts/equipment-map-pagination.test.ts
npx tsx scripts/equipment-map-placement-pagination.test.ts
npx tsc --noEmit
git diff --check
```

Visually verify refrigerator, centrifuge, microscope, BSC, and an unknown item. Their shape must remain distinct with identical status overlays, and status must still change independently.
