/**
 * The FUI surface claim. Marks the document as the FUI surface and loads the
 * alias bridge that repoints ui-theme's `--dsw-alias-*` layer at f-ui's
 * `--fui-*` tokens, so every stock feature package adopts the FUI palette
 * without a component edit.
 *
 * The claim is an attribute rather than an import side effect because the
 * stock and FUI surfaces share one frontend build: the stylesheet ships to
 * both, and only the surface carrying the attribute resolves it. Setting the
 * attribute is also what activates the vendored token sheet's page rule
 * (`body[data-fui-surface]`), which paints the ground, text colour, monospace
 * face, and coordinate grid.
 *
 * The bridge stylesheet itself is imported by the application build, not from
 * here: client bundles only inline `*.module.css`, and a global custom-property
 * sheet is delivered as a file in this architecture.
 */
import type { Context } from '@deepseek-ai/cordis'

/** Attribute marking the document as the FUI surface. */
const SURFACE_ATTRIBUTE = 'data-fui-surface'

/**
 * Claim the document for the FUI surface, releasing it on unload.
 * @param ctx - Cordis context; used only for its disposal lifetime.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    document.body.setAttribute(SURFACE_ATTRIBUTE, '')
    return () => { document.body.removeAttribute(SURFACE_ATTRIBUTE) }
  }, 'ui-fui-surface: document surface claim')
}
