import { StrictMode, useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import Button from '@mui/material/Button'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import App from './App'
import type { FileTreeRoot } from './components/FileTreeInput/parseFileTreeJson'
import { FILE_TREE_STORAGE_KEY } from './utils/fileTreeStorage'

const root = {
  name: 'root',
  type: 'folder',
  children: [{
    name: 'a/b',
    type: 'folder',
    children: [{ name: 'index.ts', type: 'file', size: 1024 }],
  }],
} satisfies FileTreeRoot

const source = { ...root, metadata: { owner: 'example', tags: ['test'] } }
const json = JSON.stringify(source, null, 2)
const replacement = { name: 'replacement', type: 'folder' } satisfies FileTreeRoot
const nestedPath = '/tree/root%2Fa%252Fb%2Findex.ts'
const saveAttempts = fn()
let failReads = false
let failWrites = false

function CurrentLocation() {
  const location = useLocation()
  return (
    <output aria-label="Current location" hidden>
      {location.pathname}{location.search}{location.hash}
    </output>
  )
}

function AppHarness({ initialPath }: { initialPath: string }) {
  const [mount, setMount] = useState(0)
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Button onClick={() => setMount((value) => value + 1)}>Remount app</Button>
      <CurrentLocation />
      <StrictMode>
        <App key={mount} />
      </StrictMode>
    </MemoryRouter>
  )
}

async function enterJson(canvas: ReturnType<typeof within>, text: string) {
  const textarea = canvas.getByRole('textbox', { name: 'File tree JSON' })
  await userEvent.clear(textarea)
  await userEvent.click(textarea)
  await userEvent.paste(text)
}

const meta = {
  title: 'App/Persistence',
  component: App,
  render: (_, context) => <AppHarness initialPath={context.parameters.initialPath ?? '/'} />,
  beforeEach: (context) => {
    const storage = window.localStorage
    const previous = storage.getItem(FILE_TREE_STORAGE_KEY)
    const initialJson = context.parameters.initialJson
    if (typeof initialJson === 'string') {
      storage.setItem(FILE_TREE_STORAGE_KEY, initialJson)
    } else {
      storage.removeItem(FILE_TREE_STORAGE_KEY)
    }
    failReads = context.parameters.failReads === true
    failWrites = context.parameters.failWrites === true
    saveAttempts.mockClear()

    const originalGet = Storage.prototype.getItem
    const originalSet = Storage.prototype.setItem
    const read = spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (this === storage && key === FILE_TREE_STORAGE_KEY && failReads) {
        throw new DOMException('Storage access denied.', 'SecurityError')
      }
      return originalGet.call(this, key)
    })
    const write = spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (this === storage && key === FILE_TREE_STORAGE_KEY) {
        saveAttempts(key, value)
        if (failWrites) {
          throw new DOMException('Storage is full.', 'QuotaExceededError')
        }
      }
      originalSet.call(this, key, value)
    })

    return () => {
      read.mockRestore()
      write.mockRestore()
      if (previous === null) storage.removeItem(FILE_TREE_STORAGE_KEY)
      else storage.setItem(FILE_TREE_STORAGE_KEY, previous)
    }
  },
} satisfies Meta<typeof App>

export default meta

type Story = StoryObj<typeof meta>

