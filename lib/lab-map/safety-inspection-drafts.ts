import type { SafetyChecklistAnswer } from './types'

const DATABASE_NAME = 'lab-safety-inspection-v1'
const STORE_NAME = 'drafts'
const DATABASE_VERSION = 1

export interface StoredSafetyInspectionDraft {
  key: string
  result: 'passed' | 'needs_attention' | 'failed' | 'not_found'
  note: string
  nextInspectionDate: string
  expiresOn: string
  checklist: SafetyChecklistAnswer[]
  compressedPhoto: { blob: Blob; name: string; type: string } | null
  savedAt: string
}

export function safetyInspectionDraftKey(roundId: string | null | undefined, assetId: string) {
  return `${roundId ?? 'adhoc'}:${assetId}`
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('เปิดพื้นที่เก็บแบบร่างไม่สำเร็จ'))
  })
}

async function useDraftStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDraftDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = action(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('จัดการแบบร่างไม่สำเร็จ'))
      transaction.onabort = () => reject(transaction.error ?? new Error('ยกเลิกการบันทึกแบบร่าง'))
    })
  } finally {
    database.close()
  }
}

export async function saveSafetyInspectionDraft(draft: StoredSafetyInspectionDraft) {
  await useDraftStore('readwrite', store => store.put(draft))
}

export async function loadSafetyInspectionDraft(key: string): Promise<StoredSafetyInspectionDraft | null> {
  return (await useDraftStore<StoredSafetyInspectionDraft | undefined>('readonly', store => store.get(key))) ?? null
}

export async function deleteSafetyInspectionDraft(key: string) {
  await useDraftStore('readwrite', store => store.delete(key))
}
