import type { FileTreeItem } from '../FileTree/addItemIds'

export type NodePathResult =
  | { success: true; itemId: string }
  | { success: false; error: string }

export type TreeNodeDetails = {
  item: FileTreeItem
  fullPath: string
  ancestorIds: string[]
}

export function getNodeUrl(itemId: string, rootId: string): string {
  return itemId === rootId ? '/tree' : `/tree/${encodeURIComponent(itemId)}`
}

export function resolveNodePath(pathname: string, rootId: string): NodePathResult {
  if (pathname === '/tree' || pathname === '/tree/') {
    return { success: true, itemId: rootId }
  }

  const suffix = pathname.slice('/tree/'.length)
  if (!pathname.startsWith('/tree/') || !suffix || suffix.includes('/')) {
    return { success: false, error: 'Invalid node URL.' }
  }

  try {
    // Router params can turn an encoded slash inside a name into an ID separator.
    return { success: true, itemId: decodeURIComponent(suffix) }
  } catch (error) {
    if (!(error instanceof URIError)) throw error
    return { success: false, error: 'Invalid node URL: malformed path encoding.' }
  }
}

type NodeEntry = {
  item: FileTreeItem
  parent?: NodeEntry
}

export function findTreeNode(
  items: readonly FileTreeItem[],
  itemId: string,
): TreeNodeDetails | undefined {
  const pending: NodeEntry[] = items.map((item) => ({ item }))
  let entry = pending.pop()

  while (entry !== undefined) {
    if (entry.item.id === itemId) {
      const names = [entry.item.name]
      const ancestorIds: string[] = []
      let parent = entry.parent
      while (parent !== undefined) {
        names.push(parent.item.name)
        ancestorIds.push(parent.item.id)
        parent = parent.parent
      }
      return {
        item: entry.item,
        fullPath: names.reverse().join('/'),
        ancestorIds: ancestorIds.reverse(),
      }
    }

    if (entry.item.type === 'folder') {
      for (const child of entry.item.children ?? []) {
        pending.push({ item: child, parent: entry })
      }
    }
    entry = pending.pop()
  }
}
