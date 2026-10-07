import {
  addItemIds,
  DuplicateItemNameError,
  type FileTreeNode,
} from '../FileTree/addItemIds'

export type FileTreeRoot = Extract<FileTreeNode, { type: 'folder' }>

export type FileTreeJsonResult =
  | { success: true; root: FileTreeRoot }
  | { success: false; error: string }

class FileTreeSchemaError extends Error {}

function assertNode(value: unknown, path: string): asserts value is FileTreeNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FileTreeSchemaError(`${path}: Expected a file or folder object.`)
  }

  if (!('name' in value) || typeof value.name !== 'string' || !value.name.trim()) {
    throw new FileTreeSchemaError(`${path}.name: Expected a nonblank string.`)
  }

  try {
    encodeURIComponent(value.name)
  } catch (error) {
    if (!(error instanceof URIError)) throw error
    throw new FileTreeSchemaError(`${path}.name: Expected valid Unicode.`)
  }

  if (!('type' in value) || (value.type !== 'file' && value.type !== 'folder')) {
    throw new FileTreeSchemaError(`${path}.type: Expected "file" or "folder".`)
  }

  if (value.type === 'file') {
    if (
      !('size' in value) ||
      typeof value.size !== 'number' ||
      !Number.isSafeInteger(value.size) ||
      value.size < 0
    ) {
      throw new FileTreeSchemaError(
        `${path}.size: Expected a nonnegative safe integer in bytes.`,
      )
    }
    if ('children' in value) {
      throw new FileTreeSchemaError(`${path}.children: Files cannot have children.`)
    }
    return
  }

  if ('children' in value) {
    if (!Array.isArray(value.children)) {
      throw new FileTreeSchemaError(`${path}.children: Expected an array.`)
    }
    value.children.forEach((child: unknown, index) => {
      assertNode(child, `${path}.children[${index}]`)
    })
  }
}

export function parseFileTreeJson(text: string): FileTreeJsonResult {
  if (!text.trim()) {
    return { success: false, error: 'Paste JSON or upload a JSON file before validating.' }
  }

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return { success: false, error: `Invalid JSON: ${error.message}` }
  }

  try {
    assertNode(value, '$')
    if (value.type !== 'folder') {
      return { success: false, error: '$: Expected a folder root.' }
    }
    addItemIds([value])
  } catch (error) {
    if (error instanceof FileTreeSchemaError || error instanceof DuplicateItemNameError) {
      return { success: false, error: error.message }
    }
    if (error instanceof RangeError) {
      return { success: false, error: 'This tree is too deeply nested to validate in this browser.' }
    }
    throw error
  }

  return { success: true, root: value }
}
