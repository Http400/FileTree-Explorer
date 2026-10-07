# FileTree Explorer

A React and TypeScript file-tree explorer built with Vite.

## Development

```bash
npm install
npm run dev
```

## App flow

At `/`, paste a file-tree JSON object or use **Upload JSON file**, then click
**Validate JSON**. Valid input opens `/tree`, where the submitted structure is
rendered with its root expanded. Expand nested folders to explore their contents.
Invalid input stays on `/` with an error; typing or uploading alone does not
navigate.

Use **Enter another JSON** to return to a blank input and submit a different
tree. The latest validated tree is held only in React memory: it survives
Back/Forward navigation while the app is mounted, but not a page refresh or a new
tab. Opening or refreshing `/tree` without that state redirects to `/`. Unknown
paths also redirect to `/`. No tree data is stored in the URL, browser storage,
or on a server.

Production hosting must serve `index.html` as the fallback for client-side
routes such as `/tree`; otherwise a direct visit may produce a server-side 404.

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
for JSON validation and uploads.

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
