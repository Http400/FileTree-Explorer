import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { FileTreeInput } from './FileTreeInput'
import type { FileTreeRoot } from './parseFileTreeJson'

const root = {
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
} satisfies FileTreeRoot

const json = JSON.stringify(root, null, 2)
const onValid = fn()

const meta = {
  title: 'Components/FileTreeInput',
  component: FileTreeInput,
  decorators: [
    (Story) => (
      <div style={{ width: 720, maxWidth: '100%', textAlign: 'left' }}>
        <Story />
      </div>
    ),
  ],
  args: { onValid },
  beforeEach: () => {
    onValid.mockClear()
  },
} satisfies Meta<typeof FileTreeInput>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByRole('textbox', { name: 'File tree JSON' })
    await expect(textarea).toHaveValue('')
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Paste JSON or upload a JSON file')
    await expect(args.onValid).not.toHaveBeenCalled()
    await userEvent.type(textarea, ' ')
    await userEvent.clear(textarea)
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
  },
}

export const Prefilled: Story = {
  args: { initialValue: json },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByRole('textbox', { name: 'File tree JSON' })
    const validate = canvas.getByRole('button', { name: 'Validate JSON' })

    await expect(args.onValid).not.toHaveBeenCalled()
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument()
    await userEvent.click(validate)
    await expect(canvas.getByRole('status')).toHaveTextContent('JSON is valid.')
    await expect(args.onValid).toHaveBeenCalledTimes(1)
    await expect(args.onValid).toHaveBeenCalledWith(root)
    await expect(textarea).toHaveValue(json)

    await userEvent.clear(textarea)
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument()
    await userEvent.type(textarea, ' ')
    await userEvent.paste(json)
    await expect(args.onValid).toHaveBeenCalledTimes(1)
    await userEvent.click(validate)
    await expect(args.onValid).toHaveBeenCalledTimes(2)
    await expect(args.onValid).toHaveBeenLastCalledWith(root)
    await expect(textarea).toHaveValue(` ${json}`)
  },
}

export const InvalidJson: Story = {
  args: { initialValue: '{"name":' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByRole('textbox', { name: 'File tree JSON' })
    const validate = canvas.getByRole('button', { name: 'Validate JSON' })

    await userEvent.click(validate)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Invalid JSON:')
    await expect(textarea).toHaveAttribute('aria-invalid', 'true')
    await expect(textarea).toHaveValue('{"name":')
    await userEvent.clear(textarea)
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.paste('{')
    await userEvent.click(validate)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Invalid JSON:')
    await expect(args.onValid).not.toHaveBeenCalled()
  },
}

export const InvalidStructure: Story = {
  args: {
    initialValue: JSON.stringify({
      name: 'root',
      type: 'folder',
      children: [{ name: 'index.ts', type: 'file', size: -1 }],
    }, null, 2),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('$.children[0].size')
    await expect(args.onValid).not.toHaveBeenCalled()
  },
}

export const DuplicateNames: Story = {
  args: {
    initialValue: JSON.stringify({
      name: 'root',
      type: 'folder',
      children: [
        { name: 'src', type: 'folder' },
        { name: 'src', type: 'file', size: 0 },
      ],
    }, null, 2),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Validate JSON' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Duplicate item name "src" under "root".',
    )
    await expect(args.onValid).not.toHaveBeenCalled()
  },
}

export const FileUpload: Story = {
  args: { initialValue: '{"draft":true}' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByRole('textbox', { name: 'File tree JSON' })
    const input = canvas.getByLabelText('JSON file')
    const upload = canvas.getByRole('button', { name: 'Upload JSON file' })
    const validate = canvas.getByRole('button', { name: 'Validate JSON' })
    const file = new File([json], 'tree.json', { type: 'application/json' })
    let resolveRead: (text: string) => void = () => {
      throw new Error('File read has not been initialized')
    }
    const pendingText = new Promise<string>((resolve) => {
      resolveRead = resolve
    })
    const read = fn(() => pendingText)
    Object.defineProperty(file, 'text', { value: read })

    await userEvent.upload(input, file)
    await expect(textarea).toBeDisabled()
    await expect(input).toBeDisabled()
    await expect(upload).toBeDisabled()
    await expect(validate).toBeDisabled()
    await expect(canvas.getByRole('status')).toHaveTextContent('Reading JSON file...')
    resolveRead(json)

    await waitFor(() => expect(textarea).toHaveValue(json))
    await expect(textarea).toBeEnabled()
    await expect(args.onValid).not.toHaveBeenCalled()
    await userEvent.click(validate)
    await expect(args.onValid).toHaveBeenCalledTimes(1)
    await expect(args.onValid).toHaveBeenCalledWith(root)

    await userEvent.upload(input, file)
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument()
    await expect(args.onValid).toHaveBeenCalledTimes(1)
    await userEvent.click(validate)
    await expect(args.onValid).toHaveBeenCalledTimes(2)
    await expect(args.onValid).toHaveBeenLastCalledWith(root)
  },
}

export const FileReadFailure: Story = {
  args: { initialValue: json },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const file = new File(['unreadable'], 'broken.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', {
      value: fn().mockRejectedValue(new DOMException('Access denied.', 'NotReadableError')),
    })

    await userEvent.upload(canvas.getByLabelText('JSON file'), file)
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Unable to read JSON file: Access denied.',
    )
    const textarea = canvas.getByRole('textbox', { name: 'File tree JSON' })
    await expect(textarea).toHaveValue(json)
    await expect(textarea).toBeEnabled()
    await expect(textarea).not.toHaveAttribute('aria-invalid', 'true')
    await expect(args.onValid).not.toHaveBeenCalled()
  },
}
