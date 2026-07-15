# Test Detail Card Layout Design

## Goal

Make the four summary fields in `TestDetailCard` readable at every supported width, without truncating specimen or service-time text, while making the short numeric values easier to scan.

## Context

The current summary area lays out all fields with a wrapping flex row. Each tile has a fixed minimum width, but its text container cannot shrink safely. In the catalog detail modal the left column can be narrow enough that a long specimen name or service-time value overflows or is visibly cut off.

## Layout decision

Use a responsive CSS Grid for the summary fields.

- At wide widths, show four tiles in a single row. Give the specimen tile a larger share of space than the metric tiles.
- At intermediate widths, use a two-column grid. The specimen and service-time tiles occupy the full row width; volume and TAT share a row. This keeps descriptive text readable instead of forcing it into narrow columns.
- On mobile, use one column, retaining the current vertical reading order.

## Content alignment

- **Specimen** and **วัน-เวลาที่ตรวจวิเคราะห์** are descriptive fields. Keep their icon, label, and value left aligned. Values may wrap naturally and must be allowed to break long unspaced or slash-separated strings safely.
- **ปริมาตร** and **TAT** are concise metrics. Center the icon/label group and the value horizontally. Use a stable minimum height so the metric tiles feel balanced when adjacent descriptive values span multiple lines.
- Preserve all existing fields and values, including the tube-colour marker and placeholder value `—` where source data is absent.
- Remove the duplicated `TAT` line below price. The summary tile remains the single source of the TAT value.

## Technical constraints

- Keep `TestDetailCard` reusable without changing its public props; it is consumed by public catalog, catalog modal, and staff test-detail pages.
- Keep existing design tokens, Lucide-style `Icon` components, Thai copy, and mobile breakpoint behavior.
- Do not add dependencies or change database/API code.
- Add an automated source-level regression test first that verifies the responsive layout classes and the metric/descriptive tile variants.

## Acceptance criteria

1. A long specimen such as `Hemo positive/Colony` is fully visible and wraps rather than clipping or overflowing.
2. Service values such as `8.30 - 15.30 น.` and `ตลอด 24 ชั่วโมง` remain readable without cut-off text.
3. Volume and TAT are visually centered in their own tiles; specimen and service-time remain left aligned.
4. The grid displays four columns at wide widths, two columns at intermediate widths, and one column below the mobile breakpoint.
5. The price area no longer repeats the TAT value.
6. Type checking, the regression test, and the production build pass.
