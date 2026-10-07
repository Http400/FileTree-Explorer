import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TreeViewDefaultItemModelProperties as FileItem } from '@mui/x-tree-view/models'
import { FileTree } from './FileTree'

const items: FileItem[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      {
        id: 'src/components',
        label: 'components',
        children: [
          {
            id: 'src/components/FileTree.tsx',
            label: 'FileTree.tsx',
          },
        ],
      },
      { id: 'src/App.tsx', label: 'App.tsx' },
      { id: 'src/main.tsx', label: 'main.tsx' },
    ],
  },
  {
    id: 'public',
    label: 'public',
    children: [{ id: 'public/favicon.svg', label: 'favicon.svg' }],
  },
  { id: 'package.json', label: 'package.json' },
  { id: 'README.md', label: 'README.md' },
]

const meta = {
  title: 'Components/FileTree',
  component: FileTree<FileItem>,
  decorators: [
    (Story) => (
      <div style={{ width: 360, maxWidth: '100%', textAlign: 'left' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    items,
    'aria-label': 'Project files',
  },
} satisfies Meta<typeof FileTree<FileItem>>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InitiallyExpanded: Story = {
  args: {
    defaultExpandedItems: ['src', 'src/components', 'public'],
  },
}

export const CheckboxMultiSelection: StoryObj<typeof FileTree<FileItem, true>> = {
  args: {
    ...meta.args,
    multiSelect: true,
    checkboxSelection: true,
    defaultExpandedItems: ['src'],
    defaultSelectedItems: ['src/App.tsx', 'README.md'],
  },
}

export const DisabledItems: Story = {
  args: {
    defaultExpandedItems: ['src'],
    isItemDisabled: (item) => item.id === 'src/main.tsx',
  },
}

export const EmptyTree: Story = {
  args: {
    items: [],
  },
}

export const ControlledSelectionAndExpansion: Story = {
  render: function ControlledFileTree(args) {
    const [selectedItems, setSelectedItems] = useState<string | null>('src/App.tsx')
    const [expandedItems, setExpandedItems] = useState<string[]>(['src'])

    return (
      <FileTree
        {...args}
        selectedItems={selectedItems}
        expandedItems={expandedItems}
        onSelectedItemsChange={(_, itemId) => setSelectedItems(itemId)}
        onExpandedItemsChange={(_, itemIds) => setExpandedItems(itemIds)}
      />
    )
  },
}
