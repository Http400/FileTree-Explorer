import { useState } from 'react'
import './CounterButton.css'

type CounterButtonProps = {
  initialCount?: number
}

export function CounterButton({ initialCount = 0 }: CounterButtonProps) {
  const [count, setCount] = useState(initialCount)

  return (
    <button
      type="button"
      className="counter-button"
      onClick={() => setCount((currentCount) => currentCount + 1)}
    >
      Count is {count}
    </button>
  )
}
