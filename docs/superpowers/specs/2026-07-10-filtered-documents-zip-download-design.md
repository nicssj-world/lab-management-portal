# Filtered Documents ZIP Download

## Goal

Add a bulk download action to the staff document library so Reviewer, Document Controller, and Admin users can download a ZIP of all Published documents matching the current filters.

## Access

The action is visible and callable only for:

- Reviewer
- Document Controller
- Admin

The server endpoint must enforce the same permission check. UI-only hiding is not enough.

## Filters

The ZIP uses the current document library filters, not only the current paginated page:

- document type, such as WI
- department, such as Chemistry
- search text
- visibility

The export always forces `status = Published`, regardless of the visible status filter.

## File Choices

The download menu offers three choices:

- PDF
- Word/Excel
- PDF + Word/Excel

PDF files come from the official document file field. Word/Excel files come from the source file field.

## ZIP Structure

The ZIP filename should describe the export, for example:

```text
documents-export-chemistry-WI.zip
```

The ZIP contents are organized as:

```text
PDF/
Word-Excel/
download-summary.txt
```

Only folders relevant to the selected file choice are included.

Each document file should use a stable, readable filename based on document code and title, preserving the original extension when possible.

## Missing Files

If a matching document does not have the selected file kind:

- skip that file
- continue building the ZIP
- record the skipped document and reason in `download-summary.txt`

The summary includes counts for matched documents, exported files, skipped files, and the selected filters.

## Progress UI

Use mixed progress:

- Step progress while the server prepares the ZIP:
  - searching Published documents
  - collecting files
  - creating ZIP
  - starting download
- Real percentage progress only while the browser downloads the completed ZIP, based on streamed bytes received by the client.

The UI disables the bulk download button while a ZIP is being prepared or downloaded.

## Limits

Use conservative limits for the first implementation:

- warning above 200 MB estimated total file size
- hard stop above 300 MB estimated total file size
- hard stop above 100 matching documents

When the hard limit is exceeded, return a clear message asking the user to narrow filters.

## Recommended Architecture

Implement a server-side ZIP endpoint. The browser sends the selected file kind and current filters. The server verifies permission, queries matching Published documents, estimates limits, reads files from R2, writes the ZIP, and returns it as a downloadable response.

The client receives the response as a stream, updates download percentage from bytes received, creates a Blob URL, and triggers the save dialog.

## Testing

Cover the query/filter mapping and ZIP planning logic with tests:

- Published status is always enforced
- PDF selection uses official PDF fields
- Word/Excel selection uses source fields
- combined selection includes both folders
- missing files are skipped and summarized
- hard limits reject too-large exports

