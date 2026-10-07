# FileTree Explorer

A React and TypeScript file-tree explorer built with Vite.

## Development

```bash
npm install
npm run dev
```

## App flow

At `/`, paste a file-tree JSON object or use **Upload JSON file**, then click
**Validate JSON**. Valid input opens `/tree`, with the root folder selected and
expanded and its details displayed beside the tree. On small screens, details
appear below the tree. Select a file or folder label to see its details; use the
expansion icon to expand or collapse without changing selection.
Keyboard users can navigate with arrow keys and select with Space. Enter toggles
expandable folders or selects a leaf, following MUI's tree keyboard behavior.
Invalid input stays on `/` with an error; typing or uploading alone does not
navigate.

Tree selections and folder child links share the same node URLs. Back/Forward
updates the details and selection, revealing the selected node's ancestors while
preserving other expansion choices. Expanding or collapsing alone does not add
history entries. File details show the original readable path from the root.

The root URL is `/tree`. Other URLs encode the complete item ID as one segment,
for example `/tree/root%2Fsrc%2Findex.ts`. This is separate from the ID's own
per-name encoding: a file named `a/b` has ID `root/a%2Fb` and URL
`/tree/root%2Fa%252Fb`, distinct from nested `a` and `b`.
`treeNavigation` reads the raw pathname and decodes its suffix once because
React Router's decoded parameters can collapse those distinct IDs.

An unknown node or malformed node URL keeps the tree visible and displays an
error with **Back to root folder**. Selecting a valid tree item also recovers.

Use **Enter another JSON** to return to a blank input and submit a different
tree. The latest validated tree is held only in React memory: it survives
Back/Forward navigation while the app is mounted, but not a page refresh or a new
tab. Opening or refreshing `/tree` or a node-detail URL without that state
redirects to `/`. Paths outside the explorer also redirect to `/`. URLs contain
only the selected node ID, not a saved tree; no tree is stored in browser storage
or on a server. Submitting a new tree resets selection and expansion to its root.

Production hosting must serve `index.html` as the fallback for client-side
routes such as `/tree` and `/tree/root%2Fsrc`; otherwise a direct visit may
produce a server-side 404.

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

Open the **Components** stories to explore individual components. The
**Components/FileTreeInput** stories include self-running interaction checks
for JSON validation and uploads. **Components/FileDetails** and
**Components/FolderDetails** cover metadata, prop updates, empty folders, and
child-link navigation. **Components/TreeExplorer** exercises the integrated
layout, routed selection, history, keyboard navigation, expansion, and errors.

`npm run build-storybook` compiles the stories but does not execute their
interaction checks; open each story in a browser to run its `play` function.

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

## JSON input

`FileTreeInput` provides an editable textarea, **Upload JSON file**, and
**Validate JSON** controls. Files are read locally into the textarea with their
original formatting; nothing is uploaded to a server.

```tsx
import { useState } from 'react'
import { FileTreeInput } from './src/components/FileTreeInput/FileTreeInput'
import type { FileTreeRoot } from './src/components/FileTreeInput/parseFileTreeJson'

export function ImportTree() {
  const [root, setRoot] = useState<FileTreeRoot | null>(null)

  return (
    <>
      <FileTreeInput onValid={setRoot} />
      {root && <p>Validated root: {root.name}</p>}
    </>
  )
}
```

Both props are optional: `initialValue` supplies the initial text only, and
`onValid` receives the validated folder root after **Validate JSON** is clicked.
Typing or uploading does not validate or call the callback. No IDs are added to
the returned data, and additional metadata is preserved. The component does not
navigate, render a tree, or persist the draft. `App` connects its `onValid`
callback to the in-memory tree state and route navigation.

Validation requires one folder root with nonblank Unicode names and node types
`file` or `folder`. Files require a nonnegative safe-integer `size` in bytes and
cannot have children. Folder `children` must be an array or omitted. Duplicate
sibling names are rejected using the same check as `addItemIds`. Schema errors
identify the affected field, for example `$.children[0].size`.

