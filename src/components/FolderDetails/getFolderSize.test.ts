import { describe, expect, it } from 'vitest'
import { addItemIds, type FileTreeNode } from '../FileTree/addItemIds'
import { getFolderSize } from './getFolderSize'

type Folder = Extract<FileTreeNode, { type: 'folder' }>

describe('getFolderSize', () => {
  it.each<Folder>([
    { name: 'empty', type: 'folder' },
    { name: 'empty', type: 'folder', children: [] },
    {
      name: 'empty',
      type: 'folder',
      children: [{ name: 'nested', type: 'folder', children: [] }],
    },
    {
      name: 'empty',
      type: 'folder',
      children: [{ name: 'zero.txt', type: 'file', size: 0 }],
    },
  ])('returns zero for a folder with no nonempty files: %j', (folder) => {
    expect(getFolderSize(folder)).toBe(0n)
  })

  it('sums every file once across mixed and nested children without mutating input', () => {
    const folder: Folder = {
      name: 'root',
      type: 'folder',
      children: [
        { name: 'index.ts', type: 'file', size: 300 },
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
        { name: 'empty', type: 'folder' },
      ],
    }
    const before = structuredClone(folder)

    expect(getFolderSize(folder)).toBe(1836n)
    expect(folder).toStrictEqual(before)

    const [item] = addItemIds([folder])
    if (item.type !== 'folder') throw new Error('Expected a folder fixture')
    expect(getFolderSize(item)).toBe(1836n)
  })

  it('keeps aggregate bytes exact when individually valid sizes exceed the safe total', () => {
    expect(getFolderSize({
      name: 'large',
      type: 'folder',
      children: [
        { name: 'a', type: 'file', size: Number.MAX_SAFE_INTEGER },
        { name: 'b', type: 'file', size: Number.MAX_SAFE_INTEGER },
        { name: 'c', type: 'file', size: 1 },
      ],
    })).toBe(18014398509481983n)
  })

  it('handles deeply nested folders without recursive traversal', () => {
    let folder: Folder = {
      name: 'leaf',
      type: 'folder',
      children: [{ name: 'file', type: 'file', size: 42 }],
    }
    for (let depth = 0; depth < 20000; depth++) {
      folder = { name: 'parent', type: 'folder', children: [folder] }
    }

    expect(getFolderSize(folder)).toBe(42n)
  })
})
