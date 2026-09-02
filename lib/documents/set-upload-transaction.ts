export type SetMutationRollbackFailure = {
  label: string
  error: string
}

type UndoAction = {
  label: string
  undo: () => Promise<void>
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Keeps the inverse of every database mutation made while registering a set.
 * Supabase's table REST calls are independent requests, so the route needs a
 * compensating transaction around the multi-table workflow.
 */
export class SetMutationJournal {
  private readonly actions: UndoAction[] = []

  add(label: string, undo: () => Promise<void>) {
    this.actions.push({ label, undo })
  }

  async rollback(): Promise<SetMutationRollbackFailure[]> {
    const failures: SetMutationRollbackFailure[] = []
    for (const action of [...this.actions].reverse()) {
      try {
        await action.undo()
      } catch (error) {
        failures.push({ label: action.label, error: errorMessage(error) })
      }
    }
    return failures
  }
}
