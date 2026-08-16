import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  RuntimeUpdateDescription,
  RuntimeUpdateResult,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RuntimeUpdaterLocaleKey } from './locales.ts'
import css from './RuntimeUpdaterRow.module.css'

/** Registration-side Remote face used by the desktop runtime row. */
export interface RuntimeUpdaterRowInjected {
  /** Read current runtime facts without starting a registry request. */
  describe: (signal?: AbortSignal) => Promise<RuntimeUpdateDescription>
  /** Check and install a compatible newer runtime, cancelling on unmount. */
  update: (signal?: AbortSignal) => Promise<RuntimeUpdateResult>
}

/** Full component props assembled by the General settings slot renderer. */
export type RuntimeUpdaterRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.runtimeUpdater'>
  & InjectFace<RuntimeUpdaterRowInjected>

type FailureCode = Exclude<RuntimeUpdateResult, { ok: true }>['error']['code'] | 'transport'

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly description: RuntimeUpdateDescription }
  | { readonly status: 'updating'; readonly description: RuntimeUpdateDescription }
  | { readonly status: 'up-to-date'; readonly description: RuntimeUpdateDescription }
  | { readonly status: 'installed'; readonly description: RuntimeUpdateDescription; readonly version: string }
  | {
    readonly status: 'failure'
    readonly description?: RuntimeUpdateDescription
    readonly code: FailureCode
    readonly version?: string
    readonly diagnostic: string
  }

const FAILURE_KEYS = {
  busy: 'busy',
  'check-failed': 'checkFailed',
  incompatible: 'incompatible',
  'install-failed': 'installFailed',
  'validation-failed': 'validationFailed',
  'timed-out': 'timedOut',
  transport: 'transportFailed',
} satisfies Record<FailureCode, RuntimeUpdaterLocaleKey>

/** Render the desktop-only managed runtime update row. */
export function RuntimeUpdaterRow({ describe, update, t }: RuntimeUpdaterRowProps): ReactNode {
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const active = useRef<AbortController | undefined>()

  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    void Promise.resolve().then(() => describe(controller.signal)).then(
      (description) => {
        if (active.current !== controller) return
        active.current = undefined
        setState({ status: 'ready', description })
      },
      () => {
        if (active.current !== controller) return
        active.current = undefined
        setState({ status: 'failure', code: 'transport', diagnostic: '' })
      },
    )
    return () => {
      if (active.current === controller) active.current = undefined
      controller.abort()
    }
  }, [describe])

  useEffect(() => () => {
    const controller = active.current
    active.current = undefined
    controller?.abort()
  }, [])

  const description = 'description' in state ? state.description : undefined
  const updating = state.status === 'updating'
  const runUpdate = (): void => {
    if (description === undefined || updating) return
    const controller = new AbortController()
    active.current = controller
    setState({ status: 'updating', description })
    void Promise.resolve().then(() => update(controller.signal)).then(
      (result) => {
        if (active.current !== controller) return
        active.current = undefined
        if (result.ok) {
          setState(result.value.status === 'installed'
            ? { status: 'installed', description, version: result.value.latestVersion }
            : { status: 'up-to-date', description })
          return
        }
        setState({
          status: 'failure',
          description,
          code: result.error.code,
          ...(result.error.latestVersion === undefined ? {} : { version: result.error.latestVersion }),
          diagnostic: result.error.stderr?.trim()
            || result.error.stdout?.trim()
            || result.error.message,
        })
      },
      () => {
        if (active.current !== controller) return
        active.current = undefined
        setState({ status: 'failure', description, code: 'transport', diagnostic: '' })
      },
    )
  }

  const failureText = state.status === 'failure'
    ? (state.code === 'incompatible' && state.version !== undefined
      ? t('incompatible', { version: state.version })
      : t(FAILURE_KEYS[state.code]))
    : undefined

  return (
    <section className={css.section} aria-busy={state.status === 'loading' || updating}>
      <div className={css.heading}>
        <div>
          <h3>{t('title')}</h3>
          <p>{t('description')}</p>
        </div>
        <button type="button" disabled={description === undefined || updating} onClick={runUpdate}>
          {t(updating ? 'updating' : 'update')}
        </button>
      </div>
      {description === undefined ? (
        <p className={css.loading}>{t('loading')}</p>
      ) : (
        <dl className={css.version}>
          <dt>{t('currentVersion')}</dt>
          <dd><code>{description.currentVersion}</code><span>{t(description.source)}</span></dd>
        </dl>
      )}
      {state.status === 'up-to-date' ? <p className={css.success} role="status">{t('upToDate')}</p> : null}
      {state.status === 'installed' ? (
        <p className={css.success} role="status">{t('installed', { version: state.version })}</p>
      ) : null}
      {state.status === 'failure' ? (
        <div className={css.failure} role="alert">
          <strong>{failureText}</strong>
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
