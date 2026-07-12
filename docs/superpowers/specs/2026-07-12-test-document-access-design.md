# Test document visibility and actions

## Goal

Let staff configure the available action for each document attached to a test: view, download, or both. Apply the rule to both quality-library references and files uploaded directly in section G of the test form.

## Visibility rules

- **Internal** documents are shown only to authenticated staff on the test detail page. They always use **View only**; no download action is rendered.
- **Published** documents are shown on the staff test detail page and the public catalog detail page. Each document has an independently configurable action: **View**, **Download**, or **View and Download**.
- Direct attachments receive the same visibility and action metadata as quality-library documents. Existing direct attachments remain internal and view-only until edited, preserving the safer default.

## Data model

- Replace the ID-only relationship metadata for test-linked quality documents with per-document metadata containing the document ID, visibility, and allowed action.
- Add visibility and allowed action fields to direct test-document records.
- Keep existing linked document IDs compatible during migration so existing links remain visible to staff.

## User interface

- In section G, every selected quality-library document and direct attachment displays controls for visibility and allowed action.
- The form disables action selection for internal documents and shows View only.
- Published documents expose the three action choices per document.
- Test detail pages render only the permitted actions. Public catalog pages render only published documents and their permitted actions.

## Enforcement

- Internal documents are excluded from public detail API responses and public catalog pages.
- Download endpoints reject requests when download is not allowed.
- View actions continue to use the existing document-opening flow. This controls product actions but does not constitute DRM against browser-level saving or copying.

## Verification

- Add tests for visibility/action normalization and for the public/staff response boundaries.
- Verify the build and TypeScript checks after implementation.
