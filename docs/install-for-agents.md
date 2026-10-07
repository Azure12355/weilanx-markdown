# Install Weilanx Markdown (instructions for AI agents)

You are installing **Weilanx Markdown**, a live-preview Markdown editor for VS Code and VS Code based editors (Cursor, Windsurf, Insiders, VSCodium). Extension id: `weilanx.weilanx-markdown`. Follow the steps in order and report the result.

## 1. Pick the editor CLI

```bash
command -v code code-insiders cursor windsurf codium
```

If `code` is missing on macOS, use the CLI inside the app bundle, e.g. `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`.

## 2. Install

**Option A, one command** (macOS / Linux, installs into every editor found; set `WMD_EDITOR=cursor` to limit it to one):

```bash
curl -fsSL https://raw.githubusercontent.com/Azure12355/weilanx-markdown/main/scripts/install.sh | bash
```

**Option B, step by step** (any OS):

```bash
curl -fL -o weilanx-markdown.vsix https://github.com/Azure12355/weilanx-markdown/releases/latest/download/weilanx-markdown.vsix
code --install-extension weilanx-markdown.vsix --force
```

**Option C, build from source:**

```bash
git clone https://github.com/Azure12355/weilanx-markdown.git
cd weilanx-markdown
npm install
npm run package          # produces weilanx-markdown.vsix
code --install-extension weilanx-markdown.vsix --force
```

## 3. Verify

```bash
code --list-extensions | grep -i weilanx.weilanx-markdown
```

The command must print `weilanx.weilanx-markdown`.

## 4. Optional: make it the default Markdown editor

Only do this if the user asks. Add the following to the user's `settings.json` (merge with any existing `workbench.editorAssociations`):

```json
"workbench.editorAssociations": { "*.md": "weilanxMarkdown.editor" }
```

## 5. Tell the user

- Run **Developer: Reload Window**.
- Open any `.md` file. Use the switch at the top right for Locked / Edit / Source mode, and the **Aa** button for fonts.
- Paste screenshots with ⌘V / Ctrl+V. The storage path is set by `weilanxMarkdown.image.path`.

## Uninstall

```bash
code --uninstall-extension weilanx.weilanx-markdown
```
