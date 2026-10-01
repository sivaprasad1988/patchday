**Patchday Extension – README - Gingco Communication - Version: 1.2 - 10 2026**

---

# Patchday Extension

Chrome extension that transfers the update history from **T3Monitor** (`t3m.hub.gingco.de`) into the **Patchday protocol** in **OpenProject** (`op.hub.gingco.de`) with a single click.

## Installation

1. Open `chrome://extensions` and enable **Developer mode** (top right).
2. Click **Load unpacked** and select this folder.
3. After every code change, click **Reload** (↻) on the extension card.

## Settings

Right-click the extension icon → **Options**.

| Field | Meaning |
|---|---|
| Executor – name(s) | Default names, comma-separated (default: `Siva, Anu BN`). Used when no name is entered at start. |
| Ask for time | On: you are asked for the time of past dates. Off: time is always generated automatically. |
| Mapping T3Monitor → OpenProject | Per website: name (heading on the T3Monitor page), optional UID (`showUid` from the T3Monitor URL, takes priority) and the OpenProject link to the Patchday protocol. |

If a website has no mapping yet, the extension asks once for the link and saves it to the settings automatically.

## Workflow (one click)

1. Open the website's page in T3Monitor (with update history) and click the extension icon.
2. **Who is executing?** – enter name(s) or leave empty (= names from the settings). *Cancel* stops the run.
3. The extension opens the mapped OpenProject protocol in edit mode, waits for the editor and inserts the data.
4. Optional: time prompt for past dates (see settings).
5. Check the summary → **OK** saves the protocol.

## Rules

### No duplicates, nothing skipped

- **New date** → new row, sorted chronologically (newest on top).
- **Date already present** → only missing updates are added to the existing row. Time and executor of that row stay unchanged.
- An update counts as present if one line contains the extension key **and** the target version (exact match: `12.4.2` ≠ `12.4.21`, `news` ≠ `news_extra`, `v12.4.2` is recognised).
- Updates listed more than once in T3Monitor are added only once.
- Date formats `01.09.2026`, `1.9.2026` and `2026-09-01` are recognised.
- The table with the "Datum" column is used. If none exists, it is created.
- Running again with the same data changes nothing ("Keine neuen Einträge").

### Executor (names)

- Name entered → used for all new rows of this run. Several names → distributed across the rows.
- Empty → names from the settings, **evenly distributed**: whoever appears less often in the protocol goes first. Ties are decided randomly.

### Time

- Today's date → current time.
- Past dates → manual (`HH:MM`, one time for all or one per date) or automatic:
  - random between 09:00–12:00 and 13:00–17:00 (no lunch break),
  - same day across several websites: 8–25 minutes after the last time used (like one continuous patchday session),
  - if that would pass 17:00, a new random time is chosen.
- Times are remembered only after saving and deleted after 90 days.

### Format in the protocol

- Existing protocol with dates `DD.MM.YYYY` → classic format (`Update Plugins:`, `news: 1.0 -> 2.0`, `neu installiert`, `entfernt`).
- Otherwise → new format (`YYYY-MM-DD`, `Update Extensions:`, `Name (key) : old to new`).

### Safety

- Warning if a protocol was previously used for a different website.
- A summary with confirmation is always shown before saving.
- Hand-over data expires after 10 minutes and is used exactly once.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3, permissions) |
| `background.js` | Logic: read T3Monitor, open and fill OpenProject |
| `options.html` / `options.js` | Settings page |

## Troubleshooting

| Message / problem | Solution |
|---|---|
| "Update-Historie nicht gefunden" | Start on the website's T3Monitor page with the update history. |
| "Editor nicht gefunden" | OpenProject took too long to load (> 30 s). Start again in T3Monitor. |
| "Bitte auf der T3Monitor-Seite starten" | The workflow always starts in T3Monitor. |
| OpenProject login page | Log in – the extension then inserts automatically (within 10 minutes). |
| Wrong protocol opened | Correct the website's mapping in the settings. |
| Click on `chrome://` pages | No effect (blocked by Chrome). |

## Versions

| Version | Changes |
|---|---|
| 1.2 | "Who is executing?" prompt, even name distribution, README |
| 1.1 | One-click workflow, settings page, mapping, multiple names, fix for `chrome://` error |
| 1.0.x | Duplicate protection, adding missing updates, smart time |
| 1.0 | First version (two clicks) |

---

Author: S. Sisupalan · Page 1 of 1 · Internal
