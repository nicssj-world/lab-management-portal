"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { QualityTaskDialog } from "@/components/quality-tasks/QualityTaskDialog";
import {
  htmlToPlainText,
  MEETING_SUMMARY_MAX_HTML_LENGTH,
  MEETING_SUMMARY_MAX_TEXT_LENGTH,
  normalizeMeetingSummaryHtml,
  sanitizeMeetingSummaryHtml,
} from "@/lib/html-sanitize";

type MeetingSummaryEditorProps = {
  title: string;
  dateLabel: string;
  initialValue: string;
  savedAt: string | null;
  savedBy: string;
  busy?: boolean;
  error?: string;
  onSave: (value: string) => Promise<boolean>;
  onClose: () => void;
};

const COLOR_SWATCHES = [
  { label: "น้ำเงินเข้ม", value: "#1E5FAD" },
  { label: "สีดำ", value: "#0F172A" },
  { label: "สีเขียว", value: "#15803D" },
  { label: "สีส้ม", value: "#C2410C" },
  { label: "สีแดง", value: "#B91C1C" },
  { label: "สีม่วง", value: "#7E22CE" },
];

type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export function MeetingSummaryEditor({
  title,
  dateLabel,
  initialValue,
  savedAt,
  savedBy,
  busy = false,
  error,
  onSave,
  onClose,
}: MeetingSummaryEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef("");
  const loadedValueRef = useRef<string | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [draftText, setDraftText] = useState("");
  const [rawLength, setRawLength] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState("");
  const [savedFeedback, setSavedFeedback] = useState("");
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
  });

  useEffect(() => {
    if (loadedValueRef.current === initialValue) return;
    const safe = normalizeMeetingSummaryHtml(initialValue);
    loadedValueRef.current = initialValue;
    baselineRef.current = safe;
    setDraftText(htmlToPlainText(safe));
    setRawLength(safe.length);
    setDirty(false);
    setLocalError("");
    setSavedFeedback("");
    if (editorRef.current) editorRef.current.innerHTML = safe;
  }, [initialValue]);

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const savedRange = selectionRef.current;
    if (!savedRange || !editor.contains(savedRange.commonAncestorContainer)) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  function updateFormatState() {
    const query = (command: string) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    setFormatState({
      bold: query("bold"),
      italic: query("italic"),
      underline: query("underline"),
    });
  }

  function syncFromEditor() {
    const raw = editorRef.current?.innerHTML ?? "";
    const safe = sanitizeMeetingSummaryHtml(raw);
    const text = htmlToPlainText(safe);
    setDraftText(text);
    setRawLength(raw.length);
    setDirty(safe !== baselineRef.current);
    setSavedFeedback("");
    if (raw.length > MEETING_SUMMARY_MAX_HTML_LENGTH) {
      setLocalError(`รูปแบบเนื้อหายาวเกิน ${MEETING_SUMMARY_MAX_HTML_LENGTH.toLocaleString("th-TH")} ตัวอักษร`);
    } else if (text.length > MEETING_SUMMARY_MAX_TEXT_LENGTH) {
      setLocalError(`สรุปมติยาวเกิน ${MEETING_SUMMARY_MAX_TEXT_LENGTH.toLocaleString("th-TH")} ตัวอักษร`);
    } else {
      setLocalError("");
    }
    updateFormatState();
  }

  function runCommand(command: string, value?: string) {
    restoreSelection();
    document.execCommand(command, false, value);
    rememberSelection();
    syncFromEditor();
  }

  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการทิ้งหรือไม่?")) return;
    onClose();
  }

  async function handleSave() {
    const editor = editorRef.current;
    if (!editor) return;
    const raw = editor.innerHTML;
    const safe = normalizeMeetingSummaryHtml(raw);
    const text = htmlToPlainText(safe);
    setRawLength(raw.length);
    setDraftText(text);
    if (raw.length > MEETING_SUMMARY_MAX_HTML_LENGTH) {
      setLocalError(`รูปแบบเนื้อหายาวเกิน ${MEETING_SUMMARY_MAX_HTML_LENGTH.toLocaleString("th-TH")} ตัวอักษร`);
      return;
    }
    if (text.length > MEETING_SUMMARY_MAX_TEXT_LENGTH) {
      setLocalError(`สรุปมติยาวเกิน ${MEETING_SUMMARY_MAX_TEXT_LENGTH.toLocaleString("th-TH")} ตัวอักษร`);
      return;
    }
    setLocalError("");
    setSavedFeedback("");
    const saved = await onSave(safe);
    if (!saved) return;
    baselineRef.current = safe;
    loadedValueRef.current = safe;
    editor.innerHTML = safe;
    syncFromEditor();
    setDirty(false);
    setSavedFeedback("บันทึกสรุปมติแล้ว");
  }

  function insertPlainText(text: string) {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r\n?/g, "\n")
      .replace(/\n/g, "<br />");
    restoreSelection();
    document.execCommand("insertHTML", false, escaped);
    syncFromEditor();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    if (html) {
      restoreSelection();
      document.execCommand("insertHTML", false, sanitizeMeetingSummaryHtml(html));
      syncFromEditor();
      return;
    }
    insertPlainText(event.clipboardData.getData("text/plain"));
  }

  return (
    <QualityTaskDialog
      labelledBy="meeting-summary-editor-title"
      describedBy="meeting-summary-editor-description"
      closeLabel="ปิดตัวแก้ไขสรุปมติ"
      onClose={requestClose}
      closeDisabled={busy}
      panelStyle={{
        background: "var(--card)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 920,
        maxHeight: "90vh",
        padding: 20,
        boxShadow: "0 20px 60px rgba(15,23,42,.25)",
      }}
    >
      <div className="qt-meeting-summary-editor">
        <header className="qt-meeting-summary-editor-header">
          <div>
            <h2 id="meeting-summary-editor-title">สรุปมติที่ประชุม</h2>
            <p id="meeting-summary-editor-description">
              {title} · {dateLabel}
            </p>
          </div>
          <span className="qt-meeting-summary-editor-state" role="status" aria-live="polite">
            {dirty ? "ยังไม่ได้บันทึก" : savedFeedback || "พร้อมแก้ไข"}
          </span>
        </header>

        <div className="qt-meeting-summary-toolbar" role="toolbar" aria-label="เครื่องมือจัดรูปแบบสรุปมติ">
          <button
            type="button"
            className="qt-meeting-summary-tool qt-meeting-summary-tool-bold"
            aria-label="ตัวหนา"
            title="ตัวหนา"
            aria-pressed={formatState.bold}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand("bold")}
          >
            B
          </button>
          <button
            type="button"
            className="qt-meeting-summary-tool qt-meeting-summary-tool-italic"
            aria-label="ตัวเอียง"
            title="ตัวเอียง"
            aria-pressed={formatState.italic}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand("italic")}
          >
            I
          </button>
          <button
            type="button"
            className="qt-meeting-summary-tool qt-meeting-summary-tool-underline"
            aria-label="ขีดเส้นใต้"
            title="ขีดเส้นใต้"
            aria-pressed={formatState.underline}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand("underline")}
          >
            U
          </button>
          <div className="qt-meeting-summary-color-group" aria-label="สีตัวอักษร">
            <span className="qt-meeting-summary-color-label">สีตัวอักษร</span>
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                className="qt-meeting-summary-color-swatch"
                aria-label={swatch.label}
                title={swatch.label}
                style={{ background: swatch.value }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand("foreColor", swatch.value)}
              />
            ))}
            <label className="qt-meeting-summary-custom-color" title="เลือกสีเพิ่มเติม">
              <span aria-hidden="true">A</span>
              <input
                type="color"
                defaultValue="#1E5FAD"
                aria-label="เลือกสีตัวอักษรเพิ่มเติม"
                onMouseDown={rememberSelection}
                onChange={(event) => runCommand("foreColor", event.currentTarget.value)}
              />
            </label>
          </div>
        </div>

        <div
          ref={editorRef}
          className="qt-meeting-summary-editable"
          contentEditable={!busy}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="ข้อความสรุปมติที่ประชุม"
          data-dialog-autofocus
          data-placeholder="พิมพ์สรุปมติ/ประเด็นสำคัญของการประชุมครั้งนี้"
          tabIndex={0}
          onInput={syncFromEditor}
          onBlur={rememberSelection}
          onKeyUp={() => {
            rememberSelection();
            updateFormatState();
          }}
          onMouseUp={() => {
            rememberSelection();
            updateFormatState();
          }}
          onPaste={handlePaste}
        />

        <div className="qt-meeting-summary-editor-meta">
          <span>
            {savedAt
              ? `บันทึกเมื่อ ${savedAt} โดย ${savedBy}`
              : "ยังไม่ได้บันทึกสรุปมติ"}
          </span>
          <span className={draftText.length > MEETING_SUMMARY_MAX_TEXT_LENGTH ? "is-invalid" : ""}>
            {draftText.length.toLocaleString("th-TH")} / {MEETING_SUMMARY_MAX_TEXT_LENGTH.toLocaleString("th-TH")} ตัวอักษร
            {rawLength > MEETING_SUMMARY_MAX_HTML_LENGTH && " · รูปแบบเกินขนาดที่รองรับ"}
          </span>
        </div>

        {(localError || error) && (
          <div className="qt-meeting-summary-error" role="alert" aria-live="assertive">
            {localError || error}
          </div>
        )}

        <div className="qt-meeting-summary-editor-actions">
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={requestClose}
          >
            ปิด
          </Button>
          <Button
            variant="primary"
            size="md"
            icon="save"
            disabled={busy || !dirty || Boolean(localError)}
            aria-busy={busy}
            onClick={() => void handleSave()}
          >
            {busy ? "กำลังบันทึก…" : "บันทึกสรุปมติ"}
          </Button>
        </div>
      </div>
    </QualityTaskDialog>
  );
}
