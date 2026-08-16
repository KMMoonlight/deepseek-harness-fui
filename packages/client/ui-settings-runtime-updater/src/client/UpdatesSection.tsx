import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  RuntimeUpdateCheckResult,
  RuntimeUpdateDescription,
  RuntimeUpdateResult,
} from '@deepseek-ai/dsh-host-runtime-updater/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RuntimeUpdaterLocaleKey } from './locales.ts'
import css from './UpdatesSection.module.css'

/** Registration-side Remote face used by the Updates settings section. */
export interface UpdatesSectionInjected {
  /** Read current runtime facts without starting a registry request. */
  describe: (signal?: AbortSignal) => Promise<RuntimeUpdateDescription>
  /** Query the configured npm tag without installing anything. */
  check: (signal?: AbortSignal) => Promise<RuntimeUpdateCheckResult>
  /** Check and install a compatible newer runtime, cancelling on unmount. */
  update: (signal?: AbortSignal) => Promise<RuntimeUpdateResult>
}

/** Full component props assembled by the settings section slot renderer. */
export type UpdatesSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.runtimeUpdater'>
  & InjectFace<UpdatesSectionInjected>

type FailureCode = Exclude<RuntimeUpdateResult, { ok: true }>['error']['code'] | 'transport'

type CheckState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'checking' }
  | { readonly phase: 'done'; readonly value: Extract<RuntimeUpdateCheckResult, { ok: true }>['value'] }
  | { readonly phase: 'failed'; readonly code: FailureCode }

type UpdateState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'updating' }
  | { readonly phase: 'installed'; readonly version: string }
  | { readonly phase: 'failed'; readonly code: FailureCode }

const FAILURE_KEYS = {
  busy: 'busy',
  'check-failed': 'checkFailed',
  incompatible: 'incompatible',
  'install-failed': 'installFailed',
  'validation-failed': 'validationFailed',
  'timed-out': 'timedOut',
  transport: 'transportFailed',
} satisfies Record<FailureCode, RuntimeUpdaterLocaleKey>

/** Render the desktop-only Updates settings section: current version, latest version, one check button. */
export function UpdatesSection({ describe, check, update, t }: UpdatesSectionProps): ReactNode {
  const [description, setDescription] = useState<RuntimeUpdateDescription>()
  const [describeFailed, setDescribeFailed] = useState(false)
  const [checkState, setCheckState] = useState<CheckState>({ phase: 'idle' })
  const [updateState, setUpdateState] = useState<UpdateState>({ phase: 'idle' })
  const active = useRef<AbortController | undefined>()

  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    void Promise.resolve().then(() => describe(controller.signal)).then(
      (value) => {
        if (active.current !== controller) return
        active.current = undefined
        setDescription(value)
      },
      () => {
        if (active.current !== controller) return
        active.current = undefined
        setDescribeFailed(true)
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

  const busy = checkState.phase === 'checking' || updateState.phase === 'updating'
  const runCheck = (): void => {
    /* v8 ignore next -- both buttons disable while busy, so this guard only sees programmatic dispatch */
    if (busy) return
    const controller = new AbortController()
    active.current = controller
    setCheckState({ phase: 'checking' })
    void Promise.resolve().then(() => check(controller.signal)).then(
      (result) => {
        if (active.current !== controller) return
        active.current = undefined
        setCheckState(result.ok
          ? { phase: 'done', value: result.value }
          : { phase: 'failed', code: result.error.code })
      },
      () => {
        if (active.current !== controller) return
        active.current = undefined
        setCheckState({ phase: 'failed', code: 'transport' })
      },
    )
  }
  const runUpdate = (): void => {
    /* v8 ignore next -- both buttons disable while busy, so this guard only sees programmatic dispatch */
    if (busy) return
    const controller = new AbortController()
    active.current = controller
    setUpdateState({ phase: 'updating' })
    void Promise.resolve().then(() => update(controller.signal)).then(
      (result) => {
        if (active.current !== controller) return
        active.current = undefined
        if (result.ok) {
          setUpdateState(result.value.status === 'installed'
            ? { phase: 'installed', version: result.value.latestVersion }
            : { phase: 'idle' })
          setCheckState({ phase: 'done', value: {
            currentVersion: result.value.currentVersion,
            latestVersion: result.value.latestVersion,
            updateAvailable: false,
            compatible: true,
          } })
          return
        }
        setUpdateState({ phase: 'failed', code: result.error.code })
      },
      () => {
        if (active.current !== controller) return
        active.current = undefined
        setUpdateState({ phase: 'failed', code: 'transport' })
      },
    )
  }

  const updateOffered = checkState.phase === 'done' && checkState.value.updateAvailable
  const updateCompatible = updateOffered && checkState.value.compatible
  const failureCode: FailureCode | undefined = checkState.phase === 'failed' ? checkState.code
    : updateState.phase === 'failed' ? updateState.code
      : describeFailed ? 'transport'
        : undefined
  // `incompatible` reaches the UI only after a completed check (the update
  // button requires one), so the latest version and range are always known.
  /* v8 ignore next -- a completed check implies a loaded description; the fallback only appeases the type */
  const offeredRange = description?.compatibleDshRange ?? ''
  const failureText = failureCode === undefined ? undefined
    : failureCode === 'incompatible' && checkState.phase === 'done'
      ? t('incompatible', { version: checkState.value.latestVersion, range: offeredRange })
      : t(FAILURE_KEYS[failureCode])

  return (
    <section className={css.section} aria-busy={description === undefined || busy}>
      <h2 className={css.title}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <dl className={css.version}>
        <dt>{t('currentVersion')}</dt>
        <dd>
          {description === undefined
            ? t(describeFailed ? 'transportFailed' : 'loading')
            : <><code>{description.currentVersion}</code><span>{t(description.source)}</span></>}
        </dd>
        <dt>{t('latestVersion')}</dt>
        <dd>
          {checkState.phase === 'idle' ? t('unchecked')
            : checkState.phase === 'checking' ? t('checking')
              : checkState.phase === 'done' ? <code>{checkState.value.latestVersion}</code>
                : '—'}
        </dd>
      </dl>
      <div className={css.actions}>
        <button type="button" className={css.secondary} disabled={description === undefined || busy} onClick={runCheck}>
          {t(checkState.phase === 'checking' ? 'checking' : 'check')}
        </button>
        {updateCompatible && updateState.phase !== 'installed' ? (
          <button type="button" className={css.primary} disabled={busy} onClick={runUpdate}>
            {t(updateState.phase === 'updating' ? 'updating' : 'update')}
          </button>
        ) : null}
      </div>
      {updateState.phase === 'installed' ? (
        <p className={css.success} role="status">{t('installed', { version: updateState.version })}</p>
      ) : null}
      {checkState.phase === 'done' && !checkState.value.updateAvailable && updateState.phase !== 'installed' ? (
        <p className={css.success} role="status">{t('upToDate')}</p>
      ) : null}
      {updateOffered && !updateCompatible ? (
        <p className={css.failure} role="alert">
          {t('incompatible', { version: checkState.value.latestVersion, range: offeredRange })}
        </p>
      ) : null}
      {failureText !== undefined && !(updateOffered && !updateCompatible) ? (
        <p className={css.failure} role="alert">{failureText}</p>
      ) : null}
    </section>
  )
}
