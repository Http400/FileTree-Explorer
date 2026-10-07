import { useId } from 'react'
import { Link as RouterLink } from 'react-router'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { FileTreeItem } from '../FileTree/addItemIds'
import { formatBytes } from '../../utils/formatBytes'
import { getFolderSize } from './getFolderSize'

export type FolderDetailsProps = {
  folder: Extract<FileTreeItem, { type: 'folder' }>
  getChildTo: (child: FileTreeItem) => string
}

export function FolderDetails({ folder, getChildTo }: FolderDetailsProps) {
  const headingId = useId()
  const childrenHeadingId = useId()
  const children = folder.children ?? []

  return (
    <Stack
      component="section"
      spacing={0.5}
      aria-labelledby={headingId}
      sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
    >
      <Typography id={headingId} component="h2" variant="h6">Folder details</Typography>
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
        <Typography component="dd">{folder.name}</Typography>
        <Typography component="dt">Direct children</Typography>
        <Typography component="dd">{children.length}</Typography>
        <Typography component="dt">Total size</Typography>
        <Typography component="dd">{formatBytes(getFolderSize(folder))}</Typography>
      </Box>
      <Box>
        <Typography id={childrenHeadingId} component="h3" variant="body1" sx={{ fontWeight: 600 }}>
          Children
        </Typography>
        {children.length === 0 ? (
          <Typography sx={{ mt: 0.5 }}>This folder is empty.</Typography>
        ) : (
          <List
            aria-labelledby={childrenHeadingId}
            disablePadding
            sx={{ display: 'grid', gap: 0.5, pt: 0.5 }}
          >
            {children.map((child) => (
              <ListItem key={child.id} disableGutters sx={{ gap: 1, py: 0, alignItems: 'baseline' }}>
                <Link
                  component={RouterLink}
                  to={getChildTo(child)}
                  sx={{ minWidth: 0, whiteSpace: 'pre-wrap' }}
                >
                  {child.name}
                </Link>
                <Typography component="span" variant="body2" color="text.secondary">
                  {child.type === 'folder' ? 'Folder' : 'File'}
                </Typography>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Stack>
  )
}
