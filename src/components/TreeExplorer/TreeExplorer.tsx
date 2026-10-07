import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import Alert from '@mui/material/Alert'
import { FileDetails } from '../FileDetails/FileDetails'
import { FileTree } from '../FileTree/FileTree'
import type { FileTreeItem } from '../FileTree/addItemIds'
import { FolderDetails } from '../FolderDetails/FolderDetails'
import { findTreeNode, getNodeUrl, resolveNodePath } from './treeNavigation'

export type TreeExplorerProps = {
  items: FileTreeItem[]
}

const getItemLabel = (item: FileTreeItem) => item.name

export function TreeExplorer({ items }: TreeExplorerProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const rootId = items[0].id
  const resolvedPath = useMemo(
    () => resolveNodePath(location.pathname, rootId),
    [location.pathname, rootId],
  )
  const selected = useMemo(
    () => resolvedPath.success ? findTreeNode(items, resolvedPath.itemId) : undefined,
    [items, resolvedPath],
  )
  const [expansion, setExpansion] = useState(() => ({
    items,
    locationKey: location.key,
    expandedIds: [...new Set([rootId, ...(selected?.ancestorIds ?? [])])],
  }))

  let expandedIds = expansion.expandedIds
  if (expansion.items !== items || expansion.locationKey !== location.key) {
    // Reveal ancestors once per navigation, but allow users to collapse them afterward.
    expandedIds = [...new Set([
      ...(expansion.items === items ? expandedIds : [rootId]),
      ...(selected?.ancestorIds ?? []),
    ])]
    setExpansion({ items, locationKey: location.key, expandedIds })
  }

  return (
    <section className="app-page" aria-labelledby="tree-heading">
      <h2 id="tree-heading">Your file tree</h2>
      <div className="app-explorer">
        <div className="app-tree">
          <FileTree
            items={items}
            getItemLabel={getItemLabel}
            selectedItems={selected?.item.id ?? null}
            expandedItems={expandedIds}
            expansionTrigger="iconContainer"
            slotProps={{
              item: {
                slotProps: {
                  iconContainer: {
                    onClick: (event) => event.stopPropagation(),
                  },
                },
              },
            }}
            onSelectedItemsChange={(_, itemId) => {
              if (itemId !== null && itemId !== selected?.item.id) {
                navigate(getNodeUrl(itemId, rootId))
              }
            }}
            onExpandedItemsChange={(_, itemIds) => {
              setExpansion({ items, locationKey: location.key, expandedIds: itemIds })
            }}
            aria-label="Project files"
          />
        </div>
        <div className="app-details">
          {selected ? (
            selected.item.type === 'file' ? (
              <FileDetails file={selected.item} fullPath={selected.fullPath} />
            ) : (
              <FolderDetails
                folder={selected.item}
                getChildTo={(child) => getNodeUrl(child.id, rootId)}
              />
            )
          ) : (
            <Alert severity="error">
              <p>{resolvedPath.success ? 'File or folder not found.' : resolvedPath.error}</p>
              <Link className="app-link" to="/tree">Back to root folder</Link>
            </Alert>
          )}
        </div>
      </div>
      <Link className="app-link" to="/">Enter another JSON</Link>
    </section>
  )
}
