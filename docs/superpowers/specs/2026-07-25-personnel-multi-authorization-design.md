# Multi-role and multi-category test authorization

## Goal

Allow managers to grant multiple test-work roles and multiple test categories in one action from both a staff member's authorization tab and the personnel management bulk-assignment dialog.

## Existing model

`staff_authorizations` stores exactly one `role_type` and one scope per row. A category-level authorization has `test_id = null` and one `category`; a test-level authorization has one `test_id`. This model remains unchanged so existing authorizations, editing, and revocation keep working.

## User experience

### Staff detail: “มอบหมายสิทธิ์ทำการตรวจ”

- The role field becomes a checkbox list; at least one role is required.
- When the scope is category, the category field becomes a checkbox list; at least one category is required.
- When the scope is test, one test remains selectable and can be combined with multiple roles.
- The dialog shows the number of authorization records that will be created before saving.
- Editing an existing record remains single-record editing, preserving the current interface and avoiding accidental changes to neighboring permissions.

### Personnel management: bulk assignment

- The authorization dialog uses the same multi-select role and category controls.
- It shows the resulting count: selected staff × selected roles × selected categories.
- The bulk flow is category-level, as it is today; no test-level option is added to this dialog.

## Data flow

- The client sends selected roles and selected categories as arrays, plus common metadata (authorized date and notes).
- Dedicated server-side batch handling expands those selections to individual `staff_authorizations` rows.
- The server removes duplicate combinations in the request and checks active, non-deleted existing rows for the same profile, category/test, and role.
- Existing combinations are skipped. New combinations are inserted as one batch. The response returns created and skipped counts.
- A database transaction is not available through the current Supabase API wrapper. The endpoint validates all inputs and detects duplicates before insertion so a normal request either creates the complete new set or reports the insertion error; it does not silently continue after an insertion failure.

## Authorization and audit

- The staff-detail batch endpoint uses the existing personnel-manage permission, matching the current authorization create route.
- The bulk endpoint retains its Admin/Manager guard.
- Audit entries include the number of created records and skipped duplicates.

## Compatibility

- No database migration is required.
- Existing authorization rows are untouched.
- Existing single-record PATCH and DELETE routes remain unchanged.
- Existing clients posting the old single-authorization payload continue to work where applicable.

## Validation and tests

- Reject empty role selections and empty category selections.
- Verify cross-product expansion for staff detail and for multiple selected staff.
- Verify duplicate selections and already-active authorization records are skipped.
- Verify the UI uses multi-select controls and displays the planned record count.
- Verify an existing authorization can still be edited and revoked singly.
