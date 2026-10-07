import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  addItemIds,
  DuplicateItemNameError,
  type FileTreeItem,
  type FileTreeNode,
} from './addItemIds'

const root: FileTreeNode = {
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
  ],
}

function getIds(items: readonly FileTreeItem[]): string[] {
  return items.flatMap((item) => [
    item.id,
    ...(item.type === 'folder' && item.children ? getIds(item.children) : []),
  ])
}

function expectFreshNodes(items: FileTreeItem[], nodes: readonly FileTreeNode[]) {
  expect(items).not.toBe(nodes)
  expect(items).toHaveLength(nodes.length)

  items.forEach((item, index) => {
    const node = nodes[index]
    expect(item).not.toBe(node)
    if (item.type === 'folder' && node.type === 'folder' && node.children) {
      if (item.children === undefined) {
        throw new Error(`Missing children for ${item.id}`)
      }
      expectFreshNodes(item.children, node.children)
    }
  })
}

describe('addItemIds', () => {
  it('adds exact path IDs to the task example without changing its data shape', () => {
    expect(addItemIds([root])).toStrictEqual([
      {
        id: 'root',
        name: 'root',
        type: 'folder',
        children: [
          {
            id: 'root/src',
            name: 'src',
            type: 'folder',
            children: [
              {
                id: 'root/src/index.ts',
                name: 'index.ts',
                type: 'file',
                size: 1024,
              },
              {
                id: 'root/src/components',
                name: 'components',
                type: 'folder',
                children: [
                  {
                    id: 'root/src/components/Button.tsx',
                    name: 'Button.tsx',
                    type: 'file',
                    size: 512,
                  },
                ],
              },
            ],
          },
          {
            id: 'root/package.json',
            name: 'package.json',
            type: 'file',
            size: 300,
          },
        ],
      },
    ])
  })

  it('leaves input unchanged and creates new nodes and arrays at every level', () => {
    const nodes: FileTreeNode[] = [
      structuredClone(root),
      { name: 'empty', type: 'folder', children: [] },
    ]
    const before = structuredClone(nodes)
    const items = addItemIds(nodes)

    expect(nodes).toStrictEqual(before)
    expectFreshNodes(items, nodes)
  })

  it('returns an empty array for empty input', () => {
    expect(addItemIds([])).toStrictEqual([])
  })

  it('preserves both empty folders and folders with omitted children', () => {
    expect(
      addItemIds([
        { name: 'empty', type: 'folder', children: [] },
        { name: 'omitted', type: 'folder' },
      ]),
    ).toStrictEqual([
      { name: 'empty', type: 'folder', children: [], id: 'empty' },
      { name: 'omitted', type: 'folder', id: 'omitted' },
    ])
  })

  it('allows identical names under different parents', () => {
    const nodes: FileTreeNode[] = ['src', 'tests'].map((name) => ({
      name,
      type: 'folder',
      children: [{ name: 'index.ts', type: 'file', size: 0 }],
    }))

    expect(getIds(addItemIds(nodes))).toStrictEqual([
      'src',
      'src/index.ts',
      'tests',
      'tests/index.ts',
    ])
  })

  it('rejects duplicate top-level names with their name and context', () => {
    expect(() => addItemIds([root, structuredClone(root)])).toThrow(DuplicateItemNameError)
    expect(() => addItemIds([root, structuredClone(root)])).toThrow(
      'Duplicate item name "root" under the top level.',
    )
  })

  it('rejects duplicate nested names with the full parent path', () => {
    const nodes: FileTreeNode[] = [
      {
        name: 'root',
        type: 'folder',
        children: [
          {
            name: 'src',
            type: 'folder',
            children: [
              { name: 'index.ts', type: 'file', size: 1 },
              { name: 'index.ts', type: 'file', size: 2 },
            ],
          },
        ],
      },
    ]
    const before = structuredClone(nodes)

    expect(() => addItemIds(nodes)).toThrow(
      'Duplicate item name "index.ts" under "root/src".',
    )
    expect(nodes).toStrictEqual(before)
  })

  it('rejects a file and folder with the same sibling name', () => {
    expect(() =>
      addItemIds([
        {
          name: 'root',
          type: 'folder',
          children: [
            { name: 'src', type: 'file', size: 0 },
            { name: 'src', type: 'folder', children: [] },
          ],
        },
      ]),
    ).toThrow('Duplicate item name "src" under "root".')
  })

  it('distinguishes slashes, literal percent escapes, and nested paths', () => {
    const items = addItemIds([
      {
        name: 'root',
        type: 'folder',
        children: [
          { name: 'a/b', type: 'file', size: 0 },
          {
            name: 'a',
            type: 'folder',
            children: [{ name: 'b', type: 'file', size: 0 }],
          },
          { name: 'a%2Fb', type: 'file', size: 0 },
        ],
      },
    ])

    expect(getIds(items)).toStrictEqual([
      'root',
      'root/a%2Fb',
      'root/a',
      'root/a/b',
      'root/a%252Fb',
    ])
  })

  it.each([
    ['my folder', 'my%20folder'],
    ['100%', '100%25'],
    ['a?b#c', 'a%3Fb%23c'],
    ['caf\u00e9', 'caf%C3%A9'],
    ['a/b', 'a%2Fb'],
  ])('encodes the name %s once without changing displayed names', (name, encoded) => {
    expect(
      addItemIds([
        {
          name,
          type: 'folder',
          children: [{ name: 'my file.ts', type: 'file', size: 0 }],
        },
      ]),
    ).toStrictEqual([
      {
        name,
        type: 'folder',
        id: encoded,
        children: [
          {
            name: 'my file.ts',
            type: 'file',
            size: 0,
            id: `${encoded}/my%20file.ts`,
          },
        ],
      },
    ])
  })

  it('produces deterministic IDs independently of sibling ordering', () => {
    const nodes: FileTreeNode[] = [
      {
        name: 'src',
        type: 'folder',
        children: [
          { name: 'a.ts', type: 'file', size: 1 },
          { name: 'b.ts', type: 'file', size: 2 },
        ],
      },
      { name: 'README.md', type: 'file', size: 3 },
    ]
    const reordered = nodes.toReversed().map((node) =>
      node.type === 'folder'
        ? { ...node, children: node.children?.toReversed() }
        : node,
    )
    const items = addItemIds(nodes)

    expect(addItemIds(nodes)).toStrictEqual(items)
    expect(getIds(addItemIds(reordered))).toStrictEqual([
      'README.md',
      'src',
      'src/b.ts',
      'src/a.ts',
    ])
    expect(getIds(addItemIds(reordered)).sort()).toStrictEqual(getIds(items).sort())
  })

  it('changes descendant IDs predictably when their ancestor is renamed or moved', () => {
    const renamed: FileTreeNode = { ...root, name: 'project' }
    const moved: FileTreeNode = {
      name: 'workspace',
      type: 'folder',
      children: [root],
    }
    const originalIds = getIds(addItemIds([root]))

    expect(getIds(addItemIds([renamed]))).toStrictEqual(
      originalIds.map((id) => id.replace(/^root/, 'project')),
    )
    expect(getIds(addItemIds([moved]))).toStrictEqual([
      'workspace',
      ...originalIds.map((id) => `workspace/${id}`),
    ])
  })

  it('retains discriminated file metadata and enriched child types', () => {
    for (const item of addItemIds([root])) {
      expectTypeOf(item.id).toEqualTypeOf<string>()
      expectTypeOf(item.name).toEqualTypeOf<string>()
      if (item.type === 'folder') {
        expectTypeOf(item.children).toEqualTypeOf<FileTreeItem[] | undefined>()
      } else {
        expectTypeOf(item.size).toEqualTypeOf<number>()
      }
    }
  })
})
