import { useId } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { FileTreeNode } from '../FileTree/addItemIds'
import { formatBytes } from '../../utils/formatBytes'

export type FileDetailsProps = {
  file: Extract<FileTreeNode, { type: 'file' }>
  fullPath: string
}

export function FileDetails({ file, fullPath }: FileDetailsProps) {
  const headingId = useId()

  return (
    <Stack
      component="section"
      spacing={0.5}
      aria-labelledby={headingId}
      sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
    >
      <Typography id={headingId} component="h2" variant="h6">File details</Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'max-content minmax(0, 1fr)',
          rowGap: 0.5,
          columnGap: 2,
          '& dt': { fontWeight: 600 },
          '& dd': { m: 0, whiteSpace: 'pre-wrap' },
        }}
      >
        <Typography component="dt">Name</Typography>
        <Typography component="dd">{file.name}</Typography>
        <Typography component="dt">Size</Typography>
        <Typography component="dd">{formatBytes(file.size)}</Typography>
        <Typography component="dt">Full path</Typography>
        <Typography component="dd">{fullPath}</Typography>
      </Box>
    </Stack>
  )
}
