// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  RuntimeUpdateCheckResult,
  RuntimeUpdateDescription,
  RuntimeUpdateResult,
} from '@deepseek-ai/dsh-host-runtime-updater/types'
import { UpdatesSection } from '../src/client/UpdatesSection.tsx'
import type { UpdatesSectionInjected, UpdatesSectionProps } from '../src/client/UpdatesSection.tsx'
import { en, type RuntimeUpdaterLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: RuntimeUpdaterLocaleKey, values?: Readonly<Record<string, unknown>>): string => {
  let value = en[key]
  for (const [name, replacement] of Object.entries(values ?? {})) {
    value = value.replace(`{${name}}`, String(replacement))
  }
  return value
}) as UpdatesSectionProps['t']

const description: RuntimeUpdateDescription = {
  packageName: '@deepseek-ai/dsh',
  currentVersion: '1.0.0',
  fuiVersion: '7.0.0',
  compatibleDshRange: '>=1.0.0 <2.0.0',
  source: 'bundled',
  distTag: 'latest',
}

function checkValue(latestVersion: string, updateAvailable: boolean, compatible = true): RuntimeUpdateCheckResult {
  return { ok: true, value: { currentVersion: '1.0.0', latestVersion, updateAvailable, compatible } }
}

function props(overrides: Partial<UpdatesSectionInjected> = {}): UpdatesSectionProps {
  return {
    t,
    describe: vi.fn().mockResolvedValue(description),
    check: vi.fn().mockResolvedValue(checkValue('1.0.0', false)),
    update: vi.fn().mockResolvedValue({
      ok: true,
      value: { status: 'up-to-date', currentVersion: '1.0.0', latestVersion: '1.0.0', restartRequired: false },
    }),
    ...overrides,
  } as UpdatesSectionProps
}

