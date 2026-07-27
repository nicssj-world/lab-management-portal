# Equipment Map Visual Symbols

## Goal

Make an equipment pin readable by type at map scale while retaining the existing, separate visual language for PM/CAL and survey status.

## Approved direction

Use the selected **B: silhouette + short code** direction. The map recognizes a pin's `classification` first, then uses the equipment name only when classification is missing or unrecognized.

## Symbol rules

| Classification | Shape | Code |
| --- | --- | --- |
| Refrigerator | Tall refrigerator silhouette | FR |
| Centrifuge | Rounded square with an internal rotor | CF |
| Microscope | Microscope silhouette | MS |
| BSC | Wide cabinet with grille lines | BSC |
| Other known classifications | Rounded rectangular marker | Standard short code |
| Missing or unknown classification | Rounded rectangular marker | EQ |

The standard short-code mapping includes AutoClave (AC), Water Bath (WB), HeatingBlock (HB), Incubator (IC), Electronic Balance (BL), Digital Thermometer (TH), Volumetric Pipette (VP), Auto Pipette (AP), Calibration Weight (WT), Analyzer (AN), Rotator (RT), Vortex mixer (VX), Timer (TM), and UPS (UP).

## Status and accessibility

Equipment type uses a stable, high-contrast teal/navy shape. It must not be inferred from colour. Existing PM/CAL and survey signals remain independent:

- existing status glyphs remain visible as a small overlay badge;
- survey completion remains the existing ring treatment;
- due/overdue state remains independently exposed by `data-due` and a visible glyph;
- each pin's accessible label includes the equipment name, classification, and status.

## Data and rendering

`EquipmentPinDTO` gains the equipment classification. The server map builder supplies it from the equipment record. `EquipmentMapCanvas` maps normalized classifications to an icon definition, with a name-based fallback for legacy records and an `EQ` fallback otherwise.

The canvas will render SVG paths/rectangles only; it will not load external images or use emoji. A compact legend below the map identifies the four primary silhouettes and explains that colour/rings encode operational state rather than equipment type.

## Interactions and scope

Selecting, keyboard activation, map panning, zooming, filtering, surveying, moving, and direct reassignment are unchanged. Pin bounds remain generous enough to preserve the current interaction target. No equipment database values are modified by this feature.

## Verification

- domain test covers classification-to-icon mapping and fallback behavior;
- UI contract test asserts the four primary symbols, text fallback, independent status overlays, and legend;
- TypeScript and existing equipment-map test suite remain green.
