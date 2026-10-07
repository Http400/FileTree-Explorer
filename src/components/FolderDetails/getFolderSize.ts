import type { FileTreeNode } from '../FileTree/addItemIds'

export function getFolderSize(folder: Extract<FileTreeNode, { type: 'folder' }>): bigint {
  const pending: FileTreeNode[] = [folder]
  let total = 0n
  let node = pending.pop()

  while (node !== undefined) {
    if (node.type === 'file') {
      total += BigInt(node.size)
    } else {
      for (const child of node.children ?? []) {
        pending.push(child)
      }
    }
    node = pending.pop()
  }

  return total
}
