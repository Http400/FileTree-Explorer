import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileTreeRoot } from '../components/FileTreeInput/parseFileTreeJson'
import { FILE_TREE_STORAGE_KEY, loadFileTree, saveFileTree } from './fileTreeStorage'

const root = {
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'a/b',
      type: 'folder',
      children: [{ name: 'index.ts', type: 'file', size: 1024 }],
    },
    { name: 'empty', type: 'folder', children: [] },
    { name: 'omitted', type: 'folder' },
  ],
} satisfies FileTreeRoot

const values = new Map<string, string>()
const storage = {
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
}

beforeEach(() => {
  values.clear()
  storage.getItem.mockReset()
  storage.setItem.mockReset()
  vi.stubGlobal('window', { localStorage: storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadFileTree', () => {
  it('returns no root when the key is missing without writing a default', () => {
    values.set('unrelated', 'keep')
    expect(loadFileTree()).toEqual({ success: true, root: null })
    expect(storage.getItem).toHaveBeenCalledWith(FILE_TREE_STORAGE_KEY)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect([...values]).toEqual([['unrelated', 'keep']])
  })

  it('restores validated source data and metadata without adding IDs or writing storage', () => {
    const source = {
      ...root,
      metadata: { owner: 'example', tags: ['test'] },
      children: [
        ...root.children,
        { name: 'caf\u00e9.txt', type: 'file', size: 0, executable: false },
      ],
    }
    const text = JSON.stringify(source, null, 2)
    values.set(FILE_TREE_STORAGE_KEY, text)

    expect(loadFileTree()).toStrictEqual({ success: true, root: source })
    expect(loadFileTree()).toStrictEqual({ success: true, root: source })
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(values.get(FILE_TREE_STORAGE_KEY)).toBe(text)
  })

  it.each([
    ['', 'Paste JSON'],
    ['{', 'Invalid JSON:'],
    ['null', '$: Expected a file or folder object.'],
    ['{"name":"file","type":"file","size":0}', '$: Expected a folder root.'],
    ['{"name":"root","type":"folder","children":false}', '$.children: Expected an array.'],
    [
      '{"name":"root","type":"folder","children":[{"name":"file","type":"file","size":-1}]}',
      '$.children[0].size: Expected a nonnegative safe integer',
    ],
    [
      '{"name":"root","type":"folder","children":[{"name":"same","type":"folder"},{"name":"same","type":"folder"}]}',
      'Duplicate item name "same"',
    ],
  ])('reports invalid saved data without changing it: %j', (text, error) => {
    values.set(FILE_TREE_STORAGE_KEY, text)
    expect(loadFileTree()).toEqual({
      success: false,
      error: expect.stringContaining(error),
    })
    expect(values.get(FILE_TREE_STORAGE_KEY)).toBe(text)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('reports a denied read and keeps saved data', () => {
    values.set(FILE_TREE_STORAGE_KEY, JSON.stringify(root))
    storage.getItem.mockImplementation(() => {
      throw new DOMException('Storage access denied.', 'SecurityError')
    })
    expect(loadFileTree()).toEqual({
      success: false,
      error: 'Unable to load the saved tree: Storage access denied. You can still enter JSON to explore a tree.',
    })
    expect(values.get(FILE_TREE_STORAGE_KEY)).toBe(JSON.stringify(root))
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})

describe('saveFileTree', () => {
  it('saves the source tree and metadata under its own key', () => {
    const source = { ...root, metadata: { owner: 'example' } }
    values.set('unrelated', 'keep')
    expect(saveFileTree(source)).toEqual({ success: true })
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(
      FILE_TREE_STORAGE_KEY, JSON.stringify(source),
    )
    expect(loadFileTree()).toStrictEqual({ success: true, root: source })
    expect(values.get('unrelated')).toBe('keep')
  })

  it('replaces the previous tree after another successful submission', () => {
    values.set(FILE_TREE_STORAGE_KEY, JSON.stringify(root))
    const replacement = { name: 'replacement', type: 'folder' } satisfies FileTreeRoot
    expect(saveFileTree(replacement)).toEqual({ success: true })
    expect(loadFileTree()).toEqual({ success: true, root: replacement })
  })

  it.each([
    new DOMException('Storage is full.', 'QuotaExceededError'),
    new DOMException('Storage access denied.', 'SecurityError'),
  ])('reports a failed save and preserves the previous value: %s', (error) => {
    const previous = JSON.stringify({ name: 'previous', type: 'folder' })
    values.set(FILE_TREE_STORAGE_KEY, previous)
    values.set('unrelated', 'keep')
    storage.setItem.mockImplementation(() => { throw error })

    expect(saveFileTree(root)).toEqual({
      success: false,
      error: `Your tree is open but could not be saved: ${error.message} Refreshing may restore an older tree or lose this tree.`,
    })
    expect([...values]).toEqual([
      [FILE_TREE_STORAGE_KEY, previous],
      ['unrelated', 'keep'],
    ])
  })

  it('reports serialization failure without attempting a write', () => {
    const children: FileTreeRoot[] = []
    const circular: FileTreeRoot = { name: 'root', type: 'folder', children }
    children.push(circular)
    values.set(FILE_TREE_STORAGE_KEY, JSON.stringify(root))

    expect(saveFileTree(circular)).toEqual({
      success: false,
      error: expect.stringContaining('Your tree is open but could not be saved:'),
    })
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(values.get(FILE_TREE_STORAGE_KEY)).toBe(JSON.stringify(root))
  })
})

it('handles a denied localStorage getter on both load and save', () => {
  vi.stubGlobal('window', {
    get localStorage() {
      throw new DOMException('Storage access denied.', 'SecurityError')
    },
  })
  expect(loadFileTree()).toEqual({
    success: false,
    error: expect.stringContaining('Unable to load the saved tree: Storage access denied.'),
  })
  expect(saveFileTree(root)).toEqual({
    success: false,
    error: expect.stringContaining('Your tree is open but could not be saved: Storage access denied.'),
  })
  expect(storage.getItem).not.toHaveBeenCalled()
  expect(storage.setItem).not.toHaveBeenCalled()
})
