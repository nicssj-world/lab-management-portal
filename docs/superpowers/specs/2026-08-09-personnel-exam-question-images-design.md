# Personnel Exam Question Images Design

## Goal

Allow exam managers to attach images to questions and multiple-choice options at `/staff/personnel/exams`, while keeping image-only questions/options valid. Images must be usable from file selection, drag-and-drop, and clipboard paste, and must be reduced automatically before storage.

## Existing behavior to preserve

- `competency_exams.definition` remains the single JSONB source for questions, options, and the answer key.
- Question and answer-key editing remains locked after an assignment has been graded.
- Exam takers receive `definitionForTaking(definition)`, which removes `isCorrect` but keeps the content needed to render the exam.
- Existing exams without image fields continue to work without data migration.
- The current exam-builder modal, page layout, colors, typography, and interaction language remain the visual authority.

## Chosen approach

Compress images in the browser, upload them directly to the existing private Cloudflare R2 bucket with a presigned URL, and persist only R2 object metadata in the exam definition. Server-rendered exam pages create short-lived signed read URLs after authentication and pass those URLs to the client UI.

This avoids embedding binary data in JSONB, avoids sending image bytes through a Next.js route, and follows the file-upload pattern already used by the portal.

## Data model

Add optional image arrays to the existing exam definition types:

```ts
type ExamImage = {
  id: string
  key: string
  alt: string
  width: number
  height: number
}

type ExamOption = {
  id: string
  label: string
  isCorrect: boolean
  images?: ExamImage[]
}

type ExamQuestion = {
  id: string
  prompt: string
  type: 'single_choice' | 'yes_no'
  options: ExamOption[]
  images?: ExamImage[]
}
```

`url` is a runtime-only field added after server signing; it is never persisted. Missing arrays normalize to empty arrays when rendered. The upload limit is four images per target: four for a question and four for each option. The UI exposes option image targets for `single_choice` questions; yes/no choices retain their current compact form.

## Upload and rendering flow

1. The focused image target accepts a file-picker selection, dropped files, or image items from a clipboard paste.
2. The browser rejects non-image items, decodes each image, preserves its aspect ratio, scales the longest edge to at most 1600px, and exports WebP. If the result is still above approximately 2 MB, quality and scale are reduced progressively until it is within the target or the browser reports that compression is not possible.
3. The client requests `POST /api/admin/personnel/exams/images/presign` with the compressed file metadata. The route requires personnel-management access, accepts image content only, and returns a key under the exam-image prefix plus a presigned PUT URL.
4. The browser PUTs the compressed file directly to R2 with the exact WebP content type. The draft stores the key and local preview URL while the upload state tracks pending, complete, or failed.
5. On exam save, the client strips local and signed URLs and sends only persisted image metadata in `definition`. The existing POST/PATCH exam routes validate the complete definition server-side.
6. `ExamsPage` and `TakeExamPage` hydrate image keys into short-lived signed read URLs before passing definitions into client components. The signed URLs are used by native responsive images, avoiding a new public bucket or a new remote-image configuration.
7. `DELETE /api/admin/personnel/exams/images` is used for newly uploaded draft objects that are removed or abandoned. On an existing exam PATCH, the server compares old and new referenced keys and deletes keys removed by a successful save. Images still referenced by an inactive exam are retained for historical assignments.

## Validation and security

- A question is valid when its prompt has text or it has at least one image.
- An option is valid when its label has text or it has at least one image.
- Each question still requires at least two options and exactly one correct option.
- Each image target accepts at most four images.
- Server validation checks image metadata, R2 key prefix, image count, and the full question/option schema; client validation is only an early-feedback layer.
- Presign and cleanup routes use the existing personnel authorization guard. R2 remains private, and read URLs are generated only after the authenticated page has loaded an exam the user is allowed to view.
- Existing question/answer locking remains enforced by the PATCH route; image changes are part of the locked definition.
- Upload, save, and cleanup failures do not expose service credentials, clear the draft, or silently change the answer key.

## User experience

The builder adds a labelled media target below each question prompt and, for multiple-choice questions, inside each option row. Each target shows `รูปคำถาม 0/4` or `รูปตัวเลือก 0/4`, a concise hint for file selection/dragging/paste, thumbnails, and a keyboard-accessible remove action.

The target is a semantic labelled control with a visible `:focus-visible` state and at least a 44px interaction area. Enter/Space opens the picker; paste is handled by the focused target. Drag-over state, compression progress, upload progress, success, failure, and retry are distinct. Errors appear next to the target and through an `aria-live` region, and the first invalid target receives focus on save failure.

The modal remains internally scrollable with its footer actions reachable on narrow screens. Thumbnails use a responsive grid with `max-width: 100%`; no horizontal scroll is introduced at 375px. Reduced-motion preferences are respected.

In the taking view, question images appear with the prompt and option images appear inside the same full-card radio hit target as option text. Image-only content renders without an empty text row. Images below the first viewport use lazy loading, have useful fallback alt text, and retain intrinsic dimensions to reduce layout shift.

## Error and edge-case behavior

- Unsupported or undecodable images show a specific message explaining that the user can try JPG, PNG, or WebP, while leaving other selected images intact.
- Dropping or pasting more than the remaining capacity adds only allowed images and reports the four-image limit.
- A failed presign or PUT marks only that image as failed and provides retry/remove actions.
- The save button is disabled while any image is compressing or uploading, preventing incomplete definitions.
- A 401/403 response is surfaced as a permission/session message; 4xx validation errors are shown near the relevant field; 5xx/network failures offer retry without losing the draft.
- Long Thai text, emoji, and image-only content wrap within the modal and taking cards. Existing reduced-motion and dark-mode tokens remain in effect.
- Clipboard support is progressively enhanced: if the browser does not expose image clipboard data, file selection and drag-and-drop remain available.

## Implementation boundaries

Add a small reusable client image-upload/dropzone component and a server-only exam-image helper. Keep compression, persisted image metadata, URL hydration, and R2 cleanup separate from the exam scoring functions. Do not introduce a rich-text editor, inline image positioning inside text, image cropping, or a new database table in this change.

## Testing plan

Tests are written before implementation and must fail for the missing behavior first.

- Domain/schema tests cover image-only prompts/options, empty targets, four-image limits, exact-one-correct validation, legacy definitions without images, and stripping runtime URLs.
- Exam-definition tests verify that `definitionForTaking` preserves question/option images while removing `isCorrect`.
- Upload route tests cover authorization, image content validation, generated key prefix, rejected oversized metadata, and cleanup restrictions.
- PATCH/POST contract tests cover persistence of keys, rejection of invalid image references, cleanup of removed keys, and lock behavior after grading.
- UI contract tests cover labelled dropzones, keyboard activation, paste/drop handlers, progress and retry states, disabled locked mode, and responsive image rendering.
- Manual acceptance checks cover keyboard-only use, Ctrl+V into the focused question/option target, drag-and-drop, image-only questions/options, a slow or failed upload, a 375px viewport, dark mode, and a completed exam review.

## Acceptance criteria

1. A manager can add up to four images to a question and up to four images to each multiple-choice option.
2. Images can be selected, dragged, or pasted, and are compressed automatically before R2 upload.
3. A question or option may contain only images and still save and render correctly.
4. Exam takers can see all question and option images, but never receive `isCorrect` before submission.
5. Invalid files, upload failures, network failures, and locked exams have explicit recoverable states.
6. Existing exams and scoring behavior remain compatible, and no database migration is required.
7. The implementation passes the relevant domain, API, UI contract, TypeScript, and production build checks.
