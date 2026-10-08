import { Link as RouterLink } from 'react-router'
import AppBar from '@mui/material/AppBar'
import Link from '@mui/material/Link'
import SvgIcon from '@mui/material/SvgIcon'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'

export function Navbar() {
  return (
    <AppBar
      component="header"
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar
        component="nav"
        aria-label="Main navigation"
        className="app-navbar-content"
        disableGutters
      >
        <Link
          component={RouterLink}
          to="/"
          color="inherit"
          underline="none"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
        >
          <SvgIcon color="primary" aria-hidden="true" focusable="false">
            <path
              d="M3 5h6l2 2h10v13H3zM7 10v7h4m-4-5h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </SvgIcon>
          <Typography component="h1" variant="h6">FileTree Explorer</Typography>
        </Link>
      </Toolbar>
    </AppBar>
  )
}
