# FileTree Explorer

A React and TypeScript file-tree explorer built with Vite.

## Development

```bash
npm install
npm run dev
```

## VPS deployment

The deployment target is **http://145.239.83.11:8080**. A single Nginx container
serves the production Vite bundle through Docker Compose; no Node process,
backend, database, domain, or certificate is required on the VPS. Instigi and
its Caddy remain untouched. Only host TCP port 8080 is published.

This is **plain HTTP**: delivery of the app is neither encrypted nor
authenticated. JSON is processed and saved locally by the browser, not uploaded
to the VPS, but HTTP does not protect the JavaScript delivered to visitors.
Saved trees are scoped to this exact origin; data from localhost, another port,
or a future HTTPS URL does not migrate automatically.

### One-time VPS and GitHub setup

1. Install Docker Engine and the Compose v2 plugin on Ubuntu. The SSH deployment
   user needs Docker access (which is effectively root access), Bash, `curl`,
   `flock` from `util-linux`, and write access to
   `/home/ubuntu/filetree-explorer`. Verify `docker info`, `docker compose
   version`, and `docker compose up --help` support `--wait` and `--wait-timeout`.
   Check `uname -m` (`x86_64` or `aarch64`) and `df -h`; images support both
   `linux/amd64` and `linux/arm64`.
2. Check `sudo ss -ltnp 'sport = :8080'` and `docker ps` before deployment. If
   another service owns 8080, do not stop it: resolve the conflict first. Create
   `/home/ubuntu/filetree-explorer/releases` as the deployment user. Record
   Instigi's existing container status/port mappings for comparison afterwards.
3. Allow inbound TCP 8080 in the provider firewall and any Docker-aware host
   firewall rules, without changing existing SSH/Instigi rules. Docker-published
   ports can bypass ordinary UFW filtering; use the provider firewall or
   appropriate Docker firewall rules for source restrictions.
4. Install a dedicated deployment SSH public key in the user's `authorized_keys`.
   Obtain the server's SSH host key through a trusted VPS console and verify its
   fingerprint independently. Do not blindly trust a key scanned during a
   deployment.
5. In this repository, create the GitHub environment **production**, restrict it
   to `master`, and add the secrets below. Secrets configured only in Instigi
   are not automatically available here.

| Secret | Value |
| --- | --- |
| `VPS_HOST` | `145.239.83.11` |
| `VPS_USER` | The SSH user, normally `ubuntu` |
| `VPS_SSH_KEY` | Dedicated SSH private key usable noninteractively by Actions |
| `VPS_KNOWN_HOSTS` | Verified OpenSSH known-hosts entry for the exact `VPS_HOST` |

For example, the public host-key file `/etc/ssh/ssh_host_ed25519_key.pub` can
be inspected in the provider console. A known-hosts entry has the format
`145.239.83.11 ssh-ed25519 <public-key-data>`. Never copy the server's private
host key or commit deployment private keys.

No OVH DNS credentials or VPS GHCR token are needed. The workflow uses its
temporary `GITHUB_TOKEN` to publish images. On the **first publication**, GitHub
may create `ghcr.io/http400/filetree-explorer` as a private package. Make the
package public in its GitHub package settings, then **rerun failed jobs** if the
anonymous-pull check blocked deployment. That check runs before touching the
VPS. Ensure the repository has Actions access to the package if it already
exists.

### CI and release behavior

`.github/workflows/deploy.yml` checks pull requests and pushes to `master`.
Lint, unit tests, type-check/build, deployment regression checks, and real
container HTTP checks must pass before publication. Storybook is not published,
and its browser interaction checks are not claimed as part of CI.

Pushes to `master` and **Actions > CI and deploy > Run workflow** on `master`
publish both image architectures, tagged with the full commit SHA. Deployments
use the immutable image digest, not a mutable tag. Manual runs on another
branch cannot publish or deploy. Production deployments are serialized without
cancelling an active rollout; stale queued revisions are skipped.

Each release is staged under
`/home/ubuntu/filetree-explorer/releases/<sha>-<run>-<attempt>`, containing its
Compose manifest, deployment script, and generated `.env` with nonsecret image,
port, and source-SHA metadata. The Compose project is always `filetree-explorer`.
Pull/configuration failures leave the running release untouched. Compose waits
for health, then the runner checks the public application, exact baked
`/version.txt` revision, SPA deep links, and static assets. Only a verified
release is finalized.

