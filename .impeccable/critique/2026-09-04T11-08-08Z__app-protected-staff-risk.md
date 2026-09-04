---
target: filter and clear-filter flow in risk management
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-09-04T11-08-08Z
slug: app-protected-staff-risk
---
Method: dual-agent (A: 01a06bfb-7ea6-7342-b7a4-fa1ea7d7065b · B: 01a06bfb-7f8b-7342-bb9b-5d366c6c9520)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|---|
| 1 | Visibility of System Status | 3/4 | Active filter chips and result count are visible; loading is only partially announced. |
| 2 | Match System / Real World | 3/4 | Thai operational labels and risk workflow fit the lab context; severity letters still need explanation. |
| 3 | User Control and Freedom | 3/4 | Clear-all and clear-one controls are available; filter changes still use replace history. |
| 4 | Consistency and Standards | 3/4 | The three list surfaces now share the same active-filter pattern. |
| 5 | Error Prevention | 3/4 | Month now requires a fiscal year; stale responses are aborted. |
| 6 | Recognition Rather Than Recall | 3/4 | Active values are named explicitly; hidden URL/Matrix filters are no longer invisible. |
| 7 | Flexibility and Efficiency | 3/4 | URL-backed filters, deep links, pagination, and quick removal support repeat work. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Filter summary is compact and purposeful; long filter values can still make dense rows. |
| 9 | Error Recovery | 3/4 | No-results guidance now points to clearing or widening filters. |
| 10 | Help and Documentation | 2/4 | Labels explain controls, but there is no short help text for the filter model. |
| **Total** |  | **30/40** | **Good operational foundation; remaining work is mostly polish and announcement.** |

## Design Specificity Verdict

The surface feels authored for this lab risk module: Thai-first copy, IOR/Risk Register terminology, ISO workflow, status workflow, and Risk Matrix navigation are specific to the product. Before this pass, the filter experience was category-inconsistent: IOR/Register exposed only partial filter context and Smart-RM had no active-filter recovery bar. The implementation now uses one shared active-filter pattern across all three.

The deterministic detector found 8 advisory quality findings and no P0/P1 or accessibility detector findings. The findings are mostly token/documentation drift: literal 11px/13px values and legitimate modal/chart colors in FilterBar, RiskMatrix, ExportMenu, shared UI, Register detail, and Smart-RM. Treat as P3 cleanup rather than a filter blocker.

The local page was viewable in an existing authenticated browser session at port 3002. The Impeccable overlay was not injected because browser mutation preflight was read-only; no user-visible overlay is claimed.

## Overall Impression

The original controls were usable but made users remember what they selected, especially when the URL or Risk Matrix added a hidden filter. The biggest opportunity was to make the filter state explicit and recoverable. The revised flow now answers “what is filtering this list?” and “how do I return to all records?” in the same place.

## What's Working

- Every active value is shown as a removable chip, including query, status, date, department, RCA, and Matrix-derived filters.
- Clear-all is consistent on IOR, Risk Register, and Smart-RM; Risk Register preserves the Matrix view while removing filters.
- URL merging, debounced search, and request abort guards prevent fast filter changes from dropping values or showing stale results.

## Priority Issues

1. **[P1][แก้แล้ว] Active-filter context was incomplete.** IOR/Register showed only a generic count or special link detail, while Smart-RM had no recovery control. This made filtered results look like missing data. The shared `ActiveFilterBar` now receives explicit descriptors, supports clear-one, and is used on all three pages. Suggested command: `$impeccable clarify`.

2. **[P1][แก้แล้ว] Month could be selected without a fiscal year but the API did not apply that month filter.** The month control is now disabled until a fiscal year is selected, and invalid month-only URL state is cleared. Suggested command: `$impeccable harden`.

3. **[P1][แก้แล้ว] Fast search/filter changes could race.** A pending search timer used an old URL closure, and older fetches could overwrite newer results. The URL hook now merges through a latest-query ref; the search callback is current; list requests abort on query changes. Suggested command: `$impeccable harden`.

4. **[P2][แก้แล้ว] No-results recovery was vague.** Messages previously checked only a subset of filters or implied “no data” even when a filter caused the empty result. Empty-state copy now uses the complete active-filter state and points to clearing or broadening conditions. Suggested command: `$impeccable clarify`.

5. **[P2][คงเหลือ] Filter history/help can be clearer.** The hook comment promises browser-back filter restoration, but navigation still uses `router.replace`; severity options also remain letter-first at the control level despite available Thai descriptions. Suggested command: `$impeccable document`.

## Persona Red Flags

- **Jordan (first-timer):** Before the change, a URL/Matrix link could make rows disappear without a visible reason. The new “ตัวกรองที่ใช้อยู่” chips expose the reason and the single recovery action.
- **Alex (power user):** Rapidly typing a search and changing department could lose one of the values. The latest-query merge and abort guard now preserve the combined URL state and latest result.
- **Risk coordinator:** A Matrix view is a presentation choice, not a filter. Clear-all now removes the selected cell/status/date filters while retaining the Matrix view.

## Minor Observations

- Removable chips and clear-all use 44px minimum targets; long labels ellipsize with a title/accessible name.
- Search, selects, and pagination retain programmatic labels; result counts are polite-live and table regions expose `aria-busy`.
- Detector token advisories are low-risk but worth consolidating into the shared design tokens later.

## Questions to Consider

- Should filter changes use browser history (`push`) for select/status changes while keeping debounced search coalesced with `replace`?
- Would a short helper under “ตัวกรอง” — “เลือกได้หลายเงื่อนไข; เปลี่ยนแล้วรายการจะอัปเดตอัตโนมัติ” — reduce first-time hesitation?
