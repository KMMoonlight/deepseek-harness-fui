// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeUpdateDescription, RuntimeUpdateResult } from '@deepseek-ai/dsh-api-remotes/client'
import { RuntimeUpdaterRow } from '../src/client/RuntimeUpdaterRow.tsx'
import type { RuntimeUpdaterRowInjected, RuntimeUpdaterRowProps } from '../src/client/RuntimeUpdaterRow.tsx'
import { en, type RuntimeUpdaterLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: RuntimeUpdaterLocaleKey, values?: Readonly<Record<string, unknown>>): string => {
  let value = en[key]
  for (const [name, replacement] of Object.entries(values ?? {})) {
    value = value.replace(`{${name}}`, String(replacement))
  }
  return value
}) as RuntimeUpdaterRowProps['t']

const description: RuntimeUpdateDescription = {
  packageName: '@deepseek-ai/dsh',
  currentVersion: '1.0.0',
  source: 'bundled',
  distTag: 'latest',
}

function props(overrides: Partial<RuntimeUpdaterRowInjected> = {}): RuntimeUpdaterRowProps {
  return {
    t,
    describe: vi.fn().mockResolvedValue(description),
    update: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        status: 'up-to-date', currentVersion: '1.0.0', latestVersion: '1.0.0', restartRequired: false,
      },
    }),
    ...overrides,
  } as RuntimeUpdaterRowProps
}

function failure(
  code: Exclude<RuntimeUpdateResult, { ok: true }>['error']['code'],
  output: { latestVersion?: string; stderr?: string; stdout?: string } = {},
): RuntimeUpdateResult {
  return { ok: false, error: { code, message: 'host detail', ...output } }
}

describe('RuntimeUpdaterRow', () => {
  it('loads local version facts and blocks reentry while one update is active', async () => {
    const pending = Promise.withResolvers<RuntimeUpdateResult>()
    const update = vi.fn<RuntimeUpdaterRowInjected['update']>(() => pending.promise)
    render(<RuntimeUpdaterRow {...props({ update })} />)

    const loadingButton = screen.getByRole('button', { name: en.update })
    expect(loadingButton.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(en.loading)).toBeTruthy()
    expect(await screen.findByText('1.0.0')).toBeTruthy()
    expect(screen.getByText(en.bundled)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en.update }))
    const busyButton = screen.getByRole('button', { name: en.updating })
    expect(busyButton.hasAttribute('disabled')).toBe(true)
    fireEvent.click(busyButton)
    await waitFor(() => { expect(update).toHaveBeenCalledOnce() })
    expect(update.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal)

    await act(async () => {
      pending.resolve({
        ok: true,
        value: {
          status: 'installed', currentVersion: '1.0.0', latestVersion: '1.1.0', restartRequired: true,
        },
      })
    })
    expect(screen.getByRole('status').textContent).toBe(
      en.installed.replace('{version}', '1.1.0'),
    )
  })

  it('renders the up-to-date outcome and localized managed source', async () => {
    render(<RuntimeUpdaterRow {...props({
      describe: vi.fn().mockResolvedValue({ ...description, source: 'managed' }),
    })} />)
    await screen.findByText(en.managed)
    fireEvent.click(screen.getByRole('button', { name: en.update }))
    expect((await screen.findByRole('status')).textContent).toBe(en.upToDate)
  })

  it('localizes business failures and chooses stderr, stdout, then Host diagnostics', async () => {
    const update = vi.fn<RuntimeUpdaterRowInjected['update']>()
      .mockResolvedValueOnce(failure('incompatible', { latestVersion: '1.2.0' }))
      .mockResolvedValueOnce(failure('install-failed', { stderr: ' stderr tail ', stdout: 'stdout tail' }))
      .mockResolvedValueOnce(failure('validation-failed', { stdout: ' stdout tail ' }))
      .mockResolvedValueOnce(failure('check-failed'))
      .mockResolvedValueOnce(failure('timed-out'))
      .mockResolvedValueOnce(failure('busy'))
    render(<RuntimeUpdaterRow {...props({ update })} />)
    await screen.findByText('1.0.0')

    for (const [label, diagnostic] of [
      [en.incompatible.replace('{version}', '1.2.0'), 'host detail'],
      [en.installFailed, 'stderr tail'],
      [en.validationFailed, 'stdout tail'],
      [en.checkFailed, 'host detail'],
      [en.timedOut, 'host detail'],
      [en.busy, 'host detail'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: en.update }))
      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain(label)
      fireEvent.click(screen.getByText(en.diagnostics))
      expect(screen.getByText(diagnostic)).toBeTruthy()
    }
  })

  it('contains transport failures and cancels describe or update when unmounted', async () => {
    const transport = render(<RuntimeUpdaterRow {...props({
      describe: vi.fn().mockRejectedValue(new Error('private detail')),
    })} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.transportFailed)
    expect(screen.queryByText('private detail')).toBeNull()
    transport.unmount()

    const pendingDescribe = Promise.withResolvers<RuntimeUpdateDescription>()
    let describeSignal: AbortSignal | undefined
    const reading = render(<RuntimeUpdaterRow {...props({
      describe: vi.fn((signal?: AbortSignal) => {
        describeSignal = signal
        return pendingDescribe.promise
      }),
    })} />)
    await waitFor(() => { expect(describeSignal).toBeInstanceOf(AbortSignal) })
    reading.unmount()
    expect(describeSignal?.aborted).toBe(true)
    await act(async () => { pendingDescribe.resolve(description) })

    const pendingUpdate = Promise.withResolvers<RuntimeUpdateResult>()
    let updateSignal: AbortSignal | undefined
    const updating = render(<RuntimeUpdaterRow {...props({
      update: vi.fn((signal?: AbortSignal) => {
        updateSignal = signal
        return pendingUpdate.promise
      }),
    })} />)
    await screen.findByText('1.0.0')
    fireEvent.click(screen.getByRole('button', { name: en.update }))
    await waitFor(() => { expect(updateSignal).toBeInstanceOf(AbortSignal) })
    updating.unmount()
    expect(updateSignal?.aborted).toBe(true)
    await act(async () => { pendingUpdate.reject(new Error('cancelled')) })
  })
})