Image pulls use a temporary empty Docker credential configuration. This prevents
an unrelated or expired GHCR login on the shared VPS from blocking public pulls;
existing registry credentials and other applications remain unchanged.

A failed rollout or smoke check restores the previous manifest and cached image
and verifies the previous public revision. The workflow stays failed even when
recovery succeeds. A first deployment has no previous release: failed candidate
resources are removed and the failure is reported. If rollback or SSH fails,
state and diagnostics remain for manual recovery; recovery cannot be guaranteed
during a VPS/network outage. A single-container replacement can briefly
interrupt service.

After the first successful run, open the public URL, import JSON, select a node,
and refresh its deep link to verify localStorage restoration. Compare Instigi's
container status/ports with the pre-deployment snapshot.

### Status and recovery

Run on the VPS, as the deployment user:

```bash
ROOT=/home/ubuntu/filetree-explorer
RELEASE=$(cat "$ROOT/current")
docker compose --project-name filetree-explorer \
  --file "$ROOT/releases/$RELEASE/docker-compose.prod.yml" \
  --env-file "$ROOT/releases/$RELEASE/.env" ps
docker compose --project-name filetree-explorer \
  --file "$ROOT/releases/$RELEASE/docker-compose.prod.yml" \
  --env-file "$ROOT/releases/$RELEASE/.env" logs --tail 100
```

`current` is the last verified release, `previous` is its rollback target, and
`pending` records an unverified replacement. If a job loses its connection,
inspect `pending` and logs before starting another deployment. While pending,
use that release's manifest for status/logs instead of `current`.

To recover a pending release, or roll back a finalized release:

```bash
ROOT=/home/ubuntu/filetree-explorer
if [ -f "$ROOT/pending" ]; then
  CANDIDATE=$(cat "$ROOT/pending")
else
  CANDIDATE=$(cat "$ROOT/current")
fi
bash "$ROOT/releases/$CANDIDATE/deploy.sh" rollback "$ROOT" "$CANDIDATE"
```

Run recovery only when no Actions deployment is in progress; the script also
locks individual state-changing operations. When no previous release exists,
the script exits nonzero and explicitly reports that rollback was impossible.
After restoring a release, use the checked-out repository on your workstation
to run `bash scripts/smoke-test.sh http://145.239.83.11:8080 <restored-full-sha>`.
Do not finalize a pending release manually without verifying it first.

For a manual first deployment outside Actions, obtain the published SHA's
manifest digest with `docker buildx imagetools inspect
ghcr.io/http400/filetree-explorer:<full-sha>`. Copy this repository's Compose
manifest and `scripts/deploy.sh` into a new
`$ROOT/releases/<full-sha>-0-1` directory and create its `.env` on the VPS with
`APP_IMAGE=ghcr.io/http400/filetree-explorer@sha256:<digest>`, `APP_PORT=8080`,
and `APP_SHA=<full-sha>`. Call that script's `activate` action, run the external
smoke check, then call `finalize` on success or `rollback` on failure.
Use a new numeric run/attempt suffix for subsequent manual releases.

Keep the current, previous, and pending release directories and their images.
Remove only explicitly identified older FileTree releases/images when reclaiming
space. Never use global Docker pruning, `down --volumes`, or cleanup targeting
Instigi.

### Local production-image check

With Docker, Buildx, and Compose installed:

```bash
SHA=$(git rev-parse HEAD)
docker build --build-arg APP_SHA="$SHA" -t filetree-explorer:local .
APP_IMAGE=filetree-explorer:local APP_PORT=18080 \
  docker compose -p filetree-explorer-local -f docker-compose.prod.yml up -d --wait
bash scripts/smoke-test.sh http://localhost:18080 "$SHA"
APP_IMAGE=filetree-explorer:local APP_PORT=18080 \
  docker compose -p filetree-explorer-local -f docker-compose.prod.yml down
bash scripts/deploy.test.sh
```

The configuration serves SPA routes without URL redirects, including encoded
node names ending in `.js`. Only `/assets/` receives immutable caching; missing
assets return 404, while HTML and revision metadata revalidate.

## App flow

