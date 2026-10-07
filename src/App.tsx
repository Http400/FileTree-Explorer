import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router'
import { FileTree } from './components/FileTree/FileTree'
import { addItemIds, type FileTreeItem } from './components/FileTree/addItemIds'
import { FileTreeInput } from './components/FileTreeInput/FileTreeInput'
import type { FileTreeRoot } from './components/FileTreeInput/parseFileTreeJson'
import './App.css'

const getItemLabel = (item: FileTreeItem) => item.name

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
          path="/tree"
          element={items ? (
            <section className="app-page" aria-labelledby="tree-heading">
              <h2 id="tree-heading">Your file tree</h2>
              <div className="app-tree">
                <FileTree
                  items={items}
                  getItemLabel={getItemLabel}
                  defaultExpandedItems={[items[0].id]}
                  aria-label="Project files"
                />
              </div>
              <Link className="app-link" to="/">Enter another JSON</Link>
            </section>
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
