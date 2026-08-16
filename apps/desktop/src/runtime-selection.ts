/** Managed-runtime selection independent of Electron startup mechanics. */

import {
  quarantineManagedRuntimePointer,
  readManagedRuntime,
} from '@deepseek-ai/dsh-host-runtime-updater/managed-runtime'

/** Minimum desktop Host path fields changed by a managed runtime selection. */
export interface RuntimeSelectablePaths {
  readonly runtimeRoot: string
  readonly cliEntry: string
  readonly version: string
  readonly fuiVersion: string
  readonly compatibleDshRange: string
  readonly source: 'bundled' | 'managed'
}

/** Substitutable storage and diagnostic functions used by selection tests. */
export interface RuntimeSelectionInternals {
  readonly read?: typeof readManagedRuntime
  readonly quarantine?: (runtimeRoot: string) => Promise<string | undefined>
  readonly report?: (message: string, error: unknown) => void
}

/** Prefer a validated managed tree while always retaining the immutable baseline candidate. */
export async function selectRuntimeCandidates<T extends RuntimeSelectablePaths>(
  bundled: T,
  internals: RuntimeSelectionInternals = {},
): Promise<readonly T[]> {
  try {
    const managed = await (internals.read ?? readManagedRuntime)(bundled.runtimeRoot, {
      fuiVersion: bundled.fuiVersion,
      compatibleDshRange: bundled.compatibleDshRange,
    })
    if (managed === undefined) return [bundled]
    return [{
      ...bundled,
      cliEntry: managed.cliEntry,
      version: managed.version,
      source: 'managed',
    }, bundled]
  } catch (error) {
    const report = internals.report ?? console.error
    report('desktop managed runtime was rejected; using the bundled runtime:', error)
    await (internals.quarantine ?? quarantineManagedRuntimePointer)(bundled.runtimeRoot).catch((quarantineError: unknown) => {
      report('desktop failed to quarantine the rejected runtime pointer:', quarantineError)
    })
    return [bundled]
  }
}
