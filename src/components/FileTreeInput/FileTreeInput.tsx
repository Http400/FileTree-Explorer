import { useId, useRef, useState, type ChangeEvent } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { parseFileTreeJson, type FileTreeRoot } from './parseFileTreeJson'

export type FileTreeInputProps = {
  initialValue?: string
  onValid?: (root: FileTreeRoot) => void
}

type Feedback = {
  type: 'validation-error' | 'upload-error' | 'success'
  message: string
}

export function FileTreeInput({ initialValue = '', onValid }: FileTreeInputProps) {
  const [text, setText] = useState(initialValue)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const feedbackId = useId()

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setFeedback(null)
    setIsReading(true)

    let contents: string
    try {
      contents = await file.text()
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      setFeedback({ type: 'upload-error', message: `Unable to read JSON file: ${reason}` })
      setIsReading(false)
      return
    }

    setText(contents)
    setIsReading(false)
  }

  function handleValidate() {
    const result = parseFileTreeJson(text)
    if (result.success === false) {
      setFeedback({ type: 'validation-error', message: result.error })
      return
    }

    setFeedback({ type: 'success', message: 'JSON is valid.' })
    onValid?.(result.root)
  }

  return (
    <Stack spacing={2}>
      <TextField
        label="File tree JSON"
        placeholder="Paste JSON here"
        multiline
        minRows={10}
        maxRows={20}
        fullWidth
        value={text}
        disabled={isReading}
        error={feedback?.type === 'validation-error'}
        onChange={(event) => {
          setText(event.target.value)
          setFeedback(null)
        }}
        slotProps={{
          htmlInput: {
            spellCheck: false,
            'aria-describedby': feedback || isReading ? feedbackId : undefined,
          },
        }}
      />
      <Stack direction="row" spacing={1}>
        <Button
          type="button"
          variant="outlined"
          disabled={isReading}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload JSON file
        </Button>
        <Button type="button" variant="contained" disabled={isReading} onClick={handleValidate}>
          Validate JSON
        </Button>
      </Stack>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        aria-label="JSON file"
        hidden
        disabled={isReading}
        onChange={handleFileChange}
      />
      {isReading && (
        <Typography id={feedbackId} role="status">
          Reading JSON file...
        </Typography>
      )}
      {feedback && (
        <Alert
          id={feedbackId}
          severity={feedback.type === 'success' ? 'success' : 'error'}
          role={feedback.type === 'success' ? 'status' : 'alert'}
        >
          {feedback.message}
        </Alert>
      )}
    </Stack>
  )
}
