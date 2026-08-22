import { NextResponse } from 'next/server'
import { SatisfactionRepositoryError } from './satisfaction-repository'

export function satisfactionApiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: message, code }, { status })
}

export function satisfactionRepositoryErrorResponse(error: unknown): NextResponse {
  if (!(error instanceof SatisfactionRepositoryError)) {
    console.error('Unexpected KPI satisfaction API error:', error)
    return satisfactionApiError('internal_error', 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่', 500)
  }
  if (error.code === 'metric_not_found') return satisfactionApiError(error.code, error.message, 404)
  if (error.code === 'storage_error') {
    console.error('KPI satisfaction storage error:', error.cause ?? error)
    return satisfactionApiError(error.code, error.message, 500)
  }
  return satisfactionApiError(error.code, error.message, 409)
}
