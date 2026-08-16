# Agent Note: The Win32 folder picker stops reading display names past the terminator

Status: implemented

English | [中文](2026-08-16-win32-dialog-read-past-terminator.zh.md)

## Problem

Opening a workspace on Windows failed with `directory picker failed: win32 folder dialog worker exited before reporting a result` — the [koffi child-process picker](../feature/2026-08-02-win32-in-process-folder-dialog.md) dying without its IPC outcome. Two defects compounded into that message.

`readUtf16` extracted the selected path from the raw COM out-pointer by mapping a fixed 32 KB `koffi.view` over the string and copying it wholesale into a `Buffer`. The copy reads up to 32 KB regardless of where the NUL terminator sits — past the terminator and into heap pages that may not be mapped, where the read is a native access violation. An AV is not a JS exception: the worker process died outright, its `try`/`catch` never ran, and no `error` message reached the driver. The same scan also tested only the low byte of each UTF-16LE code unit, so a character like U+0100 (`Ā`, low byte `0x00`) would have truncated the path had the read survived.

The driver side hid all of this behind an unactionable message: it declared silent death on the child's `exit` event, which Node does not order after in-flight IPC messages, and it reported neither the exit code nor the signal.

## Decision

`readUtf16` reads one UTF-16 code unit at a time with `koffi.decode(address, offset, 'uint16')` and stops at the NUL, so it never touches memory beyond the terminator; a read that passes `MAX_DISPLAY_NAME_UNITS` (32768, the long-path ceiling) without a terminator throws a catchable error the worker reports over IPC instead of faulting. `koffi.view` leaves the bindings' koffi surface — bulk reading the string was the defect, not an implementation detail.

The driver's silent-death verdict moves from `exit` to `close`: `close` fires only after the IPC channel has drained, so any outcome the worker posted is delivered first, and the rejection names the exit code and signal. `Win32DialogWorkerLike` exposes the `close` overload in place of `exit`; the built-worker e2e makes the same substitution.

## Alternatives considered

- **Keeping the bulk `view` but scanning before copying.** Any fixed-size read still touches pages past the terminator; the AV risk is inherent to reading beyond the string, not to the copy step.
- **`koffi.decode(addr, 'str16')`.** The out-param surfaces a raw address, and the `str16` decode dereferences it as a pointer — the crash the original comment already warned about.
- **A grace macrotask between `exit` and the rejection.** `exit` carries no delivery guarantee for in-flight messages, so any fixed delay reintroduces the race under load; `close` is the documented drain point.
- **Reverting to a fallback picker tier.** The [fallback-removal decision](../simplification/2026-08-04-drop-windows-powershell-picker-fallback.md) stands: both defects were harness-side, not OS capability gaps, and the crash-isolation design worked — the host survived and reported.

## Consequences

Result extraction can no longer crash the worker: the per-unit read stops at the terminator, and the unterminated-string case fails loud as a reported error. Paths containing zero-low-byte characters round-trip intact. A worker that still dies without reporting — a spawn-level failure or a fault elsewhere — rejects with its exit code and signal, and cannot shadow an outcome that was already posted. POSIX behavior is unchanged apart from the verdict's message text.

## Testing

The fake COM heap maps exactly the display name plus its NUL terminator and throws on any read past it, so every selection test pins the per-unit bound; a zero-low-byte character round-trips, and an unterminated name rejects within the cap while still releasing the shell item and dialog. The driver suite pins that an outcome posted before `exit`-then-`close` wins over termination, and that a bare `close` rejects with the code/signal message.
