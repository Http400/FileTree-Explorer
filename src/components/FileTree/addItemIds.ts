type FileNode = {
  name: string
  type: 'file'
  size: number
}

type FolderNode = {
  name: string
  type: 'folder'
  children?: readonly FileTreeNode[]
}

export type FileTreeNode = FileNode | FolderNode

export type FileTreeItem =
  | (FileNode & { id: string })
  | (Omit<FolderNode, 'children'> & {
      id: string
      children?: FileTreeItem[]
    })

export function addItemIds(nodes: readonly FileTreeNode[]): FileTreeItem[] {
  function visit(
    siblings: readonly FileTreeNode[],
    parentId?: string,
  ): FileTreeItem[] {
    const names = new Set<string>()

    return siblings.map((node) => {
      if (names.has(node.name)) {
        const parent =
          parentId === undefined ? 'the top level' : JSON.stringify(parentId)
        throw new Error(
          `Duplicate item name ${JSON.stringify(node.name)} under ${parent}.`,
        )
      }
      names.add(node.name)

      const segment = encodeURIComponent(node.name)
      const id = parentId === undefined ? segment : `${parentId}/${segment}`

      if (node.type === 'file') {
        return { ...node, id }
      }

      const { children, ...folder } = node
      return children === undefined
        ? { ...folder, id }
        : { ...folder, id, children: visit(children, id) }
    })
  }

  return visit(nodes)
}