At `/`, paste a file-tree JSON object or use **Upload JSON file**, then click
**Validate JSON**. Valid input opens `/tree`, with the root folder selected and
expanded and its details displayed beside the tree. Wide screens show the tree,
details, and search side by side. Search appears below details at intermediate
widths, and all panels stack on small screens. Select a file or folder label to
see its details; use the expansion icon to expand or collapse without changing
selection.
Keyboard users can navigate with arrow keys and select with Space. Enter toggles
expandable folders or selects a leaf, following MUI's tree keyboard behavior.
Invalid input stays on `/` with an error; typing or uploading alone does not
navigate.

Tree selections, folder child links, and search results share the same node URLs.
Back/Forward updates the details and selection, revealing the selected node's ancestors while
preserving other expansion choices. Expanding or collapsing alone does not add
history entries. File details show the original readable path from the root.

The root URL is `/tree`. Other URLs encode the complete item ID as one segment,
for example `/tree/root%2Fsrc%2Findex.ts`. This is separate from the ID's own
per-name encoding: a file named `a/b` has ID `root/a%2Fb` and URL
`/tree/root%2Fa%252Fb`, distinct from nested `a` and `b`.
`treeNavigation` reads the raw pathname and decodes its suffix once because
React Router's decoded parameters can collapse those distinct IDs.

An unknown node or malformed node URL keeps the tree visible and displays an
error with **Back to root folder**. Selecting a valid tree item also recovers.

Use **Enter another JSON** to return to a blank input and submit a different
tree without erasing the saved tree. The latest validated tree, including its
metadata, is saved in this browser's `localStorage` under
`filetree-explorer:root:v1`. Refreshing `/tree` or a node-detail URL restores it,
with selection determined by the URL. Expansion choices are not saved; the root
and selected node's ancestors are expanded on load. A new valid submission
replaces the saved tree and resets selection and expansion to its root.
Unfinished input, uploaded-but-unvalidated text, and JSON formatting are not saved.

Visiting `/` still shows a blank input, even when a saved tree exists. Without a
usable saved tree, opening `/tree` or a node-detail URL redirects to `/`.
Paths outside the explorer also redirect to `/`. Invalid saved data or blocked
storage displays a warning and allows fresh input without deleting the stored
value. If saving fails (for example, storage is full), the new tree remains
usable in memory, but a warning explains that refreshing may restore an older
tree or lose the new tree. A later successful submission clears the warning.

Saved data is scoped to this site's origin and browser profile; a new tab on the
same origin can load it, but already-open tabs do not synchronize live. Clearing
site data removes it, and private-browsing storage may be temporary. URLs contain
the selected node ID and search query, not the tree, so sharing a URL does not
share its data. Nothing is saved on a server.

Production hosting must serve `index.html` as the fallback for client-side
routes such as `/tree` and `/tree/root%2Fsrc`; otherwise a direct visit may
produce a server-side 404.

## Name search

Use **Search files and folders** in the search panel to find names anywhere in
the loaded tree, including collapsed folders and the root. Matching is a live,
case-insensitive substring search on names only, not full paths or file contents.
Leading/trailing query whitespace is ignored for matching; internal spaces and
punctuation remain literal. All matches appear in tree order, with no result cap.
An empty/whitespace-only query shows a prompt, and a query with no matches shows
**No files or folders found.**

Each clickable result displays a file or folder icon and its name, followed by
its full readable path on a separate line:

```text
[file icon] Button.tsx
            root/src/components/Button.tsx
```

Selecting a result opens its details and selects it in the tree. Typing does not
automatically select a result, filter the tree, or reopen collapsed folders.

Search text is stored in the URL's `q` query parameter, for example
`/tree?q=Button` or `/tree/root%2Fsrc%2Fcomponents%2FButton.tsx?q=Button`.
Refreshing restores the search alongside the tree saved in localStorage.
The URL is the only source of search state; query edits do not write browser
storage. A shared URL still requires the matching tree in the recipient's browser.

Typing updates the URL immediately by replacing the current history entry,
so Back does not step through individual keystrokes. Result links, tree selection,
folder-child links, and **Back to root folder** retain the search. Back/Forward
restores the node and query from each visited URL. Clearing the input removes
`q` without removing unrelated query parameters. **Enter another JSON** and
submitting a different tree start without a search.

## Storybook

Run the component workshop locally:

