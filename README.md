# FileTree Explorer

A React and TypeScript file-tree explorer built with Vite.

## Development

```bash
npm install
npm run dev
```

## Storybook

Run the component workshop locally:

```bash
npm run storybook
```

Storybook is available at [http://localhost:6006](http://localhost:6006).

Create a static Storybook bundle:

```bash
npm run build-storybook
```

## FileTree

`FileTree` is a thin wrapper around MUI X's `RichTreeView`. It forwards all props
and the DOM `ref` (`HTMLUListElement`), preserving MUI's generic item and selection
types without adding state, styling, or behavior. Its type is inherited directly
from `RichTreeView`.

```tsx
import { FileTree } from './src/components/FileTree/FileTree'
import {
  addItemIds,
  type FileTreeItem,
  type FileTreeNode,
} from './src/components/FileTree/addItemIds'

const root: FileTreeNode = {
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'src',
      type: 'folder',
      children: [{ name: 'index.ts', type: 'file', size: 1024 }],
    },
  ],
}

const items = addItemIds([root])
const getItemLabel = (item: FileTreeItem) => item.name

export function ProjectTree() {
  return (
    <FileTree
      items={items}
      getItemLabel={getItemLabel}
      aria-label="Project files"
    />
  )
}
```

`addItemIds` is an optional preprocessing helper for name-based filesystem data.
It returns new nodes and child arrays, preserving `name`, `type`, and file `size`
without mutating the input or adding `label` properties. Folders may have empty
or omitted `children`. Wrap a single root in an array, as above.

IDs include the root name and join individually URL-encoded names with `/`, for
example `root/src/index.ts`. A name containing `/`, such as `a/b`, becomes the
single segment `a%2Fb`, distinct from nested folders `a` and `b`. Duplicate
sibling names throw an error identifying the name and parent path, even for a
file and folder with the same name. The same name under different parents is
valid.

IDs are deterministic and unaffected by sibling ordering. Renaming or moving a
node changes its ID and its descendants' IDs. Treat IDs as opaque tree
identifiers, not ready-made router URLs. Keep the generated `items` and
`getItemLabel` references stable; for dynamic data, recompute the items only when
the source changes.

The wrapper still accepts native MUI `id`/`label` items without this helper or a
custom `getItemLabel`.

See **Components/FileTree** in Storybook for default, initially expanded,
checkbox multi-selection, disabled-item, empty-tree, and controlled
selection/expansion examples. The wrapper accepts the
[RichTreeView API](https://mui.com/x/api/tree-view/rich-tree-view/) directly.

## Tests

Run the Vitest unit tests:

```bash
npm test
```

Run only the ID helper's tests:

```bash
npm test -- src/components/FileTree/addItemIds.test.ts
```
