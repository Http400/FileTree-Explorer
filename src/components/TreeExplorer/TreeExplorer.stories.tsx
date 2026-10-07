import { useState } from 'react'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { addItemIds } from '../FileTree/addItemIds'
import { TreeExplorer } from './TreeExplorer'
import '../../App.css'

const items = addItemIds([{
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
    {
      name: 'tests',
      type: 'folder',
      children: [{ name: 'index.test.ts', type: 'file', size: 128 }],
    },
    { name: 'package.json', type: 'file', size: 300 },
    { name: 'empty', type: 'folder' },
  ],
}])

const replacementItems = addItemIds([{
  name: 'root',
  type: 'folder',
  children: [{ name: 'replacement.txt', type: 'file', size: 42 }],
}])

function NavigationControls() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button onClick={() => navigate(-1)}>Back</Button>
        <Button onClick={() => navigate(1)}>Forward</Button>
        <Link to="/tree">Root folder</Link>
      </Stack>
      <output aria-label="Current location" hidden>{location.pathname}</output>
    </>
  )
}

function treeItem(canvas: ReturnType<typeof within>, name: string) {
  const label: HTMLElement = canvas.getByText(name, { selector: '.MuiTreeItem-label' })
  const item = label.closest<HTMLElement>('[role="treeitem"]')
  if (!item) throw new Error('Expected a tree item for the label')
  return item
}

function expansionIcon(item: HTMLElement) {
  const icon = item.querySelector<HTMLElement>('.MuiTreeItem-iconContainer')
  if (!icon) throw new Error('Expected a tree item expansion icon')
  return icon
}

const meta = {
  title: 'Components/TreeExplorer',
  component: TreeExplorer,
  decorators: [
    (Story, context) => (
      <MemoryRouter initialEntries={[context.parameters.initialPath ?? '/tree']}>
        <div className="app">
          <NavigationControls />
          <Routes>
            <Route path="/tree/*" element={<Story />} />
            <Route path="/" element={<p>JSON input</p>} />
          </Routes>
        </div>
      </MemoryRouter>
    ),
  ],
  args: { items },
} satisfies Meta<typeof TreeExplorer>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = within(canvas.getByRole('tree', { name: 'Project files' }))
    await expect(treeItem(tree, 'root')).toHaveAttribute('aria-selected', 'true')
    await expect(treeItem(tree, 'root')).toHaveAttribute('aria-expanded', 'true')
    const details = within(canvas.getByRole('region', { name: 'Folder details' }))
    await expect(details.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['root', '4', '1.92 KB'])
    await expect(details.getAllByRole('link').map((link) => link.textContent))
      .toEqual(['src', 'tests', 'package.json', 'empty'])
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree$/)
    await expect(canvas.getByLabelText('Current location')).not.toBeVisible()
  },
}

export const TreeSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = within(canvas.getByRole('tree'))
    await userEvent.click(tree.getByText('src'))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree\/root%2Fsrc$/)
    await expect(treeItem(tree, 'src')).toHaveAttribute('aria-selected', 'true')
    await expect(treeItem(tree, 'src')).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(tree.getByText('src'))
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree$/)

    await userEvent.click(tree.getByText('package.json'))
    await expect(canvas.getByLabelText('Current location'))
      .toHaveTextContent(/^\/tree\/root%2Fpackage\.json$/)
    await expect(treeItem(tree, 'package.json')).toHaveAttribute('aria-selected', 'true')
    const details = within(canvas.getByRole('region', { name: 'File details' }))
    await expect(details.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['package.json', '300 B', 'root/package.json'])
  },
}

export const ChildLinksAndHistory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = within(canvas.getByRole('tree'))
    await userEvent.click(canvas.getByRole('link', { name: 'src' }))
    await userEvent.click(canvas.getByRole('link', { name: 'components' }))
    await userEvent.click(canvas.getByRole('link', { name: 'Button.tsx' }))
    await expect(canvas.getByLabelText('Current location'))
      .toHaveTextContent(/^\/tree\/root%2Fsrc%2Fcomponents%2FButton\.tsx$/)
    await expect(treeItem(tree, 'Button.tsx')).toHaveAttribute('aria-selected', 'true')
    await expect(treeItem(tree, 'components')).toHaveAttribute('aria-expanded', 'true')
    const details = within(canvas.getByRole('region', { name: 'File details' }))
    await expect(details.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['Button.tsx', '512 B', 'root/src/components/Button.tsx'])

    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(treeItem(tree, 'components')).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('region', { name: 'Folder details' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Forward' }))
    await expect(treeItem(tree, 'Button.tsx')).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('region', { name: 'File details' })).toBeVisible()
  },
}

export const NestedInitialUrl: Story = {
  parameters: { initialPath: '/tree/root%2Fsrc%2Fcomponents%2FButton.tsx' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = within(canvas.getByRole('tree'))
    for (const name of ['root', 'src', 'components']) {
      await expect(treeItem(tree, name)).toHaveAttribute('aria-expanded', 'true')
    }
    await expect(treeItem(tree, 'Button.tsx')).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByText('root/src/components/Button.tsx')).toBeVisible()
  },
}

