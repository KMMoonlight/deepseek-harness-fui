/** Client-safe request and result vocabulary for desktop runtime updates. */

/** Runtime source selected for the current desktop Host. */
export type DesktopRuntimeSource = 'bundled' | 'managed'

/** Empty request for reading the desktop runtime version. */
export interface RuntimeUpdateDescribeRequest {
  /** Marker field: the request intentionally carries no renderer-controlled input. */
  readonly request?: never
}

/** Current desktop runtime facts. */
export interface RuntimeUpdateDescription {
  /** Exact npm package whose dist-tag is checked. */
  readonly packageName: string
  /** Version serving the current renderer and Host. */
  readonly currentVersion: string
  /** FUI overlay version supplied by the immutable desktop application. */
  readonly fuiVersion: string
  /** Official DSH versions this desktop FUI release can compose with. */
  readonly compatibleDshRange: string
  /** Whether the current Host came from application resources or managed storage. */
  readonly source: DesktopRuntimeSource
  /** npm dist-tag selected by this desktop deployment. */
  readonly distTag: string
}

/** Empty one-click request that checks and installs when a compatible update exists. */
export interface RuntimeUpdateRequest {
  /** Marker field: package identity, tag, and destination are Host configuration. */
  readonly request?: never
}

/** Empty request for a check-only release query. */
export interface RuntimeUpdateCheckRequest {
  /** Marker field: the request intentionally carries no renderer-controlled input. */
  readonly request?: never
}

/** What the configured npm tag currently offers, reported without installing. */
export interface RuntimeUpdateCheckValue {
  /** Version serving the current renderer and Host. */
  readonly currentVersion: string
  /** Version the configured dist-tag currently names. */
  readonly latestVersion: string
  /** Whether latestVersion is strictly newer than currentVersion. */
  readonly updateAvailable: boolean
  /** Whether latestVersion satisfies this desktop's compatible DSH range. */
  readonly compatible: boolean
}

/** Check-only outcome or a stable business failure. */
export type RuntimeUpdateCheckResult =
  | { readonly ok: true; readonly value: RuntimeUpdateCheckValue }
  | { readonly ok: false; readonly error: RuntimeUpdateFailure }

/** Successful one-click update result. */
export type RuntimeUpdateValue =
  | {
    readonly status: 'up-to-date'
    readonly currentVersion: string
    readonly latestVersion: string
    readonly restartRequired: false
  }
  | {
    readonly status: 'installed'
    readonly currentVersion: string
    readonly latestVersion: string
    readonly restartRequired: true
  }

/** Stable reason a runtime update was not committed. */
export type RuntimeUpdateFailureCode =
  | 'busy'
  | 'check-failed'
  | 'incompatible'
  | 'install-failed'
  | 'validation-failed'
  | 'timed-out'

/** Business failure returned without exposing arbitrary thrown values. */
export interface RuntimeUpdateFailure {
  readonly code: RuntimeUpdateFailureCode
  readonly message: string
  /** Registry version that failed compatibility or installation, when known. */
  readonly latestVersion?: string
  /** Child exit code when a package-manager or validation process settled. */
  readonly exitCode?: number | null
  /** Bounded stdout tail when a child process was started. */
  readonly stdout?: string
  /** Bounded stderr tail when a child process was started. */
  readonly stderr?: string
}

/** Desktop runtime update outcome. */
export type RuntimeUpdateResult =
  | { readonly ok: true; readonly value: RuntimeUpdateValue }
  | { readonly ok: false; readonly error: RuntimeUpdateFailure }
