import {
  parseFileTreeJson,
  type FileTreeRoot,
} from '../components/FileTreeInput/parseFileTreeJson'

export const FILE_TREE_STORAGE_KEY = 'filetree-explorer:root:v1'

type LoadResult =
  | { success: true; root: FileTreeRoot | null }
  | { success: false; error: string }

type SaveResult =
  | { success: true }
  | { success: false; error: string }

export function loadFileTree(): LoadResult {
  let text: string | null
  try {
    text = window.localStorage.getItem(FILE_TREE_STORAGE_KEY)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `Unable to load the saved tree: ${reason} You can still enter JSON to explore a tree.`,
    }
  }

  if (text === null) return { success: true, root: null }

  const result = parseFileTreeJson(text)
  if (!result.success) {
    return {
      success: false,
      error: `Unable to load the saved tree: ${result.error} Enter and validate new JSON to replace it.`,
    }
  }
  return result
}

export function saveFileTree(root: FileTreeRoot): SaveResult {
  try {
    const text = JSON.stringify(root)
    window.localStorage.setItem(FILE_TREE_STORAGE_KEY, text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `Your tree is open but could not be saved: ${reason} Refreshing may restore an older tree or lose this tree.`,
    }
  }
  return { success: true }
}