export const SaveAndRestore: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await enterJson(canvas, json)
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBeNull()
    await expect(saveAttempts).not.toHaveBeenCalled()

    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('tree')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree$/)
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(JSON.stringify(source))
    await expect(saveAttempts).toHaveBeenCalledTimes(1)

    await userEvent.click(canvas.getByRole('button', { name: 'Remount app' }))
    await expect(canvas.getByRole('region', { name: 'Folder details' })).toHaveTextContent('root')
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree$/)
    await userEvent.click(canvas.getByRole('link', { name: 'a/b' }))
    await userEvent.click(canvas.getByRole('link', { name: 'index.ts' }))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(nestedPath)
    await expect(canvas.getByRole('region', { name: 'File details' }))
      .toHaveTextContent('root/a/b/index.ts')

    const rootLabel = within(canvas.getByRole('tree'))
      .getByText('root', { selector: '.MuiTreeItem-label' })
    const icon = rootLabel.closest('[role="treeitem"]')
      ?.querySelector<HTMLElement>('.MuiTreeItem-iconContainer')
    if (!icon) throw new Error('Expected a root expansion icon')
    await userEvent.click(icon)
    await expect(rootLabel.closest('[role="treeitem"]')).toHaveAttribute('aria-expanded', 'false')
    await expect(saveAttempts).toHaveBeenCalledTimes(1)

    await userEvent.click(canvas.getByRole('button', { name: 'Remount app' }))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(nestedPath)
    await expect(canvas.getByRole('region', { name: 'File details' }))
      .toHaveTextContent('root/a/b/index.ts')
    const selected = within(canvas.getByRole('tree'))
      .getByText('index.ts', { selector: '.MuiTreeItem-label' })
    await expect(selected.closest('[role="treeitem"]')).toHaveAttribute('aria-selected', 'true')
    await expect(selected).toBeVisible()
    await expect(saveAttempts).toHaveBeenCalledTimes(1)
  },
}

export const RestoreNestedUrl: Story = {
  parameters: { initialPath: nestedPath, initialJson: json },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(nestedPath)
    await expect(canvas.getByRole('region', { name: 'File details' }))
      .toHaveTextContent('root/a/b/index.ts')
    const selected = within(canvas.getByRole('tree'))
      .getByText('index.ts', { selector: '.MuiTreeItem-label' })
    await expect(selected.closest('[role="treeitem"]')).toHaveAttribute('aria-selected', 'true')
    await expect(selected).toBeVisible()
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(json)
    await expect(saveAttempts).not.toHaveBeenCalled()
  },
}

export const ReplaceTree: Story = {
  parameters: { initialPath: '/tree', initialJson: json },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('link', { name: 'Enter another JSON' }))
    await expect(canvas.getByRole('textbox', { name: 'File tree JSON' })).toHaveValue('')
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(json)

    await enterJson(canvas, '{')
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Invalid JSON:')
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(json)
    await expect(saveAttempts).not.toHaveBeenCalled()

    await userEvent.click(canvas.getByRole('button', { name: 'Remount app' }))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/$/)
    await expect(canvas.getByRole('textbox', { name: 'File tree JSON' })).toHaveValue('')
    const file = new File([JSON.stringify(replacement)], 'replacement.json', {
      type: 'application/json',
    })
    await userEvent.upload(canvas.getByLabelText('JSON file'), file)
    const validate = canvas.getByRole('button', { name: 'Validate JSON' })
    await waitFor(() => expect(validate).toBeEnabled())
    await expect(canvas.getByRole('textbox', { name: 'File tree JSON' }))
      .toHaveValue(JSON.stringify(replacement))
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(json)
    await expect(saveAttempts).not.toHaveBeenCalled()

    await userEvent.click(validate)
    await expect(canvas.getByRole('region', { name: 'Folder details' }))
      .toHaveTextContent('replacement')
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY))
      .toBe(JSON.stringify(replacement))
    await expect(saveAttempts).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Remount app' }))
    await expect(canvas.getByRole('region', { name: 'Folder details' }))
      .toHaveTextContent('replacement')
  },
}

export const MissingSavedTree: Story = {
  parameters: { initialPath: nestedPath },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('textbox', { name: 'File tree JSON' })).toHaveValue('')
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/$/)
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    await expect(saveAttempts).not.toHaveBeenCalled()
  },
}

export const CorruptSavedTree: Story = {
  parameters: { initialPath: '/tree', initialJson: '{' },
  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('textbox', { name: 'File tree JSON' })).toHaveValue('')
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/$/)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Unable to load the saved tree:')
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(parameters.initialJson)
    await expect(saveAttempts).not.toHaveBeenCalled()

    await userEvent.click(canvas.getByRole('button', { name: 'Remount app' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Unable to load the saved tree:')
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(parameters.initialJson)
    await enterJson(canvas, json)
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('tree')).toBeInTheDocument()
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(JSON.stringify(source))
  },
}

