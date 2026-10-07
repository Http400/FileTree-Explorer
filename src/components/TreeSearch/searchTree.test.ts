import { describe, expect, it } from 'vitest'
import { addItemIds, type FileTreeItem } from '../FileTree/addItemIds'
import { searchTree } from './searchTree'

const items = addItemIds([{
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'src',
      type: 'folder',
      children: [
        {
          name: 'components',
          type: 'folder',
          children: [{ name: 'Button.tsx', type: 'file', size: 512 }],
        },
        { name: 'index.ts', type: 'file', size: 1024 },
      ],
    },
    {
      name: 'tests',
      type: 'folder',
      children: [{ name: 'index.ts', type: 'file', size: 128 }],
    },
    { name: 'empty', type: 'folder', children: [] },
    { name: 'omitted', type: 'folder' },
  ],
}])

describe('searchTree', () => {
  it.each(['button', 'BUTTON', '  BuTtOn \n'])('matches a nested filename: %j', (query) => {
    expect(searchTree(items, query)).toEqual([{
      item: { id: 'root/src/components/Button.tsx', name: 'Button.tsx', type: 'file', size: 512 },
      fullPath: 'root/src/components/Button.tsx',
    }])
  })

  it('matches extensions and retains tree order and duplicate names under different parents', () => {
    expect(searchTree(items, '.ts').map(({ item, fullPath }) => [item.id, fullPath])).toEqual([
      ['root/src/components/Button.tsx', 'root/src/components/Button.tsx'],
      ['root/src/index.ts', 'root/src/index.ts'],
      ['root/tests/index.ts', 'root/tests/index.ts'],
    ])
  })

  it('matches the root and folders, including empty and omitted children', () => {
    for (const name of ['root', 'src', 'components', 'empty', 'omitted']) {
      expect(searchTree(items, name)).toMatchObject([{
        item: { name, type: 'folder' },
      }])
    }
    expect(searchTree(items, 'root')[0]).toEqual({ item: items[0], fullPath: 'root' })
  })

  it('returns original item references without mutating the tree', () => {
    const before = structuredClone(items)
    const root = items[0]
    if (root.type !== 'folder' || !root.children) throw new Error('Invalid fixture')
    expect(searchTree(items, 'src')[0].item).toBe(root.children[0])
    expect(items).toStrictEqual(before)
  })

  it('searches only node names, not ancestor names or paths', () => {
    expect(searchTree(items, 'components').map(({ fullPath }) => fullPath))
      .toEqual(['root/src/components'])
    expect(searchTree(items, 'src/index')).toEqual([])
  })

  it.each(['', ' ', ' \n\t', 'not-found'])('returns no results for %j', (query) => {
    expect(searchTree(items, query)).toEqual([])
  })

  it('handles an empty tree', () => {
    expect(searchTree([], 'anything')).toEqual([])
  })

  it.each(['a/b', 'a%2Fb', 'a+b', 'a&b', '?#', '[x]', 'two  spaces', 'caf\u00e9'])(
    'preserves literal names and readable paths: %s',
    (name) => {
      const source = addItemIds([{
        name: 'my root',
        type: 'folder',
        children: [{ name: `${name}.txt`, type: 'file', size: 0 }],
      }])
      const matches = searchTree(source, name.toUpperCase())
      expect(matches).toHaveLength(1)
      expect(matches[0].item.name).toBe(`${name}.txt`)
      expect(matches[0].fullPath).toBe(`my root/${name}.txt`)
    },
  )

  it('does not perform fuzzy matching or collapse internal query spaces', () => {
    expect(searchTree(items, 'bttn')).toEqual([])
    expect(searchTree(items, 'but ton')).toEqual([])
  })

  it('visits matching parents before their children and retains sibling order', () => {
    const source = addItemIds([{
      name: 'match-root',
      type: 'folder',
      children: [
        {
          name: 'match-z',
          type: 'folder',
          children: [{ name: 'match-file', type: 'file', size: 1 }],
        },
        { name: 'match-a', type: 'file', size: 2 },
      ],
    }, { name: 'match-other-root', type: 'folder' }])
    expect(searchTree(source, 'match').map(({ item }) => item.name))
      .toEqual(['match-root', 'match-z', 'match-file', 'match-a', 'match-other-root'])
  })

  it('returns every match without a result cap', () => {
    const source = addItemIds([{
      name: 'root',
      type: 'folder',
      children: Array.from({ length: 1000 }, (_, index) => ({
        name: `file-${index}.txt`, type: 'file', size: index,
      })),
    }])
    const matches = searchTree(source, '.txt')
    expect(matches).toHaveLength(1000)
    expect(matches[999].fullPath).toBe('root/file-999.txt')
  })

  it('traverses deep trees without introducing a recursive search limit', () => {
    let item: FileTreeItem = { id: 'leaf', name: 'leaf', type: 'file', size: 1 }
    for (let depth = 0; depth < 20000; depth++) {
      item = { id: `folder-${depth}`, name: 'folder', type: 'folder', children: [item] }
    }
    const matches = searchTree([item], 'leaf')
    expect(matches).toHaveLength(1)
    expect(matches[0].fullPath).toBe(`${'folder/'.repeat(20000)}leaf`)
  })
})
