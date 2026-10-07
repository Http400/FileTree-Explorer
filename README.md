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

const items = [
  {
    id: 'src',
    label: 'src',
    children: [{ id: 'src/App.tsx', label: 'App.tsx' }],
  },
]

export function ProjectTree() {
  return <FileTree items={items} aria-label="Project files" />
}
```

See **Components/FileTree** in Storybook for default, initially expanded,
checkbox multi-selection, disabled-item, empty-tree, and controlled
selection/expansion examples. The wrapper accepts the
[RichTreeView API](https://mui.com/x/api/tree-view/rich-tree-view/) directly.
