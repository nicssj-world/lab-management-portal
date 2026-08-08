"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PermLevel } from "@/lib/permissions";
import type {
  AssigneeEntry,
  QualityTaskActionItem,
  QualityTaskHoliday,
  QualityTaskHolidayKind,
  QualityTaskOccurrence,
  QualityTaskTemplate,
} from "@/lib/quality-tasks/types";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { DEPARTMENTS } from "@/lib/validations/user-schema";
import { buildParticipantSignInHtml } from "@/lib/quality-tasks/participant-sign-in-pdf";
import {
  buildReadAudiencePayload,
  buildReadAudiencePickerState,
} from "@/lib/documents/read-audience";
import { QUALITY_TASK_CATEGORIES } from "@/lib/quality-tasks/categories";
import {
  isWeekendDate,
  occurrenceDisplayOwner,
  occurrenceDisplayTitle,
  supportsActionItems,
} from "@/lib/quality-tasks/logic";
import {
  QUALITY_TASK_POLL_INTERVAL_MS,
  shouldPollQualityTaskDashboard,
} from "@/lib/quality-tasks/polling";

type Person = {
  id: string;
  name: string;
  dept: string | null;
  role: string;
  position_title: string | null;
};
type History = {
  id: string | number;
  action: string;
  detail: string | null;
  created_at: string;
  actor_name: string | null;
};
type Props = {
  actorId: string;
  level: PermLevel;
  isAdmin: boolean;
  initialMonth: string;
  initialOccurrences: QualityTaskOccurrence[];
  initialHolidays: QualityTaskHoliday[];
  templates: QualityTaskTemplate[];
  people: Person[];
  initialAdHoc?: boolean;
};
type HolidayDraft = {
  id: string | null;
  holidayDate: string;
  name: string;
  kind: QualityTaskHolidayKind;
};
const DAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const urgencyColor = {
  normal: "#64748B",
  "due-soon": "#D97706",
  overdue: "#DC2626",
  completed: "#16A34A",
};
const urgencyText = {
  normal: "ปกติ",
  "due-soon": "ใกล้กำหนด",
  overdue: "เกินกำหนด",
  completed: "เสร็จแล้ว",
};
const CATEGORY_COLOR: Record<string, string> = {
  A: "#1E5FAD",
  B: "#9333EA",
  C: "#0D9488",
  D: "#DC2626",
  E: "#EA580C",
  F: "#D97706",
  G: "#4F46E5",
  H: "#16A34A",
  I: "#DB2777",
};
const HISTORY_ACTION_LABEL: Record<string, string> = {
  "quality_task.instance.materialize": "ระบบสร้างงานรอบนี้",
  "quality_task.instance.create": "สร้างงานเฉพาะกิจ",
  "quality_task.instance.schedule": "กำหนดวัน/แก้ไขรายละเอียด",
  "quality_task.instance.complete": "ทำเสร็จ",
  "quality_task.instance.reopen": "เปิดงานใหม่",
  "quality_task.instance.cancel": "ยกเลิกรอบนี้",
  "quality_task.instance.delete": "ลบงานเฉพาะกิจ",
  "quality_task.attachment.upload": "แนบไฟล์หลักฐาน",
  "quality_task.attachment.delete": "ลบไฟล์หลักฐาน",
  "quality_task.check_in": "เช็คอิน",
  "quality_task.check_in.close": "ปิดรับเช็คอิน",
  "quality_task.action_item.create": "เพิ่ม Action Item",
  "quality_task.action_item.update": "แก้ไข Action Item",
  "quality_task.action_item.delete": "ลบ Action Item",
  "quality_task.holiday.create": "เพิ่มวันหยุด",
  "quality_task.holiday.update": "แก้ไขวันหยุด",
  "quality_task.holiday.delete": "ลบวันหยุด",
};
const MAX_VISIBLE_CALENDAR_EVENTS = 2;

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}
function shiftMonth(value: string, delta: number) {
  const [y, m] = value.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
function fmt(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00+07:00`).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}
function fmtDateRange(start: string, end: string) {
  if (start === end) return fmt(start);
  const a = new Date(`${start}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const b = new Date(`${end}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${a} – ${b}`;
}
function assigneeName(e: AssigneeEntry, people: Person[]) {
  return e.userId
    ? (people.find((p) => p.id === e.userId)?.name ?? e.manualName)
    : e.manualName;
}
// หน่วยงานสำหรับหัว PDF ใบลงนาม — เอาจากผู้รับผิดชอบคนแรกที่ผูกกับผู้ใช้ในระบบ (มี dept จริง)
// ผู้รับผิดชอบที่เป็นชื่อพิมพ์เอง (manualName ล้วน) ไม่มี dept ให้อ้างอิง จึงข้ามไปหาคนถัดไป
function assigneeDept(entries: AssigneeEntry[], people: Person[]) {
  for (const e of entries) {
    const dept = e.userId ? people.find((p) => p.id === e.userId)?.dept : null;
    if (dept) return dept;
  }
  return "";
}

export function QualityTaskDashboard({
  actorId,
  level,
  isAdmin,
  initialMonth,
  initialOccurrences,
  initialHolidays,
  templates,
  people,
  initialAdHoc = false,
}: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [items, setItems] = useState(initialOccurrences);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [owner, setOwner] = useState("");
  const [assignee, setAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<QualityTaskOccurrence | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [adHoc, setAdHoc] = useState<{
    templateId: string;
    label: string;
    ownerText: string;
    startDate: string;
    endDate: string;
    isMultiDay: boolean;
    assignees: AssigneeEntry[];
  } | null>(() =>
    initialAdHoc && level === "edit"
      ? {
          templateId: "",
          label: "",
          ownerText: "",
          startDate: "",
          endDate: "",
          isMultiDay: false,
          assignees: [],
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [holidayDraft, setHolidayDraft] = useState<HolidayDraft | null>(null);
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [qr, setQr] = useState<{
    instanceId: string;
    url: string;
    dataUrl: string;
    closed: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [completeNote, setCompleteNote] = useState("");
  const [actionItems, setActionItems] = useState<QualityTaskActionItem[]>([]);
  const [newActionItem, setNewActionItem] = useState<{
    userId: string | null;
    manualName: string | null;
    description: string;
    dueDate: string;
  }>({ userId: null, manualName: null, description: "", dueDate: "" });
  const [assigneeDraft, setAssigneeDraft] = useState<AssigneeEntry[] | null>(
    null,
  );
  const [expandedCalendarDate, setExpandedCalendarDate] = useState<
    string | null
  >(null);
  const [rangeHoverKey, setRangeHoverKey] = useState<string | null>(null);
  const [draggedMeetingKey, setDraggedMeetingKey] = useState<string | null>(
    null,
  );
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const draggedOccurrenceRef = useRef<QualityTaskOccurrence | null>(null);
  const adHocDateLabel =
    adHoc &&
    templates.find((template) => template.id === adHoc.templateId)?.taskKind ===
      "meeting"
      ? "วันประชุม"
      : "กำหนดแล้วเสร็จ";
  const selectedSchedule = selected?.scheduleId
    ? selected.template.schedules.find(
        (schedule) => schedule.id === selected.scheduleId,
      )
    : null;
  const selectedDateRange =
    selected && selectedSchedule?.intervalUnit === "month"
      ? monthRange(selected.periodStart.slice(0, 7))
      : null;

  const load = useCallback(async (nextMonth = month, nextScope = scope) => {
    const { from, to } = monthRange(nextMonth);
    const [occurrencesResponse, holidaysResponse] = await Promise.all([
      fetch(
        `/api/admin/quality-tasks/occurrences?from=${from}&to=${to}&scope=${nextScope}`,
        { cache: "no-store" },
      ),
      fetch(`/api/admin/quality-tasks/holidays?from=${from}&to=${to}`, {
        cache: "no-store",
      }),
    ]);
    const occurrencesJson = await occurrencesResponse.json();
    const holidaysJson = await holidaysResponse.json();
    if (!occurrencesResponse.ok) throw new Error(occurrencesJson.error);
    if (!holidaysResponse.ok) throw new Error(holidaysJson.error);
    const occurrences = occurrencesJson.occurrences as QualityTaskOccurrence[];
    setItems(occurrences);
    setSelected((current) =>
      current
        ? occurrences.find((occurrence) => occurrence.key === current.key) ?? current
        : current,
    );
    setHolidays(holidaysJson.holidays ?? []);
  }, [month, scope]);
  useEffect(() => {
    if (!selected) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pollInFlight = false;

    function clearTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function schedule() {
      if (
        cancelled ||
        !shouldPollQualityTaskDashboard(true, document.visibilityState)
      ) {
        return;
      }
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void poll();
      }, QUALITY_TASK_POLL_INTERVAL_MS);
    }
    async function poll() {
      if (
        cancelled ||
        pollInFlight ||
        !shouldPollQualityTaskDashboard(true, document.visibilityState)
      ) {
        return;
      }
      pollInFlight = true;
      try {
        await load();
      } catch {
        // การโหลดรอบถัดไปจะลองใหม่เอง ไม่รบกวนผู้ใช้ด้วย error ชั่วคราว
      } finally {
        pollInFlight = false;
        schedule();
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        clearTimer();
        void poll();
      } else {
        clearTimer();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    schedule();
    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [load, selected?.key]);
  async function move(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(null);
    await load(next, scope);
  }
  async function changeScope(next: "mine" | "all") {
    setScope(next);
    await load(month, next);
  }
  const filtered = useMemo(
    () =>
      items.filter(
        (o) =>
          (!category || o.template.categoryCode === category) &&
          (!state || o.urgency === state) &&
          (!owner || occurrenceDisplayOwner(o) === owner) &&
          (!assignee || o.assignees.some((e) => e.userId === assignee)) &&
          (!search ||
            `${occurrenceDisplayTitle(o)} ${occurrenceDisplayOwner(o)} ${o.completionNote ?? ""}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [items, category, state, owner, assignee, search],
  );
  const owners = useMemo(
    () =>
      [...new Set(items.map((o) => occurrenceDisplayOwner(o)).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "th"),
      ),
    [items],
  );
  const summary = {
    unscheduled: filtered.filter(
      (o) => o.scheduling === "unscheduled" && o.status === "open",
    ).length,
    dueSoon: filtered.filter((o) => o.urgency === "due-soon").length,
    overdue: filtered.filter((o) => o.urgency === "overdue").length,
    completed: filtered.filter((o) => o.urgency === "completed").length,
  };
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const byDate = new Map<string, QualityTaskOccurrence[]>();
  filtered.forEach((o) => {
    const eventStart = o.plannedDate ?? o.periodStart;
    const eventEnd = o.scheduleId === null ? o.periodEnd : eventStart;
    if (!eventStart || !eventEnd) return;
    for (let day = 1; day <= days; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      if (date >= eventStart && date <= eventEnd)
        byDate.set(date, [...(byDate.get(date) ?? []), o]);
    }
  });
  const todayStr = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  );
  const holidayByDate = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.holidayDate, holiday])),
    [holidays],
  );

  async function ensureInstance(o: QualityTaskOccurrence) {
    if (o.instanceId) return o.instanceId;
    const res = await fetch("/api/admin/quality-tasks/occurrences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "scheduled",
        scheduleId: o.scheduleId,
        periodStart: o.periodStart,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.instance.id as string;
  }
  async function mutate(o: QualityTaskOccurrence, payload: unknown) {
    setBusy(true);
    setError("");
    try {
      const id = await ensureInstance(o);
      const res = await fetch(`/api/admin/quality-tasks/occurrences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
      const fresh = (
        await (
          await fetch(
            `/api/admin/quality-tasks/occurrences?from=${monthRange(month).from}&to=${monthRange(month).to}&scope=${scope}`,
          )
        ).json()
      ).occurrences as QualityTaskOccurrence[];
      setItems(fresh);
      setSelected(fresh.find((x) => x.key === o.key) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function rescheduleMeeting(o: QualityTaskOccurrence, date: string) {
    if (busy || (o.plannedDate ?? o.periodStart) === date) return;
    await mutate(o, { action: "schedule", plannedDate: date });
  }
  async function upload(file: File) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const instanceId = await ensureInstance(selected);
      const pre = await fetch("/api/admin/quality-tasks/attachments/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const p = await pre.json();
      if (!pre.ok) throw new Error(p.error);
      const put = await fetch(p.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!put.ok) throw new Error("อัปโหลด PDF ไม่สำเร็จ");
      const fin = await fetch("/api/admin/quality-tasks/attachments/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          key: p.key,
          fileName: file.name,
          sizeBytes: file.size,
        }),
      });
      const f = await fin.json();
      if (!fin.ok) throw new Error(f.error);
      await load();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const canAct =
    selected &&
    (level === "edit" || selected.assignees.some((e) => e.userId === actorId));
  const showActionItems = selected
    ? supportsActionItems({
        taskKind: selected.template.taskKind,
        participantCount: selected.participants.length,
        checkInCount: selected.checkIns.length,
      })
    : false;
  useEffect(() => {
    setAssigneeDraft(selected?.assignees ?? null);
  }, [selected?.key]);
  useEffect(() => {
    if (!selected?.instanceId) {
      setHistory([]);
      return;
    }
    fetch(`/api/admin/quality-tasks/occurrences/${selected.instanceId}/history`)
      .then((r) => r.json())
      .then((j) => setHistory(j.history ?? []))
      .catch(() => setHistory([]));
  }, [selected?.instanceId]);
  useEffect(() => {
    setCompleteNote("");
  }, [selected?.key]);
  async function refreshActionItems(instanceId: string) {
    const res = await fetch(
      `/api/admin/quality-tasks/occurrences/${instanceId}/action-items`,
    );
    const json = await res.json();
    if (res.ok) setActionItems(json.items ?? []);
  }
  useEffect(() => {
    if (!selected?.instanceId) {
      setActionItems([]);
      return;
    }
    refreshActionItems(selected.instanceId);
  }, [selected?.instanceId]);
  useEffect(() => {
    setNewActionItem({
      userId: null,
      manualName: null,
      description: "",
      dueDate: "",
    });
  }, [selected?.key]);
  async function addActionItem() {
    if (!selected || !newActionItem.description.trim()) return;
    setBusy(true);
    setError("");
    try {
      const instanceId = await ensureInstance(selected);
      const res = await fetch(
        `/api/admin/quality-tasks/occurrences/${instanceId}/action-items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignee: {
              userId: newActionItem.userId,
              manualName: newActionItem.manualName,
            },
            description: newActionItem.description.trim(),
            dueDate: newActionItem.dueDate || null,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (!selected.instanceId) await load();
      await refreshActionItems(instanceId);
      setNewActionItem({
        userId: null,
        manualName: null,
        description: "",
        dueDate: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่ม Action Item ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function toggleActionItemDone(item: QualityTaskActionItem) {
    if (!selected?.instanceId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/quality-tasks/occurrences/${selected.instanceId}/action-items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: !item.doneAt }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await refreshActionItems(selected.instanceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปเดต Action Item ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function removeActionItem(item: QualityTaskActionItem) {
    if (!selected?.instanceId) return;
    if (!confirm("ลบ Action Item นี้?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/quality-tasks/occurrences/${selected.instanceId}/action-items/${item.id}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await refreshActionItems(selected.instanceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบ Action Item ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function removeAttachment(id: string) {
    if (!confirm("ลบ PDF นี้?")) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/quality-tasks/attachments/${id}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function removeSelectedOccurrence() {
    if (!selected || level !== "edit") return;
    const isScheduled = Boolean(selected.scheduleId);
    const confirmed = confirm(
      isScheduled
        ? "ยกเลิกรอบงานนี้? งานจะถูกซ่อนจากปฏิทิน แต่ยังเก็บหลักฐานและประวัติไว้"
        : "ลบงานเฉพาะกิจนี้ถาวร? ไฟล์ PDF ที่แนบไว้จะถูกลบด้วย",
    );
    if (!confirmed) return;
    const reason = isScheduled ? prompt("เหตุผลที่ยกเลิกรอบนี้") : null;
    if (isScheduled && !reason?.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const instanceId = await ensureInstance(selected);
      const response = await fetch(
        `/api/admin/quality-tasks/occurrences/${instanceId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setSelected(null);
      await load();
      setNotice(isScheduled ? "ยกเลิกรอบงานแล้ว" : "ลบงานเฉพาะกิจแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function createAdHoc() {
    if (
      !adHoc?.templateId ||
      !adHoc.label.trim() ||
      !adHoc.startDate ||
      !adHoc.endDate
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/quality-tasks/occurrences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "adHoc",
          templateId: adHoc.templateId,
          label: adHoc.label,
          ownerText: adHoc.ownerText.trim() || undefined,
          startDate: adHoc.startDate,
          endDate: adHoc.isMultiDay ? adHoc.endDate : adHoc.startDate,
          assignees: adHoc.assignees,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAdHoc(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  function downloadSignInSheet() {
    if (!selected) return;
    const guestCheckIns = selected.checkIns
      .filter((c) => c.userId === null)
      .sort((a, b) => (a.checkedInAt < b.checkedInAt ? -1 : a.checkedInAt > b.checkedInAt ? 1 : 0));
    if (selected.participants.length === 0 && guestCheckIns.length === 0) return;
    const checkInByUserId = new Map(
      selected.checkIns
        .filter((c): c is typeof c & { userId: string } => c.userId !== null)
        .map((c) => [c.userId, c]),
    );
    // ผู้ที่เพิ่มเข้ามาหน้างาน (wasUnlisted) ต้องต่อท้ายรายชื่อเดิมเสมอ ไม่ใช่แทรกตามลำดับตัวอักษร —
    // resolveParticipants คืนรายชื่อเรียงตามชื่อ (จาก listTaskPeople ที่ .order('name')) โดยไม่แยกว่า
    // ใครมาก่อน ใครถูกเพิ่มทีหลัง จึง sort ซ้ำตรงนี้เฉพาะตอนสร้างใบลงนาม
    // กลุ่มที่มีรายชื่ออยู่แล้วคงลำดับเดิม (stable sort คืนค่า 0) ส่วนกลุ่ม walk-in เรียงตามเวลาเช็คอินจริง
    // (มาก่อนอยู่บนกว่า) แทนลำดับตัวอักษร เพราะลำดับที่มาหน้างานคือสิ่งที่มีความหมายกว่าในกลุ่มนี้
    const ordered = [...selected.participants].sort((a, b) => {
      const aCheckIn = checkInByUserId.get(a.id);
      const bCheckIn = checkInByUserId.get(b.id);
      const aWalkIn = aCheckIn?.wasUnlisted ? 1 : 0;
      const bWalkIn = bCheckIn?.wasUnlisted ? 1 : 0;
      if (aWalkIn !== bWalkIn) return aWalkIn - bWalkIn;
      if (!aWalkIn) return 0;
      const aTime = aCheckIn?.checkedInAt ?? "";
      const bTime = bCheckIn?.checkedInAt ?? "";
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });
    const html = buildParticipantSignInHtml(
      [
        ...ordered.map((p) => ({
          name: p.name,
          positionTitle: p.positionTitle,
          checkedInAt: checkInByUserId.get(p.id)?.checkedInAt ?? null,
          wasUnlisted: checkInByUserId.get(p.id)?.wasUnlisted ?? false,
        })),
        // ผู้ไม่มีบัญชีในระบบไม่มี profile ให้ resolveParticipants จับคู่ได้ จึงไม่ปรากฏใน
        // selected.participants เลย — ต่อท้ายรายชื่อจาก check-in โดยตรง หน่วยงานลงคอลัมน์ "ตำแหน่ง"
        ...guestCheckIns.map((c) => ({
          name: [c.guestName, c.guestSurname].filter(Boolean).join(" "),
          positionTitle: c.guestDepartment,
          checkedInAt: c.checkedInAt,
          wasUnlisted: true,
        })),
      ],
      {
        department: assigneeDept(selected.assignees, people),
        meetingCategory: selected.template.categoryName,
        subject: occurrenceDisplayTitle(selected),
      },
    );
    const blobUrl = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    const win = window.open(blobUrl, "_blank");
    if (!win) {
      URL.revokeObjectURL(blobUrl);
      return;
    }
    win.addEventListener(
      "load",
      () => {
        win.print();
        URL.revokeObjectURL(blobUrl);
      },
      { once: true },
    );
  }
  // ออก QR check-in ของรอบนี้ — materialize รอบก่อนถ้ายังเป็นรอบเสมือน (ไม่มี instanceId)
  // เพราะ check_in_token ผูกอยู่กับแถวใน quality_task_instances เท่านั้น
  async function showCheckInQr(o: QualityTaskOccurrence) {
    setBusy(true);
    setError("");
    try {
      const id = await ensureInstance(o);
      const res = await fetch(
        `/api/admin/quality-tasks/occurrences/${id}/check-in-token`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const url = `${window.location.origin}/checkin/${json.token}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 480,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0F172A", light: "#FFFFFF" },
      });
      setQr({
        instanceId: id,
        url,
        dataUrl,
        closed: Boolean(o.checkInClosedAt) || o.status === "completed",
      });
      setSelected((current) =>
        current?.key === o.key
          ? { ...current, instanceId: id, checkInToken: json.token }
          : current,
      );
      setItems((current) =>
        current.map((item) =>
          item.key === o.key
            ? { ...item, instanceId: id, checkInToken: json.token }
            : item,
        ),
      );
      if (!o.instanceId) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้าง QR ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function closeCheckIn() {
    if (!selected || !qr || !canAct) return;
    if (
      !confirm(
        "ปิดรับ Check-in ของรอบนี้? ผู้ที่ยังไม่เช็คอินจะไม่สามารถใช้ QR นี้เช็คอินได้",
      )
    )
      return;
    const selectedKey = selected.key;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/quality-tasks/occurrences/${qr.instanceId}/check-in-token`,
        { method: "PATCH" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const closedAt = String(json.closedAt ?? new Date().toISOString());
      setQr((current) => (current ? { ...current, closed: true } : current));
      setSelected((current) =>
        current?.key === selectedKey
          ? { ...current, instanceId: qr.instanceId, checkInClosedAt: closedAt }
          : current,
      );
      setItems((current) =>
        current.map((item) =>
          item.key === selectedKey
            ? { ...item, instanceId: qr.instanceId, checkInClosedAt: closedAt }
            : item,
        ),
      );
      setNotice("ปิดรับ Check-in แล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ปิดรับ Check-in ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  function openHolidayEditor(holiday?: QualityTaskHoliday) {
    if (!isAdmin) return;
    setError("");
    setHolidayDraft(
      holiday
        ? {
            id: holiday.id,
            holidayDate: holiday.holidayDate,
            name: holiday.name,
            kind: holiday.kind,
          }
        : {
            id: null,
            holidayDate: `${month}-01`,
            name: "",
            kind: "public",
          },
    );
  }
  async function saveHoliday() {
    if (!isAdmin || !holidayDraft || !holidayDraft.name.trim()) return;
    const draft = holidayDraft;
    setHolidayBusy(true);
    setError("");
    try {
      const res = await fetch(
        draft.id
          ? `/api/admin/quality-tasks/holidays/${draft.id}`
          : "/api/admin/quality-tasks/holidays",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holidayDate: draft.holidayDate,
            name: draft.name,
            kind: draft.kind,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setHolidayDraft(null);
      setNotice(draft.id ? "แก้ไขวันหยุดแล้ว" : "เพิ่มวันหยุดแล้ว");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกวันหยุดไม่สำเร็จ");
    } finally {
      setHolidayBusy(false);
    }
  }
  async function removeHoliday(holiday: QualityTaskHoliday) {
    if (!isAdmin || !confirm(`ลบวันหยุด "${holiday.name}"?`)) return;
    setHolidayBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/quality-tasks/holidays/${holiday.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice("ลบวันหยุดแล้ว");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบวันหยุดไม่สำเร็จ");
    } finally {
      setHolidayBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <style>{`.qt-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:0 8px 28px rgba(15,23,42,.05)}.qt-weekday{padding:9px 8px;text-align:center;font-size:11px;font-weight:800;color:var(--muted);background:var(--surface-2);border-bottom:1px solid var(--border)}.qt-day{position:relative;min-width:0;min-height:152px;padding:9px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--card);transition:background-color .18s ease}.qt-day:nth-child(7n){border-right:0}.qt-day:hover{background:color-mix(in srgb,var(--primary-soft) 35%,var(--card))}.qt-day-empty{background:var(--surface-2);opacity:.65}.qt-day-today{background:color-mix(in srgb,var(--primary-soft) 72%,var(--card))}.qt-date{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 6px;border-radius:999px;color:var(--ink);font-size:11px;font-weight:800;margin-bottom:7px}.qt-day-today .qt-date{background:var(--primary);color:#fff;box-shadow:0 2px 8px rgba(30,95,173,.25)}.qt-event-list{display:grid;gap:5px;min-width:0}.qt-card{width:100%;min-width:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--border) 70%,transparent);border-left:3px solid var(--primary);border-radius:8px;background:color-mix(in srgb,var(--primary-soft) 78%,var(--card));padding:6px 7px;text-align:left;cursor:pointer;color:var(--ink);font-family:inherit;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:background-color .18s,border-color .18s,box-shadow .18s}.qt-card:hover{background:var(--primary-soft);border-color:color-mix(in srgb,var(--primary) 22%,var(--border));box-shadow:0 4px 12px rgba(15,23,42,.1)}.qt-card:focus-visible,.qt-more:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 40%,transparent);outline-offset:2px}.qt-event-title{display:flex;align-items:center;gap:5px;min-width:0;font-size:11.5px;font-weight:750;line-height:1.3}.qt-event-title span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.qt-event-owner{margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:10.5px;line-height:1.25}.qt-more{width:100%;border:1px dashed color-mix(in srgb,var(--primary) 30%,var(--border));border-radius:7px;background:transparent;padding:4px 7px;color:var(--primary);font-family:inherit;font-size:10.5px;font-weight:700;text-align:left;cursor:pointer;transition:background-color .18s,border-color .18s}.qt-more:hover{background:var(--primary-soft);border-style:solid}.qt-overflow-panel{position:absolute;z-index:20;left:8px;right:8px;top:calc(100% - 8px);display:grid;gap:5px;padding:8px;border:1px solid var(--border);border-radius:11px;background:var(--card);box-shadow:0 14px 36px rgba(15,23,42,.18)}.qt-mobile{display:none}@media(prefers-reduced-motion:reduce){.qt-day,.qt-card,.qt-more{transition:none}}@media(max-width:767px){.qt-calendar{grid-template-columns:repeat(7,112px);overflow:auto;border-radius:12px}.qt-day{min-height:132px;padding:6px}.qt-weekday{position:sticky;top:0;z-index:2}.qt-card{padding:5px}.qt-overflow-panel{left:4px;right:4px}.qt-desktop{display:none!important}.qt-mobile{display:grid;gap:9px}}`}</style>
      <style>{`.qt-card.qt-range{position:relative;z-index:1;min-height:44px;border-left-width:0;border-radius:0;box-shadow:none}.qt-card.qt-range:hover{z-index:3;box-shadow:0 4px 12px rgba(15,23,42,.1)}.qt-card.qt-range-start{width:calc(100% + 10px);border-left-width:3px;border-radius:8px 0 0 8px}.qt-card.qt-range-middle{width:calc(100% + 20px);margin-left:-10px}.qt-card.qt-range-end{width:calc(100% + 10px);margin-left:-10px;border-radius:0 8px 8px 0}.qt-card.qt-range-start.qt-range-end{width:100%;margin-left:0;border-radius:8px}.qt-range-continuation{height:29px;display:flex;align-items:center}.qt-range-continuation::after{content:"";width:100%;height:2px;border-radius:999px;background:color-mix(in srgb,var(--primary) 22%,transparent)}@media(max-width:767px){.qt-card.qt-range-start{width:calc(100% + 7px)}.qt-card.qt-range-middle{width:calc(100% + 14px);margin-left:-7px}.qt-card.qt-range-end{width:calc(100% + 7px);margin-left:-7px}.qt-card.qt-range-start.qt-range-end{width:100%;margin-left:0}}`}</style>
      <style>{`.qt-card.qt-range{overflow:visible}.qt-range-continuation::after{width:calc(100% + 36px);margin-left:-18px}.qt-event-list-range .qt-range-continuation::after{width:calc(100% + 36px);margin-left:-18px}.qt-card.qt-range-hover{background:var(--primary-soft);border-color:color-mix(in srgb,var(--primary) 22%,var(--border));box-shadow:0 4px 12px rgba(15,23,42,.1);z-index:3}.qt-card.qt-range-hover .qt-range-continuation::after{background:color-mix(in srgb,var(--primary) 45%,transparent)}@media(max-width:767px){.qt-range-continuation::after,.qt-event-list-range .qt-range-continuation::after{width:calc(100% + 24px);margin-left:-12px}}`}</style>
      <style>{`.qt-card-draggable{cursor:grab}.qt-card-dragging{opacity:.45;cursor:grabbing}.qt-day-drag-over{background:var(--primary-soft);outline:2px dashed var(--primary);outline-offset:-2px}@media(prefers-reduced-motion:reduce){.qt-card-draggable{transition:none}}`}</style>
      <style>{`.qt-weekend-header{color:#B91C1C;background:#FEF2F2}.qt-day-weekend:not(.qt-day-today){background:#FFF7F7}.qt-day-weekend:not(.qt-day-today) .qt-date{color:#B91C1C}.qt-day-holiday{box-shadow:inset 0 3px 0 #F59E0B}.qt-holiday{display:flex;align-items:center;gap:4px;margin:-2px 0 6px;padding:4px 6px;border-radius:6px;background:#FFFBEB;color:#92400E;font-size:10px;line-height:1.25;overflow:hidden}.qt-holiday span{flex-shrink:0;font-weight:800}.qt-holiday b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}@media(max-width:767px){.qt-holiday{font-size:9px;padding:3px 4px}}`}</style>
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background:
            "linear-gradient(135deg, var(--card) 0%, var(--surface-2) 100%)",
          boxShadow: "0 14px 36px rgba(15,23,42,.08)",
        }}
      >
        <PageHeader
          eyebrow="Quality Management System"
          title="งานคุณภาพ"
          subtitle="ปฏิทินประชุม กำหนดส่ง และหลักฐานการดำเนินงาน"
          marginBottom={0}
          actions={
            level === "edit" ? (
              <>
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() =>
                    setAdHoc({
                      templateId: "",
                      label: "",
                      ownerText: "",
                      startDate: todayStr,
                      endDate: todayStr,
                      isMultiDay: false,
                      assignees: [],
                    })
                  }
                >
                  สร้างงานเฉพาะกิจ
                </Button>
                <Link href="/staff/quality-tasks/registry">
                  <Button variant="primary" icon="inbox">
                    ทะเบียนกิจกรรม
                  </Button>
                </Link>
              </>
            ) : undefined
          }
        />
      </div>
      {notice && (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #86EFAC",
            background: "#F0FDF4",
            color: "#166534",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {notice}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(0,1fr))",
          gap: 10,
        }}
      >
        {[
          ["ยังไม่กำหนดวัน", summary.unscheduled, "#64748B", "calendar"],
          ["ใกล้กำหนด", summary.dueSoon, "#D97706", "clock"],
          ["เกินกำหนด", summary.overdue, "#DC2626", "alert"],
          ["เสร็จเดือนนี้", summary.completed, "#16A34A", "check"],
        ].map(([label, value, color, icon], i) => (
          <div
            key={String(label)}
            className="fade-in-up qd-card"
            style={{
              animationDelay: `${i * 40}ms`,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                height: 38,
                borderRadius: 10,
                flexShrink: 0,
                background: `${color}1A`,
                color: String(color),
              }}
            >
              <Icon name={String(icon)} size={18} />
            </span>
            <div>
              <div
                style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "var(--ink)",
                  marginTop: 2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--card)",
        }}
      >
        <Button variant="secondary" size="sm" onClick={() => move(-1)}>
          ‹
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const v = todayStr.slice(0, 7);
            setMonth(v);
            load(v, scope);
          }}
        >
          วันนี้
        </Button>
        <Button variant="secondary" size="sm" onClick={() => move(1)}>
          ›
        </Button>
        <strong style={{ marginRight: "auto", fontSize: 14.5 }}>
          {new Date(`${month}-01T00:00:00+07:00`).toLocaleDateString("th-TH", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <select
          value={scope}
          onChange={(e) => changeScope(e.target.value as "mine" | "all")}
          style={selectStyle}
        >
          <option value="mine">งานของฉัน</option>
          <option value="all">ทั้งหมด</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            ...selectStyle,
            color: category ? CATEGORY_COLOR[category] : selectStyle.color,
            fontWeight: category ? 700 : selectStyle.fontWeight,
          }}
        >
          <option value="">ทุกหมวด</option>
          {"ABCDEFGHI".split("").map((c) => (
            <option key={c} value={c} style={{ color: CATEGORY_COLOR[c] }}>
              ● {c} — {QUALITY_TASK_CATEGORIES[c]}
            </option>
          ))}
        </select>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          style={selectStyle}
        >
          <option value="">ทุกทีม</option>
          {owners.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          style={selectStyle}
        >
          <option value="">ผู้รับผิดชอบทุกคน</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          style={selectStyle}
        >
          <option value="">ทุกสถานะ</option>
          <option value="due-soon">ใกล้กำหนด</option>
          <option value="overdue">เกินกำหนด</option>
          <option value="completed">เสร็จแล้ว</option>
        </select>
        <div style={{ position: "relative" }}>
          <Icon
            name="search"
            size={13}
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหางาน/ทีม"
            style={{ ...selectStyle, minWidth: 180, paddingLeft: 28 }}
          />
        </div>
      </div>
      <div className="qt-calendar">
        {DAY_NAMES.map((d, index) => (
          <div
            key={d}
            className={`qt-weekday${index === 0 || index === 6 ? " qt-weekend-header" : ""}`}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`blank-${i}`} className="qt-day qt-day-empty" />
        ))}
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const isToday = date === todayStr;
          const isWeekend = isWeekendDate(date);
          const holiday = holidayByDate.get(date);
          const events = byDate.get(date) ?? [];
          const visibleEvents = events.slice(0, MAX_VISIBLE_CALENDAR_EVENTS);
          const overflowEvents = events.slice(MAX_VISIBLE_CALENDAR_EVENTS);
          const renderEvent = (o: QualityTaskOccurrence) => {
            const catColor =
              CATEGORY_COLOR[o.template.categoryCode] ?? "var(--primary)";
            const isMultiDay =
              o.scheduleId === null && o.periodEnd > o.periodStart;
            const weekDay = new Date(`${date}T00:00:00Z`).getUTCDay();
            const isVisibleStart =
              !isMultiDay ||
              date === o.periodStart ||
              day === 1 ||
              weekDay === 0;
            const isVisibleEnd =
              !isMultiDay ||
              date === o.periodEnd ||
              day === days ||
              weekDay === 6;
            const rangeClass = isMultiDay
              ? ` qt-range${isVisibleStart ? " qt-range-start" : " qt-range-middle"}${isVisibleEnd ? " qt-range-end" : ""}`
              : "";
            const canDragMeeting =
              o.template.taskKind === "meeting" &&
              !isMultiDay &&
              (level === "edit" ||
                o.assignees.some((e) => e.userId === actorId));
            return (
              <button
                key={o.key}
                type="button"
                className={`qt-card${rangeClass}${rangeHoverKey === o.key ? " qt-range-hover" : ""}${canDragMeeting ? " qt-card-draggable" : ""}${draggedMeetingKey === o.key ? " qt-card-dragging" : ""}`}
                title={isVisibleStart ? `${occurrenceDisplayTitle(o)} · ${occurrenceDisplayOwner(o)}` : undefined}
                aria-label={isVisibleStart ? `${occurrenceDisplayTitle(o)} ${occurrenceDisplayOwner(o)}` : undefined}
                draggable={canDragMeeting}
                onDragStart={
                  canDragMeeting
                    ? (e) => {
                        draggedOccurrenceRef.current = o;
                        setDraggedMeetingKey(o.key);
                        e.dataTransfer.effectAllowed = "move";
                      }
                    : undefined
                }
                onDragEnd={
                  canDragMeeting
                    ? () => {
                        draggedOccurrenceRef.current = null;
                        setDraggedMeetingKey(null);
                        setDragOverDate(null);
                      }
                    : undefined
                }
                onClick={() => {
                  setSelected(o);
                  setError("");
                  setExpandedCalendarDate(null);
                }}
                onMouseEnter={() => isMultiDay && setRangeHoverKey(o.key)}
                onMouseLeave={() => isMultiDay && setRangeHoverKey(null)}
                style={{ borderLeftColor: urgencyColor[o.urgency] }}
              >
                {!isMultiDay || isVisibleStart ? (
                  <>
                    <div className="qt-event-title">
                      {o.template.taskKind === "meeting" && (
                        <Icon
                          name="users"
                          size={11}
                          style={{ color: catColor, flexShrink: 0 }}
                        />
                      )}
                      <span>{occurrenceDisplayTitle(o)}</span>
                    </div>
                    <div className="qt-event-owner">{occurrenceDisplayOwner(o)}</div>
                  </>
                ) : (
                  <div className="qt-range-continuation" aria-hidden="true" />
                )}
              </button>
            );
          };
          return (
            <div
              className={`qt-day${isToday ? " qt-day-today" : ""}${isWeekend ? " qt-day-weekend" : ""}${holiday ? " qt-day-holiday" : ""}${dragOverDate === date ? " qt-day-drag-over" : ""}`}
              key={date}
              onDragOver={
                draggedMeetingKey
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverDate !== date) setDragOverDate(date);
                    }
                  : undefined
              }
              onDragLeave={
                draggedMeetingKey
                  ? () =>
                      setDragOverDate((current) =>
                        current === date ? null : current,
                      )
                  : undefined
              }
              onDrop={
                draggedMeetingKey
                  ? (e) => {
                      e.preventDefault();
                      const dragged = draggedOccurrenceRef.current;
                      draggedOccurrenceRef.current = null;
                      setDraggedMeetingKey(null);
                      setDragOverDate(null);
                      if (dragged) rescheduleMeeting(dragged, date);
                    }
                  : undefined
              }
            >
              <div className="qt-date">{day}</div>
              {holiday && (
                <div className="qt-holiday" title={holiday.name}>
                  <span>วันหยุด</span>
                  <b>{holiday.name}</b>
                </div>
              )}
              <div
                className={`qt-event-list${events.some(
                  (event) =>
                    event.scheduleId === null &&
                    event.periodEnd > event.periodStart,
                ) ? " qt-event-list-range" : ""}`}
              >
                {visibleEvents.map(renderEvent)}
                {overflowEvents.length > 0 && (
                  <button
                    type="button"
                    className="qt-more"
                    aria-expanded={expandedCalendarDate === date}
                    onClick={() =>
                      setExpandedCalendarDate((current) =>
                        current === date ? null : date,
                      )
                    }
                  >
                    + อีก {overflowEvents.length} รายการ
                  </button>
                )}
              </div>
              {expandedCalendarDate === date && overflowEvents.length > 0 && (
                <div
                  className="qt-overflow-panel"
                  aria-label={`รายการเพิ่มเติมวันที่ ${day}`}
                >
                  {overflowEvents.map(renderEvent)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(holidays.length > 0 || isAdmin) && (
        <section
          style={{
            padding: 14,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--card)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>วันหยุดเดือนนี้</h2>
              <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12 }}>
                เสาร์–อาทิตย์ถูกไฮไลท์อัตโนมัติ
              </p>
            </div>
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => openHolidayEditor()}
              >
                เพิ่มวันหยุด
              </Button>
            )}
          </div>
          {holidays.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
              ยังไม่มีวันหยุดที่กำหนดในเดือนนี้
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "9px 10px",
                    border: "1px solid #FDE68A",
                    borderRadius: 9,
                    background: "#FFFBEB",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <b style={{ color: "#92400E", fontSize: 13 }}>{fmt(holiday.holidayDate)}</b>
                      <span style={{ color: "#B45309", fontSize: 10, fontWeight: 700 }}>
                        {holiday.kind === "public" ? "วันหยุดราชการ" : "วันหยุดพิเศษ"}
                      </span>
                    </div>
                    <div style={{ marginTop: 2, color: "#78350F", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {holiday.name}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <Button variant="ghost" size="sm" onClick={() => openHolidayEditor(holiday)}>
                        แก้ไข
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void removeHoliday(holiday)}>
                        ลบ
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      <section>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>
          กิจกรรมทั้งหมด ({filtered.length})
        </h2>
        <div
          className="qt-desktop"
          style={{
            overflow: "auto",
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--card)",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr>
                {["กิจกรรม", "รอบ", "วันนัด", "ผู้รับผิดชอบ", "สถานะ"].map(
                  (h) => (
                    <th
                      key={h}
                      style={
                        h === "รอบ" || h === "ผู้รับผิดชอบ" ? thCenter : th
                      }
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const catColor =
                  CATEGORY_COLOR[o.template.categoryCode] ?? "var(--muted)";
                return (
                  <tr
                    key={o.key}
                    onClick={() => setSelected(o)}
                    className="fade-in-up"
                    style={{
                      animationDelay: `${Math.min(i, 12) * 25}ms`,
                      cursor: "pointer",
                      borderTop: "1px solid var(--border)",
                      transition: "background .1s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={td}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: catColor,
                            flexShrink: 0,
                          }}
                        />
                        <b>{occurrenceDisplayTitle(o)}</b>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginLeft: 15,
                        }}
                      >
                        หมวด {o.template.categoryCode} · {occurrenceDisplayOwner(o)}
                      </div>
                    </td>
                    <td style={tdCenter}>{o.periodLabel}</td>
                    <td style={td}>
                      {fmt(o.plannedDate ?? o.effectiveDueDate)}
                      {!o.plannedDate && (
                        <div style={{ fontSize: 10.5, color: "#D97706" }}>
                          ยังไม่กำหนดวัน
                        </div>
                      )}
                    </td>
                    <td style={tdCenter}>
                      {o.assignees
                        .map((e) => assigneeName(e, people))
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td style={td}>
                      <Status o={o} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="qt-mobile">
          {filtered.map((o, i) => {
            const catColor =
              CATEGORY_COLOR[o.template.categoryCode] ?? "var(--muted)";
            return (
              <button
                key={o.key}
                onClick={() => setSelected(o)}
                className="fade-in-up qd-row"
                style={{
                  animationDelay: `${Math.min(i, 12) * 25}ms`,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 13,
                  textAlign: "left",
                  fontFamily: "inherit",
                  color: "var(--ink)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: catColor,
                      flexShrink: 0,
                    }}
                  />
                  <b>{occurrenceDisplayTitle(o)}</b>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    margin: "5px 0",
                    marginLeft: 15,
                  }}
                >
                  หมวด {o.template.categoryCode} · {o.periodLabel} ·{" "}
                  {fmt(o.plannedDate ?? o.effectiveDueDate)}
                </div>
                <Status o={o} />
              </button>
            );
          })}
        </div>
      </section>
      {selected && (
        <div style={overlay}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-panel-pop"
            style={{
              ...modal,
              borderTop: `3px solid ${CATEGORY_COLOR[selected.template.categoryCode] ?? "var(--primary)"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color:
                      CATEGORY_COLOR[selected.template.categoryCode] ??
                      "var(--primary)",
                    fontWeight: 800,
                  }}
                >
                  หมวด {selected.template.categoryCode} ·{" "}
                  {selected.scheduleId === null
                    ? selected.template.title
                    : selected.template.categoryName}
                </div>
                <h2 style={{ margin: "5px 0 0", fontSize: 20 }}>
                  {occurrenceDisplayTitle(selected)}
                </h2>
              </div>
              <button onClick={() => setSelected(null)} style={closeStyle}>
                ×
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 14,
              }}
            >
              <Info label="ทีม/บทบาท" value={occurrenceDisplayOwner(selected)} />
              <Info
                label="ผู้รับผิดชอบ"
                value={
                  selected.assignees
                    .map((e) => assigneeName(e, people))
                    .filter(Boolean)
                    .join(", ") || "ยังไม่มอบหมาย"
                }
              />
              <Info label="ความถี่" value={selected.template.frequencyText} />
              <Info
                label={
                  selected.scheduleId === null &&
                  selected.periodStart !== selected.periodEnd
                    ? "ช่วงวันนัด"
                    : "วันนัด"
                }
                value={
                  selected.scheduleId === null
                    ? fmtDateRange(selected.periodStart, selected.periodEnd)
                    : fmt(selected.plannedDate)
                }
              />
              <Info label="วันครบกำหนด" value={fmt(selected.effectiveDueDate)} />
              <div
                style={{
                  gridColumn: "1 / -1",
                  maxHeight: 130,
                  overflowY: "auto",
                  borderRadius: 9,
                }}
              >
                <Info
                  label="ผู้เข้าร่วมประชุม"
                  value={
                    selected.participants.map((p) => p.name).join(", ") ||
                    "ยังไม่กำหนด"
                  }
                />
              </div>
              {selected.completionNote && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <Info
                    label={
                      selected.template.taskKind === "meeting"
                        ? "สรุปมติที่ประชุม"
                        : "หมายเหตุการทำเสร็จ"
                    }
                    value={selected.completionNote}
                  />
                </div>
              )}
            </div>
            {selected.participants.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  icon="download"
                  onClick={downloadSignInSheet}
                >
                  ดาวน์โหลด PDF ใบลงนาม (
                  {selected.participants.length +
                    selected.checkIns.filter((c) => c.userId === null).length}{" "}
                  คน)
                </Button>
                {canAct && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="qr"
                    disabled={busy}
                    onClick={() => showCheckInQr(selected)}
                  >
                    QR เช็คอิน
                  </Button>
                )}
                {selected.checkInClosedAt && (
                  <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                    ปิดรับ Check-in แล้ว
                  </span>
                )}
              </div>
            )}
            {selected.checkIns.length > 0 && (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 11.5,
                  color: "var(--muted)",
                }}
              >
                เช็คอินแล้ว {selected.checkIns.length}/
                {selected.participants.length} คน:{" "}
                {selected.checkIns
                  .map((c) => {
                    if (c.userId === null) {
                      const guestName = [c.guestName, c.guestSurname]
                        .filter(Boolean)
                        .join(" ");
                      return `${guestName} (${c.guestDepartment}, ไม่มีบัญชี)`;
                    }
                    const name =
                      selected.participants.find((p) => p.id === c.userId)
                        ?.name ??
                      people.find((p) => p.id === c.userId)?.name ??
                      "ไม่ทราบชื่อ";
                    return c.wasUnlisted ? `${name} (เพิ่มหน้างาน)` : name;
                  })
                  .join(", ")}
              </p>
            )}
            {selected.plannedDate &&
              (selected.plannedDate < selected.periodStart ||
                selected.plannedDate > selected.periodEnd) && (
                <div
                  style={{
                    marginTop: 9,
                    padding: 8,
                    borderRadius: 8,
                    background: "#FEF3C7",
                    color: "#92400E",
                    fontSize: 11,
                  }}
                >
                  วันนัดอยู่นอกช่วงรอบเดิม แต่ระบบยังนับเป็น{" "}
                  {selected.periodLabel}
                </div>
              )}
            <div style={{ marginTop: 12 }}>
              <Status o={selected} />
            </div>
            {error && (
              <div style={{ marginTop: 10, color: "#DC2626", fontSize: 12 }}>
                {error}
              </div>
            )}
            {canAct && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <label style={labelStyle}>
                  กำหนดวัน
                  <input
                    type="date"
                    lang="th"
                    min={selectedDateRange?.from}
                    max={selectedDateRange?.to}
                    defaultValue={selected.plannedDate ?? ""}
                    onChange={(e) =>
                      mutate(selected, {
                        action: "schedule",
                        plannedDate: e.target.value || null,
                      })
                    }
                    disabled={busy}
                    style={inputStyle}
                  />
                  <span
                    style={{
                      marginTop: 4,
                      color: "var(--muted)",
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    {selectedDateRange
                      ? `เลือกได้ระหว่าง ${fmt(selectedDateRange.from)} – ${fmt(selectedDateRange.to)}`
                      : "เลือกวันที่จากปฏิทิน"}
                    {selected.plannedDate
                      ? ` · วันที่เลือก: ${fmt(selected.plannedDate)}`
                      : ""}
                  </span>
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const note = prompt("หมายเหตุ", selected.note ?? "");
                    if (note !== null)
                      mutate(selected, {
                        action: "schedule",
                        plannedDate: selected.plannedDate,
                        note,
                      });
                  }}
                >
                  บันทึกหมายเหตุ
                </Button>
                {level === "edit" && (
                  <label style={labelStyle}>
                    ผู้รับผิดชอบรอบนี้
                    <AssigneeListEditor
                      entries={assigneeDraft ?? selected.assignees}
                      onChange={(entries) => {
                        setAssigneeDraft(entries);
                        if (
                          entries.every(
                            (entry) =>
                              Boolean(entry.userId) ||
                              Boolean(entry.manualName?.trim()),
                          )
                        ) {
                          mutate(selected, {
                            action: "schedule",
                            plannedDate: selected.plannedDate,
                            assignees: entries,
                          });
                        }
                      }}
                      people={people}
                    />
                  </label>
                )}
                {level === "edit" && (
                  <label style={labelStyle}>
                    ผู้เข้าร่วมประชุม (เฉพาะรอบนี้)
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--ink)",
                          fontWeight: 500,
                        }}
                      >
                        {selected.participantDepts.length === 0 &&
                        selected.participantUserIds.length === 0
                          ? "ใช้ค่าเริ่มต้นของกิจกรรม"
                          : `${selected.participantDepts.length} แผนก · ${selected.participantUserIds.length} คน (เฉพาะรอบนี้)`}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setParticipantModalOpen(true)}
                      >
                        กำหนดผู้เข้าร่วม
                      </Button>
                    </div>
                  </label>
                )}
                <div>
                  <b style={{ fontSize: 12 }}>
                    PDF หลักฐาน{" "}
                    {selected.template.evidenceRequired
                      ? "(บังคับ)"
                      : "(ไม่บังคับ)"}
                  </b>
                  <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
                    {selected.attachments.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <a
                          href={`/api/admin/quality-tasks/attachments/${a.id}`}
                          target="_blank"
                          style={{
                            fontSize: 12,
                            color: "var(--primary)",
                            flex: 1,
                          }}
                        >
                          📎 {a.fileName}
                        </a>
                        {level === "edit" && (
                          <button
                            onClick={() => removeAttachment(a.id)}
                            style={{
                              ...closeStyle,
                              width: 26,
                              height: 26,
                              fontSize: 13,
                            }}
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    style={{ marginTop: 7 }}
                  >
                    แนบ PDF
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(f);
                    }}
                  />
                </div>
                {selected.status === "open" ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {selected.template.taskKind === "meeting" && (
                      <label style={labelStyle}>
                        สรุปมติที่ประชุม
                        <textarea
                          value={completeNote}
                          onChange={(e) => setCompleteNote(e.target.value)}
                          placeholder="พิมพ์สรุปมติ/ประเด็นสำคัญของการประชุมครั้งนี้"
                          disabled={busy}
                          style={{
                            ...inputStyle,
                            height: 80,
                            padding: 9,
                            resize: "vertical",
                          }}
                        />
                      </label>
                    )}
                    <div
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() =>
                          mutate(selected, {
                            action: "complete",
                            completionNote: completeNote.trim() || null,
                          })
                        }
                      >
                        ทำแล้ว
                      </Button>
                    </div>
                  </div>
                ) : level === "edit" ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        const reason = prompt("เหตุผลที่เปิดงานใหม่");
                        if (reason)
                          mutate(selected, { action: "reopen", reason });
                      }}
                    >
                      เปิดงานใหม่
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
            {showActionItems && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <b style={{ fontSize: 12 }}>ACTION ITEMS</b>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    เสร็จแล้ว {actionItems.filter((i) => i.doneAt).length}/
                    {actionItems.length}
                  </span>
                </div>
                {actionItems.length > 0 && (
                  <div
                    style={{ overflowX: "auto", marginTop: 8 }}
                  >
                    <table
                      style={{
                        width: "100%",
                        tableLayout: "fixed",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}
                    >
                      <colgroup>
                        <col style={{ width: 44 }} />
                        <col style={{ width: "22%" }} />
                        <col />
                        <col style={{ width: "18%" }} />
                        {canAct && <col style={{ width: 36 }} />}
                      </colgroup>
                      <thead>
                        <tr style={{ color: "var(--muted)", fontSize: 11 }}>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>
                            เสร็จ
                          </th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>
                            ผู้รับผิดชอบ
                          </th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>
                            งาน
                          </th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>
                            กำหนดส่ง
                          </th>
                          {canAct && <th style={{ padding: "4px 6px" }} />}
                        </tr>
                      </thead>
                      <tbody>
                        {actionItems.map((item) => {
                          const done = Boolean(item.doneAt);
                          const overdue =
                            !done &&
                            Boolean(item.dueDate) &&
                            (item.dueDate as string) < todayStr;
                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderTop: "1px solid var(--border)",
                              }}
                            >
                              <td style={{ padding: "6px" }}>
                                <input
                                  type="checkbox"
                                  checked={done}
                                  disabled={!canAct || busy}
                                  onChange={() => toggleActionItemDone(item)}
                                />
                              </td>
                              <td
                                style={{
                                  padding: "6px",
                                  textDecoration: done ? "line-through" : "none",
                                  color: done ? "var(--muted)" : "var(--ink)",
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {assigneeName(item.assignee, people)}
                              </td>
                              <td
                                style={{
                                  padding: "6px",
                                  textDecoration: done ? "line-through" : "none",
                                  color: done ? "var(--muted)" : "var(--ink)",
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {item.description}
                              </td>
                              <td
                                style={{
                                  padding: "6px",
                                  color: overdue
                                    ? urgencyColor.overdue
                                    : done
                                      ? "var(--muted)"
                                      : "var(--ink)",
                                  textDecoration: done ? "line-through" : "none",
                                }}
                              >
                                {overdue ? "⚠ " : ""}
                                {fmt(item.dueDate)}
                              </td>
                              {canAct && (
                                <td style={{ padding: "6px" }}>
                                  <button
                                    onClick={() => removeActionItem(item)}
                                    disabled={busy}
                                    style={{
                                      ...closeStyle,
                                      width: 24,
                                      height: 24,
                                      fontSize: 12,
                                    }}
                                  >
                                    ×
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {canAct && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,0.9fr) auto",
                      gap: 6,
                      marginTop: 10,
                      minWidth: 0,
                    }}
                  >
                    <select
                      value={newActionItem.userId ?? ""}
                      onChange={(e) => {
                        const uid = e.target.value || null;
                        const person = people.find((p) => p.id === uid);
                        setNewActionItem((s) => ({
                          ...s,
                          userId: uid,
                          manualName: person ? person.name : s.manualName,
                        }));
                      }}
                      style={{ ...inputStyle, minWidth: 0, width: "100%" }}
                    >
                      <option value="">พิมพ์ชื่อเอง</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.dept ?? p.role}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newActionItem.manualName ?? ""}
                      disabled={Boolean(newActionItem.userId)}
                      onChange={(e) =>
                        setNewActionItem((s) => ({
                          ...s,
                          userId: null,
                          manualName: e.target.value || null,
                        }))
                      }
                      placeholder="ชื่อผู้รับผิดชอบ"
                      style={{
                        ...inputStyle,
                        minWidth: 0,
                        width: "100%",
                        opacity: newActionItem.userId ? 0.65 : 1,
                      }}
                    />
                    <input
                      value={newActionItem.description}
                      onChange={(e) =>
                        setNewActionItem((s) => ({
                          ...s,
                          description: e.target.value,
                        }))
                      }
                      placeholder="งานที่ต้องทำ"
                      style={{ ...inputStyle, minWidth: 0, width: "100%" }}
                    />
                    <input
                      type="date"
                      value={newActionItem.dueDate}
                      onChange={(e) =>
                        setNewActionItem((s) => ({
                          ...s,
                          dueDate: e.target.value,
                        }))
                      }
                      style={{ ...inputStyle, minWidth: 0, width: "100%" }}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy || !newActionItem.description.trim()}
                      onClick={addActionItem}
                    >
                      + เพิ่ม
                    </Button>
                  </div>
                )}
              </div>
            )}
            {level === "edit" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={removeSelectedOccurrence}
                >
                  {selected.scheduleId ? "ยกเลิกรอบนี้" : "ลบงาน"}
                </Button>
              </div>
            )}
            <div
              style={{
                marginTop: 16,
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
              }}
            >
              <b style={{ fontSize: 12 }}>ประวัติกิจกรรม</b>
              {history.length ? (
                <div
                  style={{
                    display: "grid",
                    gap: 7,
                    marginTop: 7,
                    maxHeight: 120,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  {history.map((h) => (
                    <div
                      key={h.id}
                      style={{ fontSize: 11, color: "var(--muted)" }}
                    >
                      <b style={{ color: "var(--ink)" }}>
                        {h.actor_name ?? "System"}
                      </b>{" "}
                      · {HISTORY_ACTION_LABEL[h.action] ?? h.action} ·{" "}
                      {new Date(h.created_at).toLocaleString("th-TH", {
                        timeZone: "Asia/Bangkok",
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}
                >
                  ยังไม่มีประวัติที่บันทึก
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {participantModalOpen && selected && (
        <ParticipantAudienceModal
          depts={selected.participantDepts}
          userIds={selected.participantUserIds}
          people={people}
          onCancel={() => setParticipantModalOpen(false)}
          onSave={(depts, userIds) => {
            setParticipantModalOpen(false);
            mutate(selected, {
              action: "schedule",
              plannedDate: selected.plannedDate,
              participantDepts: depts,
              participantUserIds: userIds,
            });
          }}
        />
      )}
      {adHoc && (
        <div style={overlay}>
          <div
            style={{ ...modal, maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>สร้างงานเฉพาะกิจ</h2>
              <button style={closeStyle} onClick={() => setAdHoc(null)}>
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <label style={labelStyle}>
                แม่แบบ
                <select
                  value={adHoc.templateId}
                  onChange={(e) =>
                    setAdHoc({ ...adHoc, templateId: e.target.value })
                  }
                  style={inputStyle}
                >
                  <option value="">เลือกกิจกรรม</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.activityNo}. {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                ชื่อรอบ/เหตุการณ์
                <input
                  value={adHoc.label}
                  onChange={(e) =>
                    setAdHoc({ ...adHoc, label: e.target.value })
                  }
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                ทีม/บทบาท (ถ้าไม่ตรงกับแม่แบบ)
                <input
                  value={adHoc.ownerText}
                  onChange={(e) =>
                    setAdHoc({ ...adHoc, ownerText: e.target.value })
                  }
                  placeholder="เว้นว่างเพื่อใช้ทีม/บทบาทของแม่แบบ"
                  style={inputStyle}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={adHoc.isMultiDay}
                  onChange={(e) =>
                    setAdHoc({
                      ...adHoc,
                      isMultiDay: e.target.checked,
                      endDate: e.target.checked
                        ? adHoc.endDate || adHoc.startDate
                        : adHoc.startDate,
                    })
                  }
                />{" "}
                หลายวัน
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: adHoc.isMultiDay ? "1fr 1fr" : "1fr",
                  gap: 10,
                }}
              >
                <label style={labelStyle}>
                  {adHoc.isMultiDay ? "วันเริ่มต้น" : adHocDateLabel}
                  <input
                    type="date"
                    value={adHoc.startDate}
                    onChange={(e) =>
                      setAdHoc({
                        ...adHoc,
                        startDate: e.target.value,
                        endDate:
                          adHoc.isMultiDay && adHoc.endDate < e.target.value
                            ? e.target.value
                            : adHoc.endDate,
                      })
                    }
                    style={inputStyle}
                  />
                </label>
                {adHoc.isMultiDay && (
                  <label style={labelStyle}>
                    วันสิ้นสุด
                    <input
                      type="date"
                      min={adHoc.startDate}
                      value={adHoc.endDate}
                      onChange={(e) =>
                        setAdHoc({ ...adHoc, endDate: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>
                )}
              </div>
              <label style={labelStyle}>
                ผู้รับผิดชอบ
                <AssigneeListEditor
                  entries={adHoc.assignees}
                  onChange={(entries) =>
                    setAdHoc({ ...adHoc, assignees: entries })
                  }
                  people={people}
                />
              </label>
              {error && (
                <div role="alert" style={{ color: "#DC2626", fontSize: 12 }}>
                  {error}
                </div>
              )}
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <Button variant="secondary" onClick={() => setAdHoc(null)}>
                  ยกเลิก
                </Button>
                <Button
                  disabled={
                    busy ||
                    !adHoc.templateId ||
                    !adHoc.label.trim() ||
                    !adHoc.startDate ||
                    !adHoc.endDate
                  }
                  onClick={createAdHoc}
                >
                  สร้างงาน
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {qr && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 380, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>QR เช็คอินการประชุม</h2>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
              {qr.closed
                ? "ปิดรับ Check-in แล้ว QR นี้ไม่รับเช็คอินใหม่"
                : "ให้ผู้เข้าร่วมสแกนเพื่อเช็คอิน (ต้องล็อกอินอยู่)"}
            </p>
            <img
              src={qr.dataUrl}
              alt="QR เช็คอินการประชุม"
              style={{
                width: "min(280px, 100%)",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "#fff",
                marginTop: 12,
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <a
                href={qr.dataUrl}
                download="quality-task-check-in-qr.png"
                style={{ textDecoration: "none" }}
              >
                <Button icon="download">ดาวน์โหลด PNG</Button>
              </a>
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(qr.url)}
              >
                คัดลอกลิงก์
              </Button>
              {canAct && !qr.closed && (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => void closeCheckIn()}
                >
                  ปิดรับ Check-in
                </Button>
              )}
              {qr.closed && (
                <span
                  style={{
                    alignSelf: "center",
                    color: "var(--muted)",
                    fontSize: 12,
                  }}
                >
                  ปิดรับแล้ว
                </span>
              )}
              <Button variant="ghost" onClick={() => setQr(null)}>
                ปิด
              </Button>
            </div>
            <code
              style={{
                display: "block",
                marginTop: 12,
                padding: 8,
                borderRadius: 7,
                background: "var(--surface-2)",
                color: "var(--muted)",
                fontSize: 10,
                overflowWrap: "anywhere",
              }}
            >
              {qr.url}
            </code>
          </div>
        </div>
      )}
      {holidayDraft && (
        <div
          style={overlay}
          onClick={() => !holidayBusy && setHolidayDraft(null)}
        >
          <div
            style={{ ...modal, maxWidth: 480 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17 }}>
                {holidayDraft.id ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}
              </h2>
              <button
                type="button"
                aria-label="ปิดหน้าต่าง"
                style={closeStyle}
                disabled={holidayBusy}
                onClick={() => setHolidayDraft(null)}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <label style={labelStyle}>
                วันที่
                <input
                  type="date"
                  value={holidayDraft.holidayDate}
                  disabled={holidayBusy}
                  onChange={(event) =>
                    setHolidayDraft({
                      ...holidayDraft,
                      holidayDate: event.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                ชื่อวันหยุด
                <input
                  value={holidayDraft.name}
                  maxLength={160}
                  disabled={holidayBusy}
                  onChange={(event) =>
                    setHolidayDraft({ ...holidayDraft, name: event.target.value })
                  }
                  placeholder="เช่น วันหยุดชดเชยวันสงกรานต์"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                ประเภท
                <select
                  value={holidayDraft.kind}
                  disabled={holidayBusy}
                  onChange={(event) =>
                    setHolidayDraft({
                      ...holidayDraft,
                      kind: event.target.value as QualityTaskHolidayKind,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="public">วันหยุดราชการ</option>
                  <option value="special">วันหยุดพิเศษ</option>
                </select>
              </label>
              {error && (
                <div role="alert" style={{ color: "#DC2626", fontSize: 12 }}>
                  {error}
                </div>
              )}
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <Button
                  variant="secondary"
                  disabled={holidayBusy}
                  onClick={() => setHolidayDraft(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  disabled={
                    holidayBusy ||
                    !holidayDraft.holidayDate ||
                    !holidayDraft.name.trim()
                  }
                  onClick={() => void saveHoliday()}
                >
                  {holidayBusy ? "กำลังบันทึก…" : "บันทึกวันหยุด"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssigneeListEditor({
  entries,
  onChange,
  people,
}: {
  entries: AssigneeEntry[];
  onChange: (entries: AssigneeEntry[]) => void;
  people: Person[];
}) {
  function updateEntry(i: number, patch: Partial<AssigneeEntry>) {
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addEntry() {
    onChange([...entries, { userId: null, manualName: null }]);
  }
  function removeEntry(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
  }
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
      {entries.map((e, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto",
            gap: 6,
            minWidth: 0,
          }}
        >
          <select
            value={e.userId ?? ""}
            onChange={(ev) => {
              const uid = ev.target.value || null;
              const person = people.find((p) => p.id === uid);
              updateEntry(i, {
                userId: uid,
                manualName: person ? person.name : e.manualName,
              });
            }}
            style={{ ...inputStyle, minWidth: 0, width: "100%" }}
          >
            <option value="">ไม่ผูกกับผู้ใช้ / กรอกชื่อเอง</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.dept ?? p.role}
              </option>
            ))}
          </select>
          <input
            value={e.manualName ?? ""}
            disabled={Boolean(e.userId)}
            onChange={(ev) =>
              updateEntry(i, {
                userId: null,
                manualName: ev.target.value || null,
              })
            }
            placeholder="ชื่อผู้รับผิดชอบ"
            style={{
              ...inputStyle,
              minWidth: 0,
              width: "100%",
              opacity: e.userId ? 0.65 : 1,
            }}
          />
          <button
            onClick={() => removeEntry(i)}
            style={{ ...closeStyle, width: 36, height: 36, fontSize: 16 }}
          >
            ×
          </button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addEntry}>
        + เพิ่มผู้รับผิดชอบ
      </Button>
    </div>
  );
}
function DeptAudienceCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      style={{
        accentColor: "var(--primary)",
        marginTop: 2,
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
      }}
    />
  );
}
function ParticipantAudienceModal({
  depts,
  userIds,
  people,
  onCancel,
  onSave,
}: {
  depts: string[];
  userIds: string[];
  people: Person[];
  onCancel: () => void;
  onSave: (depts: string[], userIds: string[]) => void;
}) {
  const initial = useMemo(
    () => buildReadAudiencePickerState(people, depts, userIds),
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<"all" | "depts">(initial.mode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initial.selected_user_ids),
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(initial.expanded_keys),
  );
  const groups = useMemo(() => {
    const gs: { key: string; label: string; members: Person[] }[] =
      DEPARTMENTS.map((d) => ({
        key: d,
        label: d,
        members: people.filter((p) => p.dept === d),
      }));
    const un = people.filter((p) => p.dept == null);
    if (un.length > 0)
      gs.push({ key: "__no_dept__", label: "ไม่ระบุแผนก", members: un });
    return gs;
  }, [people]);
  function toggleExpand(k: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }
  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleGroup(members: Person[]) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      const all = members.every((m) => n.has(m.id));
      for (const m of members) {
        if (all) n.delete(m.id);
        else n.add(m.id);
      }
      return n;
    });
  }
  function handleSave() {
    if (mode === "all") {
      onSave([], []);
      return;
    }
    const payload = buildReadAudiencePayload(selectedIds, people, DEPARTMENTS);
    onSave(payload.depts, payload.user_ids);
  }
  return (
    <div style={overlay}>
      <div
        style={{ ...modal, maxWidth: 460, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          กำหนดผู้เข้าร่วมประชุม
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 3,
            marginBottom: 14,
          }}
        >
          เลือกแผนกหรือรายบุคคลที่คาดว่าจะเข้าร่วม
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="qt-participant-mode"
              checked={mode === "all"}
              onChange={() => setMode("all")}
              style={{ accentColor: "var(--primary)" }}
            />
            ยังไม่กำหนด (ไม่มีผู้เข้าร่วมเริ่มต้น)
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="qt-participant-mode"
              checked={mode === "depts"}
              onChange={() => setMode("depts")}
              style={{ accentColor: "var(--primary)" }}
            />
            ระบุแผนก/รายคน
          </label>
        </div>
        {mode === "depts" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 5,
              maxHeight: 260,
              overflowY: "auto",
              padding: "4px 2px",
              marginBottom: 6,
            }}
          >
            {groups.map((group) => {
              const selectedCount = group.members.filter((p) =>
                selectedIds.has(p.id),
              ).length;
              const checked =
                group.members.length > 0 &&
                selectedCount === group.members.length;
              const indeterminate =
                selectedCount > 0 && selectedCount < group.members.length;
              const isExpanded = expanded.has(group.key);
              const disabled = group.members.length === 0;
              return (
                <div key={group.key}>
                  <div
                    onClick={() => {
                      if (!disabled) toggleExpand(group.key);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 7,
                      fontSize: 12,
                      color: disabled ? "var(--muted)" : "var(--ink)",
                      cursor: disabled ? "default" : "pointer",
                      lineHeight: 1.35,
                      padding: "4px 2px",
                    }}
                  >
                    <DeptAudienceCheckbox
                      checked={checked}
                      indeterminate={indeterminate}
                      disabled={disabled}
                      onChange={() => toggleGroup(group.members)}
                    />
                    <Icon
                      name={isExpanded ? "chevDown" : "chevRight"}
                      size={12}
                      style={{
                        color: "var(--muted)",
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{group.label}</span>
                      <span style={{ color: "var(--muted)", marginLeft: 5 }}>
                        ({group.members.length} คน)
                      </span>
                    </div>
                  </div>
                  {isExpanded && group.members.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gap: 4,
                        padding: "2px 0 4px 32px",
                      }}
                    >
                      {group.members.map((person) => (
                        <label
                          key={person.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 6,
                            fontSize: 12,
                            color: "var(--ink)",
                            cursor: "pointer",
                            lineHeight: 1.35,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(person.id)}
                            onChange={() => toggleMember(person.id)}
                            style={{
                              accentColor: "var(--primary)",
                              marginTop: 2,
                              flexShrink: 0,
                            }}
                          />
                          <span>
                            <span style={{ fontWeight: 600 }}>
                              {person.name}
                            </span>
                            <span
                              style={{ color: "var(--muted)", marginLeft: 5 }}
                            >
                              {person.position_title ?? ""}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {mode === "depts" && selectedIds.size === 0 && (
          <div
            style={{ fontSize: 11, color: "var(--warning)", marginBottom: 4 }}
          >
            ยังไม่ได้เลือกแผนก/รายคน — จะไม่มีผู้เข้าร่วมเริ่มต้น
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 14,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--ink)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
            }}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
function Status({ o }: { o: QualityTaskOccurrence }) {
  return (
    <span
      style={{
        display: "inline-flex",
        border: `1px solid ${urgencyColor[o.urgency]}55`,
        background: `${urgencyColor[o.urgency]}12`,
        color: urgencyColor[o.urgency],
        padding: "3px 8px",
        borderRadius: 99,
        fontSize: 10.5,
        fontWeight: 800,
      }}
    >
      {urgencyText[o.urgency]}
    </span>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ background: "var(--surface-2)", borderRadius: 9, padding: 10 }}
    >
      <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}
const selectStyle: React.CSSProperties = {
  height: 34,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--card)",
  color: "var(--ink)",
  padding: "0 9px",
  fontFamily: "inherit",
  fontSize: 13,
};
const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  color: "var(--muted)",
  background: "var(--surface-2)",
  whiteSpace: "nowrap",
};
const thCenter: React.CSSProperties = { ...th, textAlign: "center" };
const td: React.CSSProperties = { padding: "11px 12px", verticalAlign: "top" };
const tdCenter: React.CSSProperties = {
  ...td,
  textAlign: "center",
  verticalAlign: "middle",
};
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "rgba(15,23,42,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};
const modal: React.CSSProperties = {
  background: "var(--card)",
  borderRadius: 16,
  width: "100%",
  maxWidth: 680,
  maxHeight: "90vh",
  overflow: "auto",
  padding: 20,
  boxShadow: "0 24px 70px rgba(0,0,0,.25)",
};
const closeStyle: React.CSSProperties = {
  border: 0,
  background: "var(--surface-2)",
  borderRadius: 8,
  width: 32,
  height: 32,
  fontSize: 22,
  cursor: "pointer",
  color: "var(--muted)",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--muted)",
  display: "grid",
  gap: 5,
};
const inputStyle: React.CSSProperties = {
  height: 36,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0 9px",
  background: "var(--card)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 13,
};
