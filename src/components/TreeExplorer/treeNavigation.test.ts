import { describe, expect, it } from 'vitest'
import { matchRoutes } from 'react-router'
import { addItemIds, type FileTreeItem, type FileTreeNode } from '../FileTree/addItemIds'
import { findTreeNode, getNodeUrl, resolveNodePath } from './treeNavigation'

const root: FileTreeNode = {
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'src',
      type: 'folder',
      children: [{ name: 'index.ts', type: 'file', size: 1024 }],
    },
    { name: 'empty', type: 'folder' },
  ],
}

describe('node URLs', () => {
  it('uses /tree for the root and accepts a trailing slash on the root route', () => {
    expect(getNodeUrl('root', 'root')).toBe('/tree')
    expect(resolveNodePath('/tree', 'root')).toEqual({ success: true, itemId: 'root' })
    expect(resolveNodePath('/tree/', 'root')).toEqual({ success: true, itemId: 'root' })
  })

  it('encodes the complete opaque ID as a single path segment', () => {
    const url = getNodeUrl('root/src/index.ts', 'root')
    expect(url).toBe('/tree/root%2Fsrc%2Findex.ts')
    expect(resolveNodePath(url, 'root')).toEqual({ success: true, itemId: 'root/src/index.ts' })
  })

  it.each(['my folder', 'caf\u00e9', 'a?b#c', '100%', 'a/b', 'a%2Fb', '.', '..'])(
    'round-trips the name %s through a browser-normalized URL',
    (name) => {
      const [item] = addItemIds([{
        name,
        type: 'folder',
        children: [{ name, type: 'file', size: 0 }],
      }])
      if (item.type !== 'folder' || !item.children) throw new Error('Invalid fixture')
      const child = item.children[0]
      const pathname = new URL(getNodeUrl(child.id, item.id), 'https://example.test').pathname

      expect(matchRoutes([{ path: '/tree/*' }], pathname)).not.toBeNull()
      expect(resolveNodePath(pathname, item.id)).toEqual({ success: true, itemId: child.id })
      expect(findTreeNode([item], child.id)?.fullPath).toBe(`${name}/${name}`)
      expect(getNodeUrl(item.id, item.id)).toBe('/tree')
      expect(resolveNodePath('/tree', item.id)).toEqual({ success: true, itemId: item.id })
    },
  )

  it('keeps slash names, literal percent escapes, and nested paths distinct', () => {
    const ids = ['root/a%2Fb', 'root/a/b', 'root/a%252Fb']
    const urls = ids.map((id) => getNodeUrl(id, 'root'))
    expect(urls).toEqual([
      '/tree/root%2Fa%252Fb',
      '/tree/root%2Fa%2Fb',
      '/tree/root%2Fa%25252Fb',
    ])
    expect(urls.map((url) => resolveNodePath(url, 'root')))
      .toEqual(ids.map((itemId) => ({ success: true, itemId })))
  })

  it.each(['/other', '/treehouse', '/tree//', '/tree/root/src', '/tree/%', '/tree/%ZZ', '/tree/%E0%A4'])(
    'explicitly rejects invalid path %s instead of selecting the root',
    (path) => {
      expect(resolveNodePath(path, 'root')).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid node URL'),
      })
    },
  )
})

describe('findTreeNode', () => {
  it('returns original items, readable paths, and ancestor IDs without mutation', () => {
    const items = addItemIds([root])
    const before = structuredClone(items)
    const result = findTreeNode(items, 'root/src/index.ts')

    expect(result).toEqual({
      item: { id: 'root/src/index.ts', name: 'index.ts', type: 'file', size: 1024 },
      fullPath: 'root/src/index.ts',
      ancestorIds: ['root', 'root/src'],
    })
    if (items[0].type !== 'folder' || items[0].children?.[0].type !== 'folder') {
      throw new Error('Invalid fixture')
    }
    expect(result?.item).toBe(items[0].children[0].children?.[0])
    expect(items).toStrictEqual(before)
  })

  it('resolves the root and an empty folder', () => {
    const items = addItemIds([root])
    expect(findTreeNode(items, 'root')).toEqual({
      item: items[0], fullPath: 'root', ancestorIds: [],
    })
    expect(findTreeNode(items, 'root/empty')).toEqual({
      item: { id: 'root/empty', name: 'empty', type: 'folder' },
      fullPath: 'root/empty',
      ancestorIds: ['root'],
    })
  })

  it('does not confuse identical names under different parents', () => {
    const items = addItemIds([{
      name: 'root',
      type: 'folder',
      children: ['src', 'test'].map((name) => ({
        name,
        type: 'folder',
        children: [{ name: 'index.ts', type: 'file', size: name === 'src' ? 1 : 2 }],
      })),
    }])
    expect(findTreeNode(items, 'root/test/index.ts')?.item)
      .toMatchObject({ size: 2 })
    expect(findTreeNode(items, 'root/src/index.ts')?.item)
      .toMatchObject({ size: 1 })
  })

  it('returns no node for missing IDs or an empty tree', () => {
    expect(findTreeNode(addItemIds([root]), 'root/missing')).toBeUndefined()
    expect(findTreeNode([], 'root')).toBeUndefined()
  })

  it('traverses deep trees without adding a recursive lookup limit', () => {
    let item: FileTreeItem = { id: 'leaf', name: 'leaf', type: 'file', size: 1 }
    for (let depth = 0; depth < 20000; depth++) {
      item = { id: `folder-${depth}`, name: 'folder', type: 'folder', children: [item] }
    }
    const result = findTreeNode([item], 'leaf')
    expect(result?.ancestorIds).toHaveLength(20000)
    expect(result?.fullPath).toBe(`${'folder/'.repeat(20000)}leaf`)
  })
})