Uploaded text remains editable, even if it is invalid JSON. Controls are disabled
while reading; read failures preserve the previous draft and show an error.
Editing or starting another upload clears previous validation feedback. The
`.json` file-picker filter is a hint; contents are checked on explicit validation.
There is no explicit file-size or depth cap, so very large/deep inputs remain
subject to browser memory, responsiveness, and recursion limits.

See **Components/FileTreeInput** in Storybook for the input states and
self-running interaction checks, including uploads and read failures.

## File and folder details

`FileDetails` and `FolderDetails` are reusable, prop-driven MUI components.
`App` displays them through `TreeExplorer` at `/tree` and its detail URLs.
The explorer owns node lookup, URL-driven selection, and expansion; the details
components themselves do not modify the tree or store selection.

`FileDetails` requires a `file` (the file variant of `FileTreeNode`) and a
readable `fullPath` including the root name. Files enriched by `addItemIds`
are also accepted. The component displays Name, Size, and Full path without
decoding or constructing the supplied path.

```tsx
import { FileDetails } from './src/components/FileDetails/FileDetails'

export function SelectedFile() {
  return (
    <FileDetails
      file={{ name: 'index.ts', type: 'file', size: 1536 }}
      fullPath="root/src/index.ts"
    />
  )
}
```

`FolderDetails` requires a `folder` (the folder variant of `FileTreeItem`,
including IDs on its children) and `getChildTo(child): string`. It displays Name,
Direct children, Total size, and a list of direct children in input order.
Links show the original child names and distinguish files from folders.
Omitted or empty children display `0`, `0 B`, and **This folder is empty.**

Folder details must be rendered inside a React Router context, such as the app's
existing `BrowserRouter`. File details do not need a router. `getChildTo` owns
URL construction; the component forwards its result to a React Router `Link`
without encoding or rewriting it. `TreeExplorer` supplies the app's destinations;
other consumers must implement their own matching routes.

```tsx
import { FolderDetails, type FolderDetailsProps } from './src/components/FolderDetails/FolderDetails'

// Render within a router and supply destinations handled by your application.
export function SelectedFolder({ folder, getChildTo }: FolderDetailsProps) {
  return <FolderDetails folder={folder} getChildTo={getChildTo} />
}
```

Both components expect validated filesystem data and export their prop types.
They share 1024-based size formatting: `0 B`, `1023 B`, `1 KB`, `1.5 KB`,
`1 MB`. KB/MB values are rounded to at most two decimals without trailing zeros.
The unit is chosen before rounding (so 1,048,575 bytes displays as `1024 KB`),
and MB remains the largest unit (1 GB displays as `1024 MB`).

Folder totals include all descendant files, not just direct children. The
iterative helper avoids recursive traversal limits and uses `bigint` internally
to preserve exact byte totals even when their sum exceeds the safe-integer
range; input data and file sizes remain unchanged. Totals are recalculated from
current props in linear time, with no global index or cache. The shared
`formatBytes` helper rejects negative or non-safe-integer numeric sizes rather
than displaying fallback values.

Explore the details stories for typical, empty, long-name/path, special-character,
large-size, and changing-selection examples. Folder stories use an isolated
`MemoryRouter` and story-only URLs; those URLs do not add application routes.

## Tests

Run the Vitest unit tests (Storybook interaction checks run separately in the
browser):

```bash
npm test
```

Run only the ID helper's tests:

```bash
npm test -- src/components/FileTree/addItemIds.test.ts
```

Run the JSON parser and ID helper tests together:

```bash
npm test -- src/components/FileTreeInput/parseFileTreeJson.test.ts src/components/FileTree/addItemIds.test.ts
```

Run the size formatter and folder-total tests together:

```bash
npm test -- src/utils/formatBytes.test.ts src/components/FolderDetails/getFolderSize.test.ts
```

Run routed node-lookup and URL-encoding tests with the ID helper tests:

```bash
npm test -- src/components/TreeExplorer/treeNavigation.test.ts src/components/FileTree/addItemIds.test.ts
```
