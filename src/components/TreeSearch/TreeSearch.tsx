import { useId } from 'react'
import { Link as RouterLink } from 'react-router'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { FileTreeItem } from '../FileTree/addItemIds'
import type { TreeSearchResult } from './searchTree'

export type TreeSearchProps = {
  query: string
  onQueryChange: (query: string) => void
  results: readonly TreeSearchResult[]
  getResultTo: (item: FileTreeItem) => string
}

export function TreeSearch({ query, onQueryChange, results, getResultTo }: TreeSearchProps) {
  const headingId = useId()
  const statusId = useId()
  const hasQuery = query.trim().length > 0

  return (
    <Stack component="section" spacing={2} aria-labelledby={headingId}>
      <Typography id={headingId} component="h2" variant="h6">Search</Typography>
      <TextField
        type="search"
        label="Search files and folders"
        fullWidth
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        slotProps={{ htmlInput: { 'aria-describedby': statusId } }}
      />
      <Typography id={statusId} role="status" variant="body2" color="text.secondary">
        {!hasQuery
          ? 'Enter a name to search files and folders.'
          : results.length === 0
            ? 'No files or folders found.'
            : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
      </Typography>
      {hasQuery && results.length > 0 && (
        <List aria-label="Search results" disablePadding>
          {results.map(({ item, fullPath }) => (
            <ListItem key={item.id} disableGutters sx={{ py: 0.5 }}>
              <Link
                component={RouterLink}
                to={getResultTo(item)}
                aria-label={`${item.type === 'file' ? 'File' : 'Folder'}: ${item.name}, ${fullPath}`}
                underline="hover"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  gap: 1,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <span aria-hidden="true">{item.type === 'file' ? '\u{1F4C4}' : '\u{1F4C1}'}</span>
                <span>
                  <Typography component="span" sx={{ display: 'block' }}>{item.name}</Typography>
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                    {fullPath}
                  </Typography>
                </span>
              </Link>
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  )
}
