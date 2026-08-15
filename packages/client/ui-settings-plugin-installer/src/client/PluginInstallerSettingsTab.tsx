import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { PluginInstallResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginInstallerLocaleKey } from './locales.ts'
import css from './PluginInstallerSettingsTab.module.css'

/** Registration-side Remote face used by the installer form. */
export interface PluginInstallerSettingsTabInjected {
  /** Install one package spec, cancelling it when the form leaves the page. */
  install: (spec: string, signal?: AbortSignal) => Promise<PluginInstallResult>
}

/** Full component props assembled by the Settings slot renderer. */
export type PluginInstallerSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginInstaller'>
  & InjectFace<PluginInstallerSettingsTabInjected>

type ViewState =
  | { readonly status: 'idle' }
  | { readonly status: 'installing' }
  | { readonly status: 'success'; readonly spec: string }
  | { readonly status: 'failure'; readonly code: 'transport' | Exclude<PluginInstallResult, { ok: true }>['error']['code']; readonly diagnostic: string }

const FAILURE_KEYS = {
  'invalid-spec': 'invalidSpec',
  busy: 'busy',
  'install-failed': 'installFailed',
  'timed-out': 'timedOut',
  transport: 'transportFailed',
} satisfies Record<Extract<ViewState, { status: 'failure' }>['code'], PluginInstallerLocaleKey>

/** Prefer package-manager stderr while retaining a Host explanation as fallback. */
function diagnostic(result: Exclude<PluginInstallResult, { ok: true }>): string {
  return result.error.stderr?.trim()
    || result.error.stdout?.trim()
    || result.error.message
}

/** Render the desktop-only plugin installation form. */
export function PluginInstallerSettingsTab({ install, t }: PluginInstallerSettingsTabProps): ReactNode {
  const [spec, setSpec] = useState('')
  const [state, setState] = useState<ViewState>({ status: 'idle' })
  const active = useRef<AbortController | undefined>()

  useEffect(() => () => {
    const controller = active.current
    active.current = undefined
    controller?.abort()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (state.status === 'installing' || spec.trim().length === 0) return
    const controller = new AbortController()
    active.current = controller
    setState({ status: 'installing' })
    void Promise.resolve().then(() => install(spec, controller.signal)).then(
      (result) => {
        if (active.current !== controller) return
        active.current = undefined
        if (result.ok) setState({ status: 'success', spec: result.value.spec })
        else setState({ status: 'failure', code: result.error.code, diagnostic: diagnostic(result) })
      },
      () => {
        if (active.current !== controller) return
        active.current = undefined
        setState({ status: 'failure', code: 'transport', diagnostic: '' })
      },
    )
  }

  const installing = state.status === 'installing'
  return (
    <section className={css.section} aria-busy={installing}>
      <div className={css.heading}>
        <h3>{t('title')}</h3>
        <p>{t('description')}</p>
      </div>
      <form className={css.form} onSubmit={submit}>
        <label htmlFor="dsh-plugin-install-spec">{t('specLabel')}</label>
        <div className={css.commandRow}>
          <input
            id="dsh-plugin-install-spec"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={spec}
            placeholder={t('specPlaceholder')}
            disabled={installing}
            onChange={(event) => {
              setSpec(event.currentTarget.value)
              if (state.status !== 'idle' && state.status !== 'installing') setState({ status: 'idle' })
            }}
          />
          <button type="submit" disabled={installing || spec.trim().length === 0}>
            {t(installing ? 'installing' : 'install')}
          </button>
        </div>
        <p className={css.warning}>{t('trustWarning')}</p>
      </form>
      {state.status === 'success' ? (
        <div className={css.success} role="status">
          <strong>{t('success')}</strong>
          <code>{state.spec}</code>
          <p>{t('restart')}</p>
        </div>
      ) : null}
      {state.status === 'failure' ? (
        <div className={css.failure} role="alert">
          <strong>{t(FAILURE_KEYS[state.code])}</strong>
          {state.diagnostic === '' ? null : (
            <details>
              <summary>{t('diagnostics')}</summary>
              <pre>{state.diagnostic}</pre>
            </details>
          )}
        </div>
      ) : null}
    </section>
  )
}
