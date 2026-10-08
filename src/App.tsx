import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'
import Alert from '@mui/material/Alert'
import { addItemIds } from './components/FileTree/addItemIds'
import { FileTreeInput } from './components/FileTreeInput/FileTreeInput'
import type { FileTreeRoot } from './components/FileTreeInput/parseFileTreeJson'
import { Navbar } from './components/Navbar/Navbar'
import { TreeExplorer } from './components/TreeExplorer/TreeExplorer'
import { loadFileTree, saveFileTree } from './utils/fileTreeStorage'
import './App.css'

type TreeState = {
  root: FileTreeRoot | null
  storageWarning: string | null
}

function App() {
  const [{ root, storageWarning }, setTreeState] = useState<TreeState>(() => {
    const result = loadFileTree()
    return result.success
      ? { root: result.root, storageWarning: null }
      : { root: null, storageWarning: result.error }
  })
  const items = useMemo(() => root ? addItemIds([root]) : null, [root])
  const navigate = useNavigate()

  function handleValid(acceptedRoot: FileTreeRoot) {
    const result = saveFileTree(acceptedRoot)
    setTreeState({
      root: acceptedRoot,
      storageWarning: result.success ? null : result.error,
    })
    navigate('/tree')
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app">
        {storageWarning && (
          <Alert severity="warning" sx={{ mb: 3 }}>{storageWarning}</Alert>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <section className="app-page" aria-labelledby="input-heading">
                <h2 id="input-heading">Enter JSON</h2>
                <p>
                  Paste or upload a JSON file, then click Validate JSON to explore its file tree.
                </p>
                <FileTreeInput onValid={handleValid} />
              </section>
            }
          />
          <Route
            path="/tree/*"
            element={items ? (
              <TreeExplorer items={items} />
            ) : (
              <Navigate to="/" replace />
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