describe('UpdatesSection', () => {
  it('shows the current version, an unchecked latest row, and checks on demand', async () => {
    const check = vi.fn<UpdatesSectionInjected['check']>().mockResolvedValue(checkValue('1.1.0', true))
    render(<UpdatesSection {...props({ check })} />)

    expect(screen.getByText(en.unchecked)).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.update })).toBeNull()
    expect(await screen.findByText('1.0.0')).toBeTruthy()
    expect(screen.getByText(en.bundled)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en.check }))
    expect(await screen.findByText('1.1.0')).toBeTruthy()
    expect(check).toHaveBeenCalledOnce()
    expect(check.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal)
    expect(screen.getByRole('button', { name: en.update })).toBeTruthy()
  })

  it('reports up-to-date when the tag names the running version', async () => {
    render(<UpdatesSection {...props()} />)
    await screen.findByText('1.0.0')
    fireEvent.click(screen.getByRole('button', { name: en.check }))
    expect((await screen.findByRole('status')).textContent).toBe(en.upToDate)
    expect(screen.queryByRole('button', { name: en.update })).toBeNull()
  })

  it('explains an available but incompatible release instead of offering the update', async () => {
    render(<UpdatesSection {...props({
      check: vi.fn().mockResolvedValue(checkValue('2.0.0', true, false)),
    })} />)
    await screen.findByText('1.0.0')
    fireEvent.click(screen.getByRole('button', { name: en.check }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
      en.incompatible.replace('{version}', '2.0.0').replace('{range}', description.compatibleDshRange),
    )
    expect(screen.queryByRole('button', { name: en.update })).toBeNull()
  })

  it('installs an offered update and asks for a full restart', async () => {
    const update = vi.fn<UpdatesSectionInjected['update']>().mockResolvedValue({
      ok: true,
      value: { status: 'installed', currentVersion: '1.0.0', latestVersion: '1.1.0', restartRequired: true },
    })
    render(<UpdatesSection {...props({
      check: vi.fn().mockResolvedValue(checkValue('1.1.0', true)),
      update,
    })} />)
    await screen.findByText('1.0.0')
    fireEvent.click(screen.getByRole('button', { name: en.check }))
    fireEvent.click(await screen.findByRole('button', { name: en.update }))
    expect((await screen.findByRole('status')).textContent).toBe(
      en.installed.replace('{version}', '1.1.0'),
    )
    expect(update).toHaveBeenCalledOnce()
  })

  it('localizes check and update failures without exposing host detail', async () => {
    const check = vi.fn<UpdatesSectionInjected['check']>()
      .mockResolvedValueOnce({ ok: false, error: { code: 'check-failed', message: 'host detail' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'timed-out', message: 'host detail' } })
      .mockRejectedValueOnce(new Error('private detail'))
    const first = render(<UpdatesSection {...props({ check })} />)
    await screen.findByText('1.0.0')

    for (const label of [en.checkFailed, en.timedOut, en.transportFailed]) {
      fireEvent.click(first.getByRole('button', { name: en.check }))
      expect((await first.findByRole('alert')).textContent).toBe(label)
    }
    expect(screen.queryByText('private detail')).toBeNull()
    first.unmount()

    const update = vi.fn<UpdatesSectionInjected['update']>()
      .mockResolvedValueOnce({ ok: false, error: { code: 'install-failed', message: 'host detail' } })
      .mockRejectedValueOnce(new Error('private detail'))
    const second = render(<UpdatesSection {...props({
      check: vi.fn().mockResolvedValue(checkValue('1.1.0', true)),
      update,
    })} />)
    await second.findByText('1.0.0')
    fireEvent.click(second.getByRole('button', { name: en.check }))
    const updateButton = await second.findByRole('button', { name: en.update })
    fireEvent.click(updateButton)
    expect((await second.findByRole('alert')).textContent).toBe(en.installFailed)
    fireEvent.click(await second.findByRole('button', { name: en.update }))
    expect((await second.findByRole('alert')).textContent).toBe(en.transportFailed)
  })

  it('surfaces a describe transport failure and cancels in-flight calls on unmount', async () => {
    const failing = render(<UpdatesSection {...props({
      describe: vi.fn().mockRejectedValue(new Error('private detail')),
    })} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.transportFailed)
    failing.unmount()

    const pendingDescribe = Promise.withResolvers<RuntimeUpdateDescription>()
    let describeSignal: AbortSignal | undefined
    const reading = render(<UpdatesSection {...props({
      describe: vi.fn((signal?: AbortSignal) => {
        describeSignal = signal
        return pendingDescribe.promise
      }),
    })} />)
    await waitFor(() => { expect(describeSignal).toBeInstanceOf(AbortSignal) })
    reading.unmount()
    expect(describeSignal?.aborted).toBe(true)
    await act(async () => { pendingDescribe.resolve(description) })

    const pendingCheck = Promise.withResolvers<RuntimeUpdateCheckResult>()
    let checkSignal: AbortSignal | undefined
    const checking = render(<UpdatesSection {...props({
      check: vi.fn((signal?: AbortSignal) => {
        checkSignal = signal
        return pendingCheck.promise
      }),
    })} />)
    await screen.findByText('1.0.0')
    fireEvent.click(checking.getByRole('button', { name: en.check }))
    await waitFor(() => { expect(checkSignal).toBeInstanceOf(AbortSignal) })
    checking.unmount()
    expect(checkSignal?.aborted).toBe(true)
    await act(async () => { pendingCheck.resolve(checkValue('1.0.0', false)) })
  })

  it('reflects an up-to-date update outcome on the latest row', async () => {
    render(<UpdatesSection {...props({
      check: vi.fn().mockResolvedValue(checkValue('1.1.0', true)),
    })} />)
    await screen.findByText('1.0.0')
    fireEvent.click(screen.getByRole('button', { name: en.check }))
    fireEvent.click(await screen.findByRole('button', { name: en.update }))
    expect((await screen.findByRole('status')).textContent).toBe(en.upToDate)
    expect(screen.queryByRole('button', { name: en.update })).toBeNull()
  })

  it('interpolates an incompatible update failure with the checked version', async () => {
    const update = vi.fn<UpdatesSectionInjected['update']>().mockResolvedValue({
      ok: false,
      error: { code: 'incompatible', message: 'host detail', latestVersion: '1.1.0' },
    })
    render(<UpdatesSection {...props({
      check: vi.fn().mockResolvedValue(checkValue('1.1.0', true)),
      update,
    })} />)
    await screen.findByText('1.0.0')
    fireEvent.click(screen.getByRole('button', { name: en.check }))
    fireEvent.click(await screen.findByRole('button', { name: en.update }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      en.incompatible.replace('{version}', '1.1.0').replace('{range}', description.compatibleDshRange),
    )
  })

  it('ignores completions that settle after unmount', async () => {
    const pendingDescribe = Promise.withResolvers<RuntimeUpdateDescription>()
    const first = render(<UpdatesSection {...props({
      describe: vi.fn(() => pendingDescribe.promise),
    })} />)
    first.unmount()
    await act(async () => { pendingDescribe.reject(new Error('late')) })

    const pendingCheck = Promise.withResolvers<RuntimeUpdateCheckResult>()
    const second = render(<UpdatesSection {...props({
      check: vi.fn(() => pendingCheck.promise),
    })} />)
    await second.findByText('1.0.0')
    fireEvent.click(second.getByRole('button', { name: en.check }))
    second.unmount()
    await act(async () => { pendingCheck.reject(new Error('late')) })

    const pendingUpdate = Promise.withResolvers<RuntimeUpdateResult>()
    const third = render(<UpdatesSection {...props({
      check: vi.fn().mockResolvedValue(checkValue('1.1.0', true)),
      update: vi.fn(() => pendingUpdate.promise),
    })} />)
    await third.findByText('1.0.0')
    fireEvent.click(third.getByRole('button', { name: en.check }))
    fireEvent.click(await third.findByRole('button', { name: en.update }))
    third.unmount()
    await act(async () => {
      pendingUpdate.resolve({
        ok: true,
        value: { status: 'installed', currentVersion: '1.0.0', latestVersion: '1.1.0', restartRequired: true },
      })
    })

    const pendingLateUpdate = Promise.withResolvers<RuntimeUpdateResult>()
    const fourth = render(<UpdatesSection {...props({
      check: vi.fn().mockResolvedValue(checkValue('1.1.0', true)),
      update: vi.fn(() => pendingLateUpdate.promise),
    })} />)
    await fourth.findByText('1.0.0')
    fireEvent.click(fourth.getByRole('button', { name: en.check }))
    fireEvent.click(await fourth.findByRole('button', { name: en.update }))
    fourth.unmount()
    await act(async () => { pendingLateUpdate.reject(new Error('late')) })
  })

  it('ignores further clicks while a check or update is in flight', async () => {
    const pending = Promise.withResolvers<RuntimeUpdateCheckResult>()
    const check = vi.fn<UpdatesSectionInjected['check']>(() => pending.promise)
    render(<UpdatesSection {...props({ check })} />)
    await screen.findByText('1.0.0')

    fireEvent.click(screen.getByRole('button', { name: en.check }))
    const busyButton = screen.getByRole('button', { name: en.checking })
    expect(busyButton.hasAttribute('disabled')).toBe(true)
    fireEvent.click(busyButton)
    await waitFor(() => { expect(check).toHaveBeenCalledOnce() })
    await act(async () => { pending.resolve(checkValue('1.0.0', false)) })
  })
})
