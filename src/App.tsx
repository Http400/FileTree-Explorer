import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'
import { addItemIds } from './components/FileTree/addItemIds'
import { FileTreeInput } from './components/FileTreeInput/FileTreeInput'
import type { FileTreeRoot } from './components/FileTreeInput/parseFileTreeJson'
import { TreeExplorer } from './components/TreeExplorer/TreeExplorer'
import './App.css'

function App() {
  const [root, setRoot] = useState<FileTreeRoot | null>(null)
  const items = useMemo(() => root ? addItemIds([root]) : null, [root])
  const navigate = useNavigate()

  function handleValid(acceptedRoot: FileTreeRoot) {
    setRoot(acceptedRoot)
    navigate('/tree')
  }

  return (
    <main className="app">
      <h1>FileTree Explorer</h1>
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
  )
}

export default App
