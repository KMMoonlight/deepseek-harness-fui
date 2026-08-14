// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, Panel, ProgressBar, cn } from '@deepseek-ai/dsh-client-ui-fui'

afterEach(cleanup)

describe('vendored f-ui components', () => {
  it('renders a Button and forwards clicks', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>ENGAGE</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'ENGAGE' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled Button blocks interaction', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>NO</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders a Panel with its title and children', () => {
    render(<Panel title="SHIP STATUS"><span>HULL</span></Panel>)
    expect(screen.getByText('SHIP STATUS')).toBeDefined()
    expect(screen.getByText('HULL')).toBeDefined()
  })

  it('renders a ProgressBar carrying its value text', () => {
    render(<ProgressBar label="FUEL" value={46} valueText="46/100" />)
    expect(screen.getByText('46/100')).toBeDefined()
  })
})

describe('cn', () => {
  it('merges conflicting tailwind utilities last-wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy inputs', () => {
    expect(cn('border', false && 'hidden', undefined)).toBe('border')
  })
})

describe('theming contract', () => {
  it('resolves every tone through --fui-* custom properties, never colour literals', () => {
    render(<Button variant="warn">WARN</Button>)
    const className = screen.getByRole('button').className
    expect(className).toContain('var(--fui-warn')
    expect(className).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(className).not.toContain('rgb')
  })
})
