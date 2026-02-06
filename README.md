# Local Player (offline)

A front-end-only local music player that works fully offline and loads your tracks from the `/library/` folder (recommended) or via folder import.

## Run

### Recommended (best experience)

1. Put your paired files in `library/`:
   - `1.mp3` + `1.txt`
   - `2.mp3` + `2.txt`
   - …

2. Start a local server in the project folder:

```bash
python -m http.server
```

3. Open:

- `http://localhost:8000/`

The app will scan `http://localhost:8000/library/` using the server’s directory listing.

### Double-click mode (file://)

You *can* open `index.html` by double-clicking, but browsers won’t allow scanning `/library/` in file mode.

Use **Import folder…** in the sidebar to load your music.

Optional: in **Help → Storage**, enable **Remember imported files (IndexedDB)** so your imported library stays after refresh.

## Folder + pairing rule (mandatory)

Tracks are paired by base filename:

- `N.mp3` pairs with `N.txt` (same base name)

## TXT format (must match)

```
<Title>

Description:
<description lines...>

Perfect for: <tag1> • <tag2> • <tag3> ...
```

Parsing rules:
- Title = first non-empty line
- Find a line that is exactly `Description:` (case sensitive)
- Capture description lines until a blank line followed by a line starting with `Perfect for:`
- Tags: split on `•` and trim

Fallback:
- Missing description → “No description yet.”
- Missing `Perfect for:` → tags section hidden

## Keyboard shortcuts

- Space / K: Play/Pause
- J / L: -10s / +10s
- Ctrl/Cmd + K: Focus search
- Esc: Close menus/panels

## What’s saved locally

- Favorites
- Recently played
- Playlists
- Theme + UI state
- (Optional) imported music (IndexedDB)

## Known limitations

- `/library/` scanning relies on a server directory listing (works with `python -m http.server`).
- Sorting by duration may take a moment because durations are loaded from audio metadata.



## GitHub Pages note
GitHub Pages does not support directory listing, so the app loads `library/manifest.json`.
Run `python tools/build_manifest.py` after adding/removing songs, then commit the updated manifest.
