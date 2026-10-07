import type { FileTreeItem } from '../FileTree/addItemIds'
import type { TreeNodeDetails } from '../TreeExplorer/treeNavigation'

export type TreeSearchResult = Pick<TreeNodeDetails, 'item' | 'fullPath'>

export function searchTree(items: readonly FileTreeItem[], query: string): TreeSearchResult[] {
  const term = query.trim().toLowerCase()
  if (!term) return []

  const results: TreeSearchResult[] = []
  const pending = items.map((item) => ({ item, fullPath: item.name })).reverse()
  let entry = pending.pop()

  while (entry !== undefined) {
    if (entry.item.name.toLowerCase().includes(term)) results.push(entry)

    if (entry.item.type === 'folder') {
      const children = entry.item.children ?? []
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index]
        pending.push({ item: child, fullPath: `${entry.fullPath}/${child.name}` })
      }
    }
    entry = pending.pop()
  }

  return results
}
