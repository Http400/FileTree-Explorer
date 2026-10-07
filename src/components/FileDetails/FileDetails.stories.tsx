import { useState } from 'react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FileDetails } from './FileDetails'

const meta = {
  title: 'Components/FileDetails',
  component: FileDetails,
  decorators: [
    (Story) => (
      <div style={{ width: 480, maxWidth: '100%', textAlign: 'left' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    file: { name: 'index.ts', type: 'file', size: 1024 },
    fullPath: 'root/src/index.ts',
  },
} satisfies Meta<typeof FileDetails>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'File details' })).toBeVisible()
    await expect(canvas.getAllByRole('term').map((term) => term.textContent))
      .toEqual(['Name', 'Size', 'Full path'])
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['index.ts', '1 KB', 'root/src/index.ts'])
  },
}

export const ZeroBytes: Story = {
  args: {
    file: { name: 'empty.txt', type: 'file', size: 0 },
    fullPath: 'root/empty.txt',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['empty.txt', '0 B', 'root/empty.txt'])
  },
}

export const FractionalKilobytes: Story = {
  args: { file: { name: 'index.ts', type: 'file', size: 1536 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('1.5 KB')).toBeVisible()
  },
}

export const Megabytes: Story = {
  args: {
    file: { name: 'image.png', type: 'file', size: 1572864 },
    fullPath: 'root/assets/image.png',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['image.png', '1.5 MB', 'root/assets/image.png'])
  },
}

export const LongPath: Story = {
  args: {
    file: { name: `${'very-long-name-'.repeat(12)}.txt`, type: 'file', size: 42 },
    fullPath: `root/${'nested-folder/'.repeat(25)}${'very-long-name-'.repeat(12)}.txt`,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual([args.file.name, '42 B', args.fullPath])
    const region = canvas.getByRole('region', { name: 'File details' })
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth)
  },
}

export const SpecialCharacters: Story = {
  args: {
    file: { name: ' caf\u00e9 <draft> & 100%?#.txt ', type: 'file', size: 1023 },
    fullPath: 'root/my folder/ caf\u00e9 <draft> & 100%?#.txt ',
  },
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getAllByRole('definition').map((value) => value.textContent))
      .toEqual([args.file.name, '1023 B', args.fullPath])
  },
}

export const ChangingFile: Story = {
  render: function ChangingFile(args) {
    const [changed, setChanged] = useState(false)

    return (
      <Stack spacing={2}>
        <Button onClick={() => setChanged(true)}>Show another file</Button>
        <FileDetails
          file={changed ? { name: 'next.txt', type: 'file', size: 512 } : args.file}
          fullPath={changed ? 'root/other/next.txt' : args.fullPath}
        />
      </Stack>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['index.ts', '1 KB', 'root/src/index.ts'])
    await userEvent.click(canvas.getByRole('button', { name: 'Show another file' }))
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['next.txt', '512 B', 'root/other/next.txt'])
    await expect(canvas.queryByText('index.ts')).not.toBeInTheDocument()
  },
}
