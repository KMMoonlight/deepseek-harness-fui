/** Client-safe request and result vocabulary for desktop plugin installation. */

/** Install one package or Git spec into the desktop FUI profile. */
export interface PluginInstallRequest {
  /** One pnpm package spec, passed as one argv value without shell parsing. */
  readonly spec: string
}

/** Successful profile installation. */
export interface PluginInstallValue {
  /** Exact normalized package spec submitted to pnpm. */
  readonly spec: string
  /** A running profile cannot mount a newly added bundle without restarting. */
  readonly restartRequired: true
  /** Bounded stdout tail emitted by the profile-management command. */
  readonly stdout: string
  /** Bounded stderr tail emitted by the profile-management command. */
  readonly stderr: string
}

/** Stable reason an installation request was not committed. */
export type PluginInstallFailureCode =
  | 'invalid-spec'
  | 'busy'
  | 'install-failed'
  | 'timed-out'

/** Business failure returned without exposing an arbitrary thrown value. */
export interface PluginInstallFailure {
  readonly code: PluginInstallFailureCode
  readonly message: string
  /** Child exit code when the package manager started and closed normally. */
  readonly exitCode?: number | null
  /** Bounded stdout tail when a child process was started. */
  readonly stdout?: string
  /** Bounded stderr tail when a child process was started. */
  readonly stderr?: string
}

/** Desktop plugin-installation outcome. */
export type PluginInstallResult =
  | { readonly ok: true; readonly value: PluginInstallValue }
  | { readonly ok: false; readonly error: PluginInstallFailure }
