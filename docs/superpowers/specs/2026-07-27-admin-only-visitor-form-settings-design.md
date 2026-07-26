# Admin-only visitor form settings

## Goal

Restrict management of the public visitor form in the staff visitor log so that only Admin users can open or close public submissions and rotate the public link/QR Code. Other authorized staff must retain read-only access to the current public link and QR Code.

## Current behavior

- Staff with `view` permission can open the visitor log page.
- Staff with `edit` permission can open the QR dialog and can currently change the public-form open state or rotate its token.
- `PATCH /api/admin/it-visitors/settings` currently accepts any actor with visitor-log `edit` permission.

## Desired behavior

- Every staff user who can access the visitor log page can open the “ลิงก์ / QR Code” dialog.
- Every such user can view the current QR Code, download it as PNG, and copy the current public link.
- Only an Admin sees:
  - the “เปิดรับการบันทึกผ่านแบบฟอร์มสาธารณะ” checkbox;
  - the “เปลี่ยนลิงก์ / QR Code” button and its confirmation controls.
- Only an Admin can call the settings mutation endpoint successfully.
- A non-Admin mutation attempt returns HTTP 403 and does not change settings.
- Existing permissions for editing visitor-log records and deleting records remain unchanged.

## Design

### Authorization boundary

Add a focused role check for visitor-form settings management alongside the existing visitor-log guard helpers. The settings `PATCH` route will first require visitor-log edit access, then require the actor to be an Admin before validating or applying the mutation. Keeping the Admin check on the server prevents a non-Admin from bypassing the hidden controls with a direct request.

The settings `GET` route remains protected by visitor-log view access so authorized staff can retrieve the current token and form state for read-only QR use.

### Staff interface

The page-level “ลิงก์ / QR Code” action will be available to every user who has already passed the page's visitor-log view gate. Inside the dialog, QR generation, PNG download, and link copying remain available to all such users.

The settings section containing the open/close checkbox and link-rotation workflow will render only when the existing `isAdmin` prop is true. Non-Admins will not see empty settings chrome or disabled management controls.

### Data flow

1. The protected visitor-log page verifies visitor-log view permission and loads logs plus public-form settings.
2. The page passes the actor's Admin status to the client.
3. Any authorized viewer may open the QR dialog and use the current token locally to display or copy the public URL.
4. Only an Admin receives the management controls.
5. A settings mutation reaches the route-level Admin check before any setting is changed.

### Error handling

- Non-Admin `PATCH` requests receive a JSON `Forbidden` response with status 403.
- Existing 401, 422, 404, and 500 behavior remains unchanged.
- The UI continues to show existing toast feedback for failed Admin mutations.

## Testing

Follow test-driven development by first adding regression assertions that fail against the current implementation:

- The top-level QR dialog action is not gated by `canEdit`.
- The checkbox and rotation controls are gated by `isAdmin`, not `canEdit`.
- The settings mutation route performs an Admin-only authorization check and returns 403 for a non-Admin.
- The settings read route remains available through visitor-log view permission.

Run the focused visitor-log test, TypeScript checking, and the relevant security test suite after implementation.

## Out of scope

- Adding a new permission-matrix resource for visitor-form settings.
- Changing who can edit visitor records, record staff checkout, or delete visitor records.
- Changing the public form URL structure, QR appearance, or form-open behavior.