```bash
npm run storybook
```

Storybook is available at [http://localhost:6006](http://localhost:6006).

Create a static Storybook bundle:

```bash
npm run build-storybook
```

Open the **Components** stories to explore individual components. The
**Components/FileTreeInput** stories include self-running interaction checks
for JSON validation and uploads. **Components/FileDetails** and
**Components/FolderDetails** cover metadata, prop updates, empty folders, and
child-link navigation. **Components/TreeExplorer** exercises the integrated
layout, routed selection, history, keyboard navigation, expansion, and errors.
It also covers live search, result links and paths, query history, special names,
and search changes preserving selection and expansion.
**App/Persistence** covers saving and restoring validated JSON, deep links,
replacement, blank input, storage-failure warnings and recovery, and restoring
search on a saved tree.

`npm run build-storybook` compiles the stories but does not execute their
interaction checks; open each story in a browser to run its `play` function.

## FileTree

`FileTree` is a thin wrapper around MUI X's `RichTreeView`. It forwards all props
and the DOM `ref` (`HTMLUListElement`), preserving MUI's generic item and selection
types without adding state, styling, or behavior. Its type is inherited directly
from `RichTreeView`.

```tsx
import { FileTree } from './src/components/FileTree/FileTree'
import {
  addItemIds,
  type FileTreeItem,
  type FileTreeNode,
} from './src/components/FileTree/addItemIds'

const root: FileTreeNode = {
  name: 'root',
  type: 'folder',
  children: [
    {
      name: 'src',
      type: 'folder',
      children: [{ name: 'index.ts', type: 'file', size: 1024 }],
    },
  ],
}

const items = addItemIds([root])
const getItemLabel = (item: FileTreeItem) => item.name

export function ProjectTree() {
  return (
    <FileTree
      items={items}
      getItemLabel={getItemLabel}
      aria-label="Project files"
    />
  )
}
```

`addItemIds` is an optional preprocessing helper for name-based filesystem data.
It returns new nodes and child arrays, preserving `name`, `type`, and file `size`
without mutating the input or adding `label` properties. Folders may have empty
or omitted `children`. Wrap a single root in an array, as above.

IDs include the root name and join individually URL-encoded names with `/`, for
example `root/src/index.ts`. A name containing `/`, such as `a/b`, becomes the
single segment `a%2Fb`, distinct from nested folders `a` and `b`. Duplicate
sibling names throw an error identifying the name and parent path, even for a
file and folder with the same name. The same name under different parents is
valid.

IDs are deterministic and unaffected by sibling ordering. Renaming or moving a
node changes its ID and its descendants' IDs. Treat IDs as opaque tree
identifiers, not ready-made router URLs. Keep the generated `items` and
`getItemLabel` references stable; for dynamic data, recompute the items only when
the source changes.

The wrapper still accepts native MUI `id`/`label` items without this helper or a
custom `getItemLabel`.

See **Components/FileTree** in Storybook for default, initially expanded,
checkbox multi-selection, disabled-item, empty-tree, and controlled
selection/expansion examples. The wrapper accepts the
[RichTreeView API](https://mui.com/x/api/tree-view/rich-tree-view/) directly.

## JSON input

`FileTreeInput` provides an editable textarea, **Upload JSON file**, and
**Validate JSON** controls. Files are read locally into the textarea with their
original formatting; nothing is uploaded to a server.

```tsx
import { useState } from 'react'
import { FileTreeInput } from './src/components/FileTreeInput/FileTreeInput'
import type { FileTreeRoot } from './src/components/FileTreeInput/parseFileTreeJson'

export function ImportTree() {
  const [root, setRoot] = useState<FileTreeRoot | null>(null)

  return (
    <>
      <FileTreeInput onValid={setRoot} />
      {root && <p>Validated root: {root.name}</p>}
    </>
  )
}
```

Both props are optional: `initialValue` supplies the initial text only, and
`onValid` receives the validated folder root after **Validate JSON** is clicked.
Typing or uploading does not validate or call the callback. No IDs are added to
the returned data, and additional metadata is preserved. The component does not
navigate, render a tree, or persist the draft. `App` connects its `onValid`
callback to tree state, localStorage persistence, and route navigation, and
restores saved data using the same JSON validation on startup.

Validation requires one folder root with nonblank Unicode names and node types
`file` or `folder`. Files require a nonnegative safe-integer `size` in bytes and
cannot have children. Folder `children` must be an array or omitted. Duplicate
sibling names are rejected using the same check as `addItemIds`. Schema errors
identify the affected field, for example `$.children[0].size`.

Uploaded text remains editable, even if it is invalid JSON. Controls are disabled
while reading; read failures preserve the previous draft and show an error.
Editing or starting another upload clears previous validation feedback. The
`.json` file-picker filter is a hint; contents are checked on explicit validation.
There is no explicit file-size or depth cap, so very large/deep inputs remain
subject to browser memory, responsiveness, and recursion limits.

See **Components/FileTreeInput** in Storybook for the input states and
self-running interaction checks, including uploads and read failures.

## File and folder details

`FileDetails` and `FolderDetails` are reusable, prop-driven MUI components.
`App` displays them through `TreeExplorer` at `/tree` and its detail URLs.
The explorer owns node lookup, URL-driven selection, and expansion; the details
components themselves do not modify the tree or store selection.

`FileDetails` requires a `file` (the file variant of `FileTreeNode`) and a
readable `fullPath` including the root name. Files enriched by `addItemIds`
are also accepted. The component displays Name, Size, and Full path without
decoding or constructing the supplied path.

```tsx
import { FileDetails } from './src/components/FileDetails/FileDetails'

export function SelectedFile() {
  return (
    <FileDetails
      file={{ name: 'index.ts', type: 'file', size: 1536 }}
      fullPath="root/src/index.ts"
    />
  )
}
```

`FolderDetails` requires a `folder` (the folder variant of `FileTreeItem`,
including IDs on its children) and `getChildTo(child): string`. It displays Name,
Direct children, Total size, and a list of direct children in input order.
Links show the original child names and distinguish files from folders.
Omitted or empty children display `0`, `0 B`, and **This folder is empty.**

Folder details must be rendered inside a React Router context, such as the app's
existing `BrowserRouter`. File details do not need a router. `getChildTo` owns
URL construction; the component forwards its result to a React Router `Link`
without encoding or rewriting it. `TreeExplorer` supplies the app's destinations;
other consumers must implement their own matching routes.

```tsx
import { FolderDetails, type FolderDetailsProps } from './src/components/FolderDetails/FolderDetails'

// Render within a router and supply destinations handled by your application.
export function SelectedFolder({ folder, getChildTo }: FolderDetailsProps) {
  return <FolderDetails folder={folder} getChildTo={getChildTo} />
}
```

Both components expect validated filesystem data and export their prop types.
They share 1024-based size formatting: `0 B`, `1023 B`, `1 KB`, `1.5 KB`,
`1 MB`. KB/MB values are rounded to at most two decimals without trailing zeros.
The unit is chosen before rounding (so 1,048,575 bytes displays as `1024 KB`),
and MB remains the largest unit (1 GB displays as `1024 MB`).

Folder totals include all descendant files, not just direct children. The
iterative helper avoids recursive traversal limits and uses `bigint` internally
to preserve exact byte totals even when their sum exceeds the safe-integer
range; input data and file sizes remain unchanged. Totals are recalculated from
current props in linear time, with no global index or cache. The shared
`formatBytes` helper rejects negative or non-safe-integer numeric sizes rather
than displaying fallback values.

Explore the details stories for typical, empty, long-name/path, special-character,
large-size, and changing-selection examples. Folder stories use an isolated
`MemoryRouter` and story-only URLs; those URLs do not add application routes.

## Tests

Run the Vitest unit tests (Storybook interaction checks run separately in the
browser):

```bash
npm test
```

Run only the ID helper's tests:

```bash
npm test -- src/components/FileTree/addItemIds.test.ts
```

Run the JSON parser and ID helper tests together:

```bash
npm test -- src/components/FileTreeInput/parseFileTreeJson.test.ts src/components/FileTree/addItemIds.test.ts
```

Run the size formatter and folder-total tests together:

```bash
npm test -- src/utils/formatBytes.test.ts src/components/FolderDetails/getFolderSize.test.ts
```

Run routed node-lookup and URL-encoding tests with the ID helper tests:

```bash
npm test -- src/components/TreeExplorer/treeNavigation.test.ts src/components/FileTree/addItemIds.test.ts
```
