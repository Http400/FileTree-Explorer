import type { Meta, StoryObj } from '@storybook/react-vite'
import { CounterButton } from './CounterButton'

const meta = {
  title: 'Components/CounterButton',
  component: CounterButton,
  args: {
    initialCount: 0,
  },
} satisfies Meta<typeof CounterButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithInitialCount: Story = {
  args: {
    initialCount: 10,
  },
}
