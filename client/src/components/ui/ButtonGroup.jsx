import { Children, cloneElement, isValidElement } from 'react'
import { space } from '../../utils/designTokens'

// ----- Tel-Cloud ButtonGroup -------------------------------------------------
// Wraps multiple Buttons that act as a toggle/segmented control.
// Pass `value` and `onChange` to control which Button is selected.
// Each child Button must have a unique `value` prop.
//
// Example:
//   <ButtonGroup value={mode} onChange={setMode}>
//     <Button value="all">All</Button>
//     <Button value="open">Open</Button>
//     <Button value="resolved">Resolved</Button>
//   </ButtonGroup>
//
// Behaviour:
//   - The Button matching `value` gets `selected=true` automatically
//   - Clicking any Button calls onChange(value)
//   - Buttons inherit `variant="secondary"` and `size` from the group
//
// Props:
//   value      currently-selected value
//   onChange   function(newValue)
//   size       sm | md | lg          (default: md)
//   variant    secondary | ghost     (default: secondary)
//   gap        spacing between buttons in px (default: 4)
//   fullWidth  fills container, buttons share width equally
//   children   Button elements with `value` prop

export default function ButtonGroup({
  value,
  onChange,
  size = 'md',
  variant = 'secondary',
  gap = space[1],
  fullWidth = false,
  children,
  style: extraStyle,
}) {
  const buttons = Children.toArray(children).filter(isValidElement)

  return (
    <div style={{
      display: 'inline-flex',
      gap,
      alignItems: 'center',
      width: fullWidth ? '100%' : undefined,
      ...extraStyle,
    }}>
      {buttons.map((child) => {
        const childValue = child.props.value
        const isSelected = childValue !== undefined && childValue === value
        return cloneElement(child, {
          key: childValue ?? child.key,
          variant,
          size,
          selected: isSelected,
          onClick: () => {
            if (onChange && childValue !== undefined) onChange(childValue)
            if (child.props.onClick) child.props.onClick()
          },
          style: {
            ...(fullWidth ? { flex: 1 } : {}),
            ...(child.props.style || {}),
          },
        })
      })}
    </div>
  )
}