/**
 * f-ui: FUI (Fictional User Interface) styled React components, vendored from
 * https://github.com/KMMoonlight/fui under MIT.
 *
 * Vendored rather than depended on: f-ui distributes by copy (shadcn style) and
 * publishes no npm package. Every component is a self-contained file importing
 * nothing but `cn`, so the re-sync path is a plain file copy — which is also why
 * this barrel re-exports whole modules instead of naming symbols one by one.
 *
 * Presentation is Tailwind utilities over the `--fui-*` custom properties in
 * ./styles/fui.css. That utility stylesheet is built once at the application
 * layer, not here.
 */

export * from './components/accordion.tsx'
export * from './components/alert.tsx'
export * from './components/badge.tsx'
export * from './components/bar-chart.tsx'
export * from './components/breadcrumbs.tsx'
export * from './components/button.tsx'
export * from './components/card.tsx'
export * from './components/carousel.tsx'
export * from './components/checkbox.tsx'
export * from './components/dialog.tsx'
export * from './components/divider.tsx'
export * from './components/dropdown-menu.tsx'
export * from './components/empty-state.tsx'
export * from './components/input.tsx'
export * from './components/label.tsx'
export * from './components/line-chart.tsx'
export * from './components/list.tsx'
export * from './components/loading.tsx'
export * from './components/notification-stack.tsx'
export * from './components/notification.tsx'
export * from './components/pagination.tsx'
export * from './components/panel.tsx'
export * from './components/progress-bar.tsx'
export * from './components/progress-indicator.tsx'
export * from './components/radio.tsx'
export * from './components/screen-effects.tsx'
export * from './components/segmented-control.tsx'
export * from './components/select.tsx'
export * from './components/slider.tsx'
export * from './components/stepper.tsx'
export * from './components/switch.tsx'
export * from './components/table.tsx'
export * from './components/tabs.tsx'
export * from './components/text.tsx'
export * from './components/textarea.tsx'
export * from './components/tooltip.tsx'
export * from './components/treeview.tsx'
export * from './components/wireframe.tsx'

export { cn } from './lib/cn.ts'
