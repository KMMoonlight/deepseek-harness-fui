import { describe, expect, it, vi } from 'vitest'
import { selectRuntimeCandidates, type RuntimeSelectablePaths } from '../src/runtime-selection.ts'

const bundled: RuntimeSelectablePaths & { readonly pnpmEntry: string } = {
  runtimeRoot: '/user/dsh/desktop-runtime',
  cliEntry: '/app/host/dsh/lib/bin.js',
  version: '1.0.0',
  fuiVersion: '7.0.0',
  compatibleDshRange: '>=1.0.0 <2.0.0',
  source: 'bundled',
  pnpmEntry: '/app/host/pnpm.cjs',
}

describe('desktop runtime selection', () => {
  it('keeps the bundled runtime when no pointer is selected', async () => {
    const read = vi.fn().mockResolvedValue(undefined)
    await expect(selectRuntimeCandidates(bundled, {
      read,
    })).resolves.toEqual([bundled])
    expect(read).toHaveBeenCalledWith(bundled.runtimeRoot, {
      fuiVersion: bundled.fuiVersion,
      compatibleDshRange: bundled.compatibleDshRange,
    })
  })

  it('tries a validated managed runtime first without changing packaged process tools', async () => {
    await expect(selectRuntimeCandidates(bundled, {
      read: vi.fn().mockResolvedValue({
        version: '1.1.0',
        root: '/user/dsh/desktop-runtime/versions/1.1.0',
        cliEntry: '/user/dsh/desktop-runtime/versions/1.1.0/node_modules/@deepseek-ai/dsh/lib/bin.js',
        frontendEntry: '/user/dsh/desktop-runtime/versions/1.1.0/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html',
      }),
    })).resolves.toEqual([{
      ...bundled,
      cliEntry: '/user/dsh/desktop-runtime/versions/1.1.0/node_modules/@deepseek-ai/dsh/lib/bin.js',
      version: '1.1.0',
      source: 'managed',
    }, bundled])
  })

  it('quarantines a rejected pointer and still returns the bundled runtime', async () => {
    const quarantine = vi.fn().mockResolvedValue('/user/dsh/desktop-runtime/failed/current.json')
    const report = vi.fn()
    await expect(selectRuntimeCandidates(bundled, {
      read: vi.fn().mockRejectedValue(new Error('invalid tree')),
      quarantine,
      report,
    })).resolves.toEqual([bundled])
    expect(quarantine).toHaveBeenCalledWith(bundled.runtimeRoot)
    expect(report).toHaveBeenCalledWith(expect.stringContaining('using the bundled runtime'), expect.any(Error))
  })
})
