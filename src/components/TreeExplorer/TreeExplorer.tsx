import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import Alert from '@mui/material/Alert'
import { FileDetails } from '../FileDetails/FileDetails'
import { FileTree } from '../FileTree/FileTree'
import type { FileTreeItem } from '../FileTree/addItemIds'
import { FolderDetails } from '../FolderDetails/FolderDetails'
import { TreeSearch } from '../TreeSearch/TreeSearch'
import { searchTree } from '../TreeSearch/searchTree'
import { findTreeNode, getNodeUrl, resolveNodePath } from './treeNavigation'

export type TreeExplorerProps = {
  items: FileTreeItem[]
}

const getItemLabel = (item: FileTreeItem) => item.name

export function TreeExplorer({ items }: TreeExplorerProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const rootId = items[0].id
  const query = new URLSearchParams(location.search).get('q') ?? ''
  const results = useMemo(() => searchTree(items, query), [items, query])
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
    pathname: location.pathname,
    expandedIds: [...new Set([rootId, ...(selected?.ancestorIds ?? [])])],
  }))

  let expandedIds = expansion.expandedIds
  if (expansion.items !== items || expansion.pathname !== location.pathname) {
    // Reveal ancestors on node navigation, but not when only the search changes.
    expandedIds = [...new Set([
      ...(expansion.items === items ? expandedIds : [rootId]),
      ...(selected?.ancestorIds ?? []),
    ])]
    setExpansion({ items, pathname: location.pathname, expandedIds })
  }

  function getItemUrl(itemId: string) {
    return getNodeUrl(itemId, rootId) + location.search
  }

  function handleQueryChange(value: string) {
    const params = new URLSearchParams(location.search)
    if (value) params.set('q', value)
    else params.delete('q')
    navigate({
      pathname: location.pathname,
      search: params.toString(),
      hash: location.hash,
    }, { replace: true })
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
                navigate(getItemUrl(itemId))
              }
            }}
            onExpandedItemsChange={(_, itemIds) => {
              setExpansion({ items, pathname: location.pathname, expandedIds: itemIds })
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
                getChildTo={(child) => getItemUrl(child.id)}
              />
            )
          ) : (
            <Alert severity="error">
              <p>{resolvedPath.success ? 'File or folder not found.' : resolvedPath.error}</p>
              <Link className="app-link" to={getItemUrl(rootId)}>Back to root folder</Link>
            </Alert>
          )}
        </div>
        <div className="app-search">
          <TreeSearch
            query={query}
            onQueryChange={handleQueryChange}
            results={results}
            getResultTo={(item) => getItemUrl(item.id)}
          />
        </div>
      </div>
      <Link className="app-link" to="/">Enter another JSON</Link>
    </section>
  )
}
