import { useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { addItemIds, type FileTreeItem, type FileTreeNode } from '../FileTree/addItemIds'
import { FolderDetails, type FolderDetailsProps } from './FolderDetails'

function withIds(folder: Extract<FileTreeNode, { type: 'folder' }>): FolderDetailsProps['folder'] {
  const [item] = addItemIds([folder])
  if (item.type !== 'folder') throw new Error('Expected a folder fixture')
  return item
}

const folder = withIds({
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'src',
      type: 'folder',
      children: [
        { name: 'index.ts', type: 'file', size: 1024 },
        {
          name: 'components',
          type: 'folder',
          children: [{ name: 'Button.tsx', type: 'file', size: 512 }],
        },
      ],
    },
    { name: 'package.json', type: 'file', size: 300 },
    { name: 'assets', type: 'folder' },
  ],
})

const nextFolder = withIds({
  name: 'images',
  type: 'folder',
  children: [{ name: 'image.png', type: 'file', size: 1048576 }],
})

// Story-only URLs demonstrate caller-owned destinations, not application routes.
const getChildTo = (child: FileTreeItem) => `/preview?node=${encodeURIComponent(child.id)}`

function CurrentLocation() {
  const location = useLocation()
  return (
    <output aria-label="Current location" hidden>
      {location.pathname}{location.search}{location.hash}
    </output>
  )
}

const meta = {
  title: 'Components/FolderDetails',
  component: FolderDetails,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/preview']}>
        <div style={{ width: 480, maxWidth: '100%', textAlign: 'left', overflowWrap: 'anywhere' }}>
          <Story />
          <CurrentLocation />
        </div>
      </MemoryRouter>
    ),
  ],
  args: { folder, getChildTo },
} satisfies Meta<typeof FolderDetails>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Current location')).not.toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Folder details' })).toBeVisible()
    await expect(canvas.getAllByRole('term').map((term) => term.textContent))
      .toEqual(['Name', 'Direct children', 'Total size'])
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['root', '3', '1.79 KB'])
    const children = within(canvas.getByRole('list', { name: 'Children' }))
    await expect(children.getAllByRole('link').map((link) => link.textContent))
      .toEqual(['src', 'package.json', 'assets'])
    await expect(children.getAllByRole('link').map((link) => link.getAttribute('href')))
      .toEqual([
        '/preview?node=root%2Fsrc',
        '/preview?node=root%2Fpackage.json',
        '/preview?node=root%2Fassets',
      ])
    await expect(children.getAllByText('Folder')).toHaveLength(2)
    await expect(children.getByText('File')).toBeVisible()
    await expect(canvas.queryByRole('link', { name: 'index.ts' })).not.toBeInTheDocument()
    await expect(canvas.queryByText('This folder is empty.')).not.toBeInTheDocument()
  },
}

export const EmptyFolder: Story = {
  args: { folder: withIds({ name: 'empty', type: 'folder', children: [] }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['empty', '0', '0 B'])
    await expect(canvas.getByText('This folder is empty.')).toBeVisible()
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument()
  },
}

export const OmittedChildren: Story = {
  args: { folder: withIds({ name: 'empty', type: 'folder' }) },
  play: EmptyFolder.play,
}

export const LargeTotal: Story = {
  args: {
    folder: withIds({
      name: 'large',
      type: 'folder',
      children: [
        { name: 'one.bin', type: 'file', size: Number.MAX_SAFE_INTEGER },
        {
          name: 'nested',
          type: 'folder',
          children: [{ name: 'two.bin', type: 'file', size: Number.MAX_SAFE_INTEGER }],
        },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['large', '2', '17179869184 MB'])
  },
}

export const ChildNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const folderLink = canvas.getByRole('link', { name: 'src' })
    const fileLink = canvas.getByRole('link', { name: 'package.json' })
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/preview$/)
    await expect(canvas.getByLabelText('Current location')).not.toBeVisible()

    await userEvent.click(folderLink)
    await expect(canvas.getByLabelText('Current location'))
      .toHaveTextContent(/^\/preview\?node=root%2Fsrc$/)
    await expect(canvas.getByLabelText('Current location')).not.toBeVisible()
    await userEvent.tab()
    await expect(fileLink).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByLabelText('Current location'))
      .toHaveTextContent(/^\/preview\?node=root%2Fpackage\.json$/)
    await expect(canvas.getByLabelText('Current location')).not.toBeVisible()
  },
}

export const SpecialCharacters: Story = {
  args: {
    folder: withIds({
      name: 'root',
      type: 'folder',
      children: [
        { name: 'a/b', type: 'file', size: 0 },
        { name: 'a%2Fb', type: 'folder' },
        { name: 'caf\u00e9?#.txt', type: 'file', size: 42 },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('link').map((link) => link.textContent))
      .toEqual(['a/b', 'a%2Fb', 'caf\u00e9?#.txt'])
    await expect(canvas.getAllByRole('link').map((link) => link.getAttribute('href')))
      .toEqual([
        '/preview?node=root%2Fa%252Fb',
        '/preview?node=root%2Fa%25252Fb',
        '/preview?node=root%2Fcaf%25C3%25A9%253F%2523.txt',
      ])
    await userEvent.click(canvas.getByRole('link', { name: 'caf\u00e9?#.txt' }))
    await expect(canvas.getByLabelText('Current location'))
      .toHaveTextContent(/^\/preview\?node=root%2Fcaf%25C3%25A9%253F%2523\.txt$/)
    await expect(canvas.getByLabelText('Current location')).not.toBeVisible()
  },
}

export const LongNames: Story = {
  args: {
    folder: withIds({
      name: 'long-folder-'.repeat(20),
      type: 'folder',
      children: [{ name: `${'long-file-'.repeat(20)}.txt`, type: 'file', size: 42 }],
    }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual([args.folder.name, '1', '42 B'])
    await expect(canvas.getByRole('link', { name: `${'long-file-'.repeat(20)}.txt` })).toBeVisible()
    const region = canvas.getByRole('region', { name: 'Folder details' })
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth)
  },
}

export const ChangingFolder: Story = {
  render: function ChangingFolder(args) {
    const [changed, setChanged] = useState(false)

    return (
      <Stack spacing={2}>
        <Button onClick={() => setChanged(true)}>Show another folder</Button>
        <FolderDetails {...args} folder={changed ? nextFolder : args.folder} />
      </Stack>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['root', '3', '1.79 KB'])
    await userEvent.click(canvas.getByRole('button', { name: 'Show another folder' }))
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['images', '1', '1 MB'])
    await expect(canvas.getAllByRole('link')).toHaveLength(1)
    await expect(canvas.queryByRole('link', { name: 'src' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'image.png' }))
      .toHaveAttribute('href', '/preview?node=images%2Fimage.png')
    await userEvent.click(canvas.getByRole('link', { name: 'image.png' }))
    await expect(canvas.getByLabelText('Current location'))
      .toHaveTextContent(/^\/preview\?node=images%2Fimage\.png$/)
    await expect(canvas.getByLabelText('Current location')).not.toBeVisible()
  },
}