export const IndependentExpansion: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = within(canvas.getByRole('tree'))
    await userEvent.click(expansionIcon(treeItem(tree, 'tests')))
    await expect(treeItem(tree, 'tests')).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree$/)
    await expect(treeItem(tree, 'root')).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(canvas.getByRole('link', { name: 'src' }))
    await userEvent.click(canvas.getByRole('link', { name: 'index.ts' }))
    await expect(treeItem(tree, 'tests')).toHaveAttribute('aria-expanded', 'true')
    await expect(treeItem(tree, 'src')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(expansionIcon(treeItem(tree, 'root')))
    await expect(treeItem(tree, 'root')).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.getByRole('region', { name: 'File details' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(treeItem(tree, 'root')).toHaveAttribute('aria-expanded', 'true')
    await expect(treeItem(tree, 'src')).toHaveAttribute('aria-selected', 'true')
  },
}

export const KeyboardSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tree = within(canvas.getByRole('tree'))
    await userEvent.click(tree.getByText('root'))
    await userEvent.keyboard('{ArrowDown} ')
    await expect(treeItem(tree, 'src')).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree\/root%2Fsrc$/)
    await userEvent.keyboard('{ArrowRight}{ArrowDown}{Enter}')
    await expect(treeItem(tree, 'index.ts')).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByText('root/src/index.ts')).toBeVisible()
  },
}

export const EmptyRoot: Story = {
  args: { items: addItemIds([{ name: 'empty-root', type: 'folder', children: [] }]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['empty-root', '0', '0 B'])
    await expect(canvas.getByText('This folder is empty.')).toBeVisible()
    await expect(treeItem(canvas, 'empty-root')).toHaveAttribute('aria-selected', 'true')
  },
}

export const EmptyFolder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('link', { name: 'empty' }))
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['empty', '0', '0 B'])
    await expect(canvas.getByText('This folder is empty.')).toBeVisible()
    await expect(treeItem(canvas, 'empty')).toHaveAttribute('aria-selected', 'true')
  },
}

export const SpecialNames: Story = {
  args: {
    items: addItemIds([{
      name: 'root',
      type: 'folder',
      children: [
        { name: 'a/b', type: 'file', size: 1 },
        { name: 'a', type: 'folder', children: [{ name: 'b', type: 'file', size: 2 }] },
        { name: 'a%2Fb', type: 'file', size: 3 },
        { name: 'caf\u00e9 ?#%.txt', type: 'file', size: 4 },
        { name: '..', type: 'file', size: 5 },
      ],
    }]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const [name, suffix, size] of [
      ['a/b', 'root%2Fa%252Fb', '1 B'],
      ['a%2Fb', 'root%2Fa%25252Fb', '3 B'],
      ['caf\u00e9 ?#%.txt', 'root%2Fcaf%25C3%25A9%2520%253F%2523%2525.txt', '4 B'],
      ['..', 'root%2F..', '5 B'],
    ]) {
      await userEvent.click(canvas.getByRole('link', { name }))
      await expect(canvas.getByLabelText('Current location')).toHaveTextContent(`/tree/${suffix}`)
      await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
        .toEqual([name, size, `root/${name}`])
      await expect(treeItem(canvas, name)).toHaveAttribute('aria-selected', 'true')
      await userEvent.click(canvas.getByRole('link', { name: 'Root folder' }))
    }
    await userEvent.click(canvas.getByRole('link', { name: 'a' }))
    await userEvent.click(canvas.getByRole('link', { name: 'b' }))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree\/root%2Fa%2Fb$/)
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['b', '2 B', 'root/a/b'])
    await expect(treeItem(canvas, 'b')).toHaveAttribute('aria-selected', 'true')
    await expect(treeItem(canvas, 'a/b')).toHaveAttribute('aria-selected', 'false')
  },
}

export const MissingNode: Story = {
  parameters: { initialPath: '/tree/root%2Fmissing' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tree')).toBeVisible()
    await expect(canvas.getByRole('alert')).toHaveTextContent('File or folder not found.')
    for (const item of canvas.getAllByRole('treeitem')) {
      await expect(item).toHaveAttribute('aria-selected', 'false')
    }
    await userEvent.click(canvas.getByRole('link', { name: 'Back to root folder' }))
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Folder details' })).toBeVisible()
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree$/)
  },
}

export const MalformedUrl: Story = {
  parameters: { initialPath: '/tree/%ZZ' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Invalid node URL')
    await userEvent.click(within(canvas.getByRole('tree')).getByText('package.json'))
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    await expect(canvas.getByText('root/package.json')).toBeVisible()
  },
}

export const ReplacingTree: Story = {
  render: function ReplacingTree(args) {
    const [replaced, setReplaced] = useState(false)
    const navigate = useNavigate()

    return (
      <Stack spacing={2}>
        <Button onClick={() => {
          setReplaced(true)
          navigate('/tree')
        }}>
          Replace tree
        </Button>
        <TreeExplorer items={replaced ? replacementItems : args.items} />
      </Stack>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('link', { name: 'src' }))
    await userEvent.click(canvas.getByRole('link', { name: 'index.ts' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Replace tree' }))
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent))
      .toEqual(['root', '1', '42 B'])
    await expect(canvas.queryByRole('treeitem', { name: 'src' })).not.toBeInTheDocument()
    await expect(treeItem(canvas, 'root')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('File or folder not found.')
    await userEvent.click(canvas.getByRole('link', { name: 'Back to root folder' }))
    await expect(canvas.getByRole('link', { name: 'replacement.txt' })).toBeVisible()
  },
}
