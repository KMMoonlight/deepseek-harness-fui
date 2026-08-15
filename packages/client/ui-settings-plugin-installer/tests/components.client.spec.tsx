// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PluginInstallResult } from '@deepseek-ai/dsh-api-remotes/client'
import { PluginInstallerSettingsTab } from '../src/client/PluginInstallerSettingsTab.tsx'
import type {
  PluginInstallerSettingsTabInjected,
  PluginInstallerSettingsTabProps,
} from '../src/client/PluginInstallerSettingsTab.tsx'
import { en, type PluginInstallerLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: PluginInstallerLocaleKey): string => en[key]) as PluginInstallerSettingsTabProps['t']

function props(install: PluginInstallerSettingsTabInjected['install']): PluginInstallerSettingsTabProps {
  return { t, install } as PluginInstallerSettingsTabProps
}

const success = (spec: string): PluginInstallResult => ({
  ok: true,
  value: { spec, restartRequired: true, stdout: 'done', stderr: '' },
})

const failure = (
  code: 'invalid-spec' | 'busy' | 'install-failed' | 'timed-out',
  output: { stderr?: string; stdout?: string } = {},
): PluginInstallResult => ({
  ok: false,
  error: { code, message: 'host detail', ...output },
})

describe('PluginInstallerSettingsTab', () => {
  it('submits one spec, blocks reentry, and renders the restart result', async () => {
    const pending = Promise.withResolvers<PluginInstallResult>()
    const install = vi.fn<PluginInstallerSettingsTabInjected['install']>(() => pending.promise)
    render(<PluginInstallerSettingsTab {...props(install)} />)

    const input = screen.getByRole('textbox', { name: en.specLabel })
    const button = screen.getByRole('button', { name: en.install })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.submit(input.closest('form')!)
    expect(install).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '@scope/plugin@latest' } })
    fireEvent.click(button)
    expect((await screen.findByRole('button', { name: en.installing })).hasAttribute('disabled')).toBe(true)
    fireEvent.submit(input.closest('form')!)
    expect(install).toHaveBeenCalledOnce()
    expect(install.mock.calls[0]?.[0]).toBe('@scope/plugin@latest')
    expect(install.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)

    await act(async () => { pending.resolve(success('@scope/plugin@1.2.3')) })
    expect(screen.getByRole('status').textContent).toContain(en.success)
    expect(screen.getByRole('status').textContent).toContain('@scope/plugin@1.2.3')
    expect(screen.getByRole('status').textContent).toContain(en.restart)

    fireEvent.change(input, { target: { value: '@scope/another' } })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('localizes business failures and chooses stderr, stdout, then Host diagnostics', async () => {
    const install = vi.fn<PluginInstallerSettingsTabInjected['install']>()
      .mockResolvedValueOnce(failure('install-failed', { stderr: ' stderr tail ', stdout: 'stdout tail' }))
      .mockResolvedValueOnce(failure('timed-out', { stdout: ' stdout tail ' }))
      .mockResolvedValueOnce(failure('invalid-spec'))
      .mockResolvedValueOnce(failure('busy'))
    render(<PluginInstallerSettingsTab {...props(install)} />)
    const input = screen.getByRole('textbox', { name: en.specLabel })

    for (const [value, label, diagnostic] of [
      ['one', en.installFailed, 'stderr tail'],
      ['two', en.timedOut, 'stdout tail'],
      ['three', en.invalidSpec, 'host detail'],
      ['four', en.busy, 'host detail'],
    ] as const) {
      fireEvent.change(input, { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: en.install }))
      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain(label)
      fireEvent.click(screen.getByText(en.diagnostics))
      expect(screen.getByText(diagnostic)).toBeTruthy()
    }
  })

  it('contains transport failures and cancels an installation when unmounted', async () => {
    const transport = vi.fn<PluginInstallerSettingsTabInjected['install']>().mockRejectedValue(new Error('private detail'))
    const failed = render(<PluginInstallerSettingsTab {...props(transport)} />)
    fireEvent.change(screen.getByRole('textbox', { name: en.specLabel }), { target: { value: 'pkg' } })
    fireEvent.click(screen.getByRole('button', { name: en.install }))
    expect((await screen.findByRole('alert')).textContent).toBe(en.transportFailed)
    expect(screen.queryByText('private detail')).toBeNull()
    failed.unmount()

    const pending = Promise.withResolvers<PluginInstallResult>()
    let signal: AbortSignal | undefined
    const install = vi.fn((_spec: string, next?: AbortSignal) => {
      signal = next
      return pending.promise
    })
    const mounted = render(<PluginInstallerSettingsTab {...props(install)} />)
    fireEvent.change(screen.getByRole('textbox', { name: en.specLabel }), { target: { value: 'pkg' } })
    fireEvent.click(screen.getByRole('button', { name: en.install }))
    await waitFor(() => { expect(signal).toBeInstanceOf(AbortSignal) })
    mounted.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { pending.resolve(success('pkg')) })

    const rejected = Promise.withResolvers<PluginInstallResult>()
    const rejecting = render(<PluginInstallerSettingsTab {...props(() => rejected.promise)} />)
    fireEvent.change(screen.getByRole('textbox', { name: en.specLabel }), { target: { value: 'pkg' } })
    fireEvent.click(screen.getByRole('button', { name: en.install }))
    rejecting.unmount()
    await act(async () => { rejected.reject(new Error('request cancelled')) })
  })
})