export const InvalidSavedTree: Story = {
  parameters: { initialPath: '/tree', initialJson: '{"name":"file","type":"file","size":0}' },
  play: CorruptSavedTree.play,
}

export const UnavailableStorage: Story = {
  parameters: { initialPath: '/tree', failReads: true, failWrites: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('textbox', { name: 'File tree JSON' })).toHaveValue('')
    await expect(canvas.getByRole('alert'))
      .toHaveTextContent('Unable to load the saved tree: Storage access denied.')
    await enterJson(canvas, json)
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('tree')).toBeInTheDocument()
    await expect(canvas.getByRole('alert')).toHaveTextContent('Your tree is open but could not be saved:')
    await userEvent.click(canvas.getByRole('link', { name: 'a/b' }))
    await userEvent.click(canvas.getByRole('link', { name: 'index.ts' }))
    await expect(canvas.getByRole('region', { name: 'File details' }))
      .toHaveTextContent('root/a/b/index.ts')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Refreshing may restore an older tree')
  },
}

export const SaveFailureAndRecovery: Story = {
  parameters: { initialJson: json, failWrites: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await enterJson(canvas, JSON.stringify(replacement))
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('region', { name: 'Folder details' }))
      .toHaveTextContent('replacement')
    await expect(canvas.getByRole('alert'))
      .toHaveTextContent('Your tree is open but could not be saved: Storage is full.')
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(json)

    await userEvent.click(canvas.getByRole('link', { name: 'Enter another JSON' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Your tree is open but could not be saved:')
    failWrites = false
    await enterJson(canvas, JSON.stringify(replacement))
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY))
      .toBe(JSON.stringify(replacement))
    await userEvent.click(canvas.getByRole('button', { name: 'Remount app' }))
    await expect(canvas.getByRole('region', { name: 'Folder details' }))
      .toHaveTextContent('replacement')
  },
}

export const RestoreSearchAndReplaceTree: Story = {
  parameters: { initialPath: `${nestedPath}?q=index`, initialJson: json },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    let search = within(canvas.getByRole('region', { name: 'Search' }))
    await expect(search.getByRole('searchbox')).toHaveValue('index')
    await expect(search.getByRole('link', { name: 'File: index.ts, root/a/b/index.ts' }))
      .toHaveAttribute('href', `${nestedPath}?q=index`)
    await expect(canvas.getByRole('region', { name: 'File details' }))
      .toHaveTextContent('root/a/b/index.ts')

    await userEvent.clear(search.getByRole('searchbox'))
    await userEvent.type(search.getByRole('searchbox'), 'a/b')
    await expect(saveAttempts).not.toHaveBeenCalled()
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY)).toBe(json)
    await userEvent.click(canvas.getByRole('button', { name: 'Remount app' }))
    search = within(canvas.getByRole('region', { name: 'Search' }))
    await expect(search.getByRole('searchbox')).toHaveValue('a/b')
    await expect(search.getByRole('link', { name: 'Folder: a/b, root/a/b' })).toBeVisible()
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(`${nestedPath}?q=a%2Fb`)
    await expect(canvas.getByRole('region', { name: 'File details' }))
      .toHaveTextContent('root/a/b/index.ts')
    await expect(saveAttempts).not.toHaveBeenCalled()

    await userEvent.click(canvas.getByRole('link', { name: 'Enter another JSON' }))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/$/)
    await enterJson(canvas, JSON.stringify(replacement))
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByLabelText('Current location')).toHaveTextContent(/^\/tree$/)
    await expect(canvas.getByRole('searchbox')).toHaveValue('')
    await expect(within(canvas.getByRole('region', { name: 'Search' })).queryByRole('list'))
      .not.toBeInTheDocument()
    await expect(window.localStorage.getItem(FILE_TREE_STORAGE_KEY))
      .toBe(JSON.stringify(replacement))
  },
}
