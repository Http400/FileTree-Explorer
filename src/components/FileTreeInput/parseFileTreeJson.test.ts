import { describe, expect, expectTypeOf, it } from 'vitest'
import { parseFileTreeJson, type FileTreeRoot } from './parseFileTreeJson'

const root = {
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
} satisfies FileTreeRoot

describe('parseFileTreeJson', () => {
  it('returns the complete task example without adding IDs or changing data', () => {
    expect(parseFileTreeJson(JSON.stringify(root))).toStrictEqual({
      success: true,
      root,
    })
  })

  it('accepts empty folders and omitted children', () => {
    const input = {
      name: 'root',
      type: 'folder',
      children: [
        { name: 'empty', type: 'folder', children: [] },
        { name: 'omitted', type: 'folder' },
      ],
    }
    expect(parseFileTreeJson(JSON.stringify(input))).toStrictEqual({
      success: true,
      root: input,
    })
    expect(parseFileTreeJson('{"name":"root","type":"folder"}')).toStrictEqual({
      success: true,
      root: { name: 'root', type: 'folder' },
    })
  })

  it.each(['', ' \n\t ', '{', '{"name":}', '{"name":"root",}', '// comment'])(
    'reports empty input or malformed JSON: %j',
    (text) => {
      expect(parseFileTreeJson(text)).toEqual({
        success: false,
        error: expect.stringMatching(/^(Paste JSON|Invalid JSON:)/),
      })
    },
  )

  it.each(['null', '[]', 'true', '42', '"root"'])('rejects an invalid root: %s', (text) => {
    expect(parseFileTreeJson(text)).toEqual({
      success: false,
      error: '$: Expected a file or folder object.',
    })
  })

  it('rejects a file root', () => {
    expect(parseFileTreeJson('{"name":"index.ts","type":"file","size":0}')).toEqual({
      success: false,
      error: '$: Expected a folder root.',
    })
  })

  it.each([undefined, null, 1, '', ' \t\n'])('rejects an invalid name: %j', (name) => {
    expect(parseFileTreeJson(JSON.stringify({ name, type: 'folder' }))).toEqual({
      success: false,
      error: '$.name: Expected a nonblank string.',
    })
  })

  it('rejects names that cannot be encoded for IDs', () => {
    expect(parseFileTreeJson('{"name":"\\ud800","type":"folder"}')).toEqual({
      success: false,
      error: '$.name: Expected valid Unicode.',
    })
  })

  it.each([undefined, null, 'directory', 1])('rejects an invalid node type: %j', (type) => {
    expect(parseFileTreeJson(JSON.stringify({ name: 'root', type }))).toEqual({
      success: false,
      error: '$.type: Expected "file" or "folder".',
    })
  })

  it.each([undefined, null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1024', false])(
    'rejects an invalid file size: %j',
    (size) => {
      const input = {
        name: 'root',
        type: 'folder',
        children: [{ name: 'file', type: 'file', size }],
      }
      expect(parseFileTreeJson(JSON.stringify(input))).toEqual({
        success: false,
        error: '$.children[0].size: Expected a nonnegative safe integer in bytes.',
      })
    },
  )

  it('rejects nonfinite file sizes parsed from JSON numbers', () => {
    expect(
      parseFileTreeJson(
        '{"name":"root","type":"folder","children":[{"name":"file","type":"file","size":1e999}]}',
      ),
    ).toEqual({
      success: false,
      error: '$.children[0].size: Expected a nonnegative safe integer in bytes.',
    })
  })

  it.each([0, Number.MAX_SAFE_INTEGER])('accepts a valid size boundary: %s', (size) => {
    const input = {
      name: 'root',
      type: 'folder',
      children: [{ name: 'file', type: 'file', size }],
    }
    expect(parseFileTreeJson(JSON.stringify(input))).toEqual({ success: true, root: input })
  })

  it.each([{ children: [] }, { children: null }, { children: {} }])(
    'rejects children on files: %j',
    (extra) => {
      const input = {
        name: 'root',
        type: 'folder',
        children: [{ name: 'file', type: 'file', size: 0, ...extra }],
      }
      expect(parseFileTreeJson(JSON.stringify(input))).toEqual({
        success: false,
        error: '$.children[0].children: Files cannot have children.',
      })
    },
  )

  it.each([null, {}, 'children', 1])('rejects non-array folder children: %j', (children) => {
    expect(parseFileTreeJson(JSON.stringify({ name: 'root', type: 'folder', children }))).toEqual({
      success: false,
      error: '$.children: Expected an array.',
    })
  })

  it.each([{ child: null }, { child: [] }, { child: 'file' }, { child: 1 }])(
    'reports the location of an invalid nested node: $child',
    ({ child }) => {
      const input = {
        name: 'root',
        type: 'folder',
        children: [{ name: 'src', type: 'folder', children: [child] }],
      }
      expect(parseFileTreeJson(JSON.stringify(input))).toEqual({
        success: false,
        error: '$.children[0].children[0]: Expected a file or folder object.',
      })
    },
  )

  it('uses the existing duplicate-name check for file/folder siblings', () => {
    const input = {
      name: 'root',
      type: 'folder',
      children: [
        { name: 'same', type: 'file', size: 0 },
        { name: 'same', type: 'folder' },
      ],
    }
    expect(parseFileTreeJson(JSON.stringify(input))).toEqual({
      success: false,
      error: 'Duplicate item name "same" under "root".',
    })
  })

  it('accepts repeated names under different parents and preserves metadata and names', () => {
    const input = {
      name: ' root ',
      type: 'folder',
      metadata: { owner: 'example', tags: ['test'] },
      children: ['a/b', 'a%2Fb', 'caf\u00e9'].map((name) => ({
        name,
        type: 'folder',
        children: [{ name: 'same.ts', type: 'file', size: 0, executable: false }],
      })),
    }
    expect(parseFileTreeJson(JSON.stringify(input))).toStrictEqual({
      success: true,
      root: input,
    })
  })

  it('returns a typed folder root', () => {
    const result = parseFileTreeJson(JSON.stringify(root))
    expect(result.success).toBe(true)
    if (result.success) {
      expectTypeOf(result.root).toEqualTypeOf<FileTreeRoot>()
      expectTypeOf(result.root.type).toEqualTypeOf<'folder'>()
    }
  })

  it('reports recursion capacity errors instead of crashing', () => {
    const text =
      '{"name":"folder","type":"folder","children":['.repeat(20_000) +
      '{"name":"leaf","type":"file","size":0}' +
      ']}'.repeat(20_000)

    expect(parseFileTreeJson(text)).toEqual({
      success: false,
      error: 'This tree is too deeply nested to validate in this browser.',
    })
  })
})
