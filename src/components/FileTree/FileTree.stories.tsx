import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileTree } from './FileTree'
import { addItemIds, type FileTreeItem, type FileTreeNode } from './addItemIds'

const root: FileTreeNode = {
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'src',
      type: 'folder',
      children: [
        { name: 'index.ts', type: 'file', size: 1024 },
        {
          name: 'components',
          type: 'folder',
          children: [{ name: 'Button.tsx', type: 'file', size: 512 }],
        },
      ],
    },
    { name: 'package.json', type: 'file', size: 300 },
  ],
}

const items = addItemIds([root])
const getItemLabel = (item: FileTreeItem) => item.name

const meta = {
  title: 'Components/FileTree',
  component: FileTree<FileTreeItem>,
  decorators: [
    (Story) => (
      <div style={{ width: 360, maxWidth: '100%', textAlign: 'left' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    items,
    getItemLabel,
    'aria-label': 'Project files',
  },
} satisfies Meta<typeof FileTree<FileTreeItem>>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InitiallyExpanded: Story = {
  args: {
    defaultExpandedItems: ['root', 'root/src', 'root/src/components'],
  },
}

export const CheckboxMultiSelection: StoryObj<typeof FileTree<FileTreeItem, true>> = {
  args: {
    ...meta.args,
    multiSelect: true,
    checkboxSelection: true,
    defaultExpandedItems: ['root', 'root/src', 'root/src/components'],
    defaultSelectedItems: ['root/src/index.ts', 'root/package.json'],
  },
}

export const DisabledItems: Story = {
  args: {
    defaultExpandedItems: ['root', 'root/src'],
    isItemDisabled: (item) => item.id === 'root/src/index.ts',
  },
}

export const EmptyTree: Story = {
  args: {
    items: [],
  },
}

export const ControlledSelectionAndExpansion: Story = {
  render: function ControlledFileTree(args) {
    const [selectedItems, setSelectedItems] = useState<string | null>('root/src/index.ts')
    const [expandedItems, setExpandedItems] = useState<string[]>(['root', 'root/src'])

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
