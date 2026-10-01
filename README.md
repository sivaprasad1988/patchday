**Patchday Extension – README - Gingco Communication - Version: 1.2 - 10 2026**

---

# Patchday Extension

Chrome-Extension, die die Update-Historie aus dem **T3Monitor** (`t3m.hub.gingco.de`) mit einem Klick in das **Patchday Protokoll** in **OpenProject** (`op.hub.gingco.de`) überträgt.

## Installation

1. `chrome://extensions` öffnen, oben rechts **Entwicklermodus** aktivieren.
2. **Entpackte Erweiterung laden** → diesen Ordner (`patchday-extension`) wählen.
3. Nach jeder Code-Änderung auf der Karte der Extension **Neu laden** (↻) klicken.

## Einstellungen

Rechtsklick auf das Extension-Icon → **Optionen**.

| Feld | Bedeutung |
|---|---|
| Ausführung – Name(n) | Standard-Namen, kommagetrennt (Standard: `Siva, Anu BN`). Werden verwendet, wenn beim Start kein Name eingegeben wird. |
| Uhrzeit abfragen | An: Für vergangene Daten wird nach der Uhrzeit gefragt. Aus: Uhrzeit immer automatisch. |
| Zuordnung T3Monitor → OpenProject | Pro Website: Name (Überschrift im T3Monitor), optional UID (`showUid` aus der T3Monitor-URL, hat Vorrang) und OpenProject-Link zum Patchday Protokoll. |

Fehlt eine Zuordnung, fragt die Extension beim ersten Start einmal nach dem Link und speichert ihn automatisch in den Einstellungen.

## Ablauf (ein Klick)

1. Im T3Monitor die Seite der Website öffnen (mit Update-Historie) und auf das Extension-Icon klicken.
2. **Wer führt aus?** – Name(n) eingeben oder leer lassen (= Namen aus den Einstellungen). *Abbrechen* beendet den Vorgang.
3. Die Extension öffnet automatisch das zugeordnete OpenProject-Protokoll im Bearbeitungsmodus, wartet auf den Editor und trägt die Daten ein.
4. Optional: Uhrzeit-Abfrage für vergangene Daten (siehe Einstellungen).
5. Zusammenfassung prüfen → **OK** speichert das Protokoll.

## Regeln

### Keine Duplikate, nichts übersprungen

- **Neues Datum** → neue Zeile, chronologisch einsortiert (neueste oben).
- **Datum bereits vorhanden** → nur fehlende Updates werden in der bestehenden Zeile ergänzt. Uhrzeit und Ausführung dieser Zeile bleiben unverändert.
- Ein Update gilt als vorhanden, wenn eine Zeile den Extension-Key **und** die Zielversion enthält (exakter Vergleich: `12.4.2` ≠ `12.4.21`, `news` ≠ `news_extra`, `v12.4.2` wird erkannt).
- Mehrfach gelistete Updates im T3Monitor werden nur einmal übernommen.
- Datumsformate `01.09.2026`, `1.9.2026` und `2026-09-01` werden erkannt.
- Es wird die Tabelle mit der Spalte „Datum“ verwendet. Gibt es keine, wird sie angelegt.
- Ein erneuter Lauf mit denselben Daten ändert nichts („Keine neuen Einträge“).

### Ausführung (Namen)

- Eingegebener Name → für alle neuen Zeilen dieses Laufs. Mehrere Namen → werden verteilt.
- Leer → Namen aus den Einstellungen, **ausgeglichen verteilt**: Wer im Protokoll bisher seltener eingetragen ist, kommt zuerst. Bei Gleichstand entscheidet der Zufall.

### Uhrzeit

- Heutiges Datum → aktuelle Uhrzeit.
- Vergangene Daten → manuell (`HH:MM`, eine Zeit für alle oder eine pro Datum) oder automatisch:
  - zufällig zwischen 09:00–12:00 und 13:00–17:00 (keine Mittagspause),
  - gleicher Tag bei mehreren Websites: 8–25 Minuten nach der zuletzt verwendeten Zeit (wie eine fortlaufende Patchday-Session),
  - würde es nach 17:00 gehen, wird neu zufällig gewählt.
- Verwendete Zeiten werden erst nach dem Speichern gemerkt und nach 90 Tagen gelöscht.

### Format im Protokoll

- Bestehendes Protokoll mit Datum `TT.MM.JJJJ` → klassisches Format (`Update Plugins:`, `news: 1.0 -> 2.0`, `neu installiert`, `entfernt`).
- Sonst → neues Format (`JJJJ-MM-TT`, `Update Extensions:`, `Name (key) : alt to neu`).

### Sicherheit

- Warnung, wenn ein Protokoll bisher für eine andere Website verwendet wurde.
- Vor dem Speichern immer eine Zusammenfassung mit Bestätigung.
- Übergabe-Daten verfallen nach 10 Minuten und werden genau einmal verwendet.

## Dateien

| Datei | Zweck |
|---|---|
| `manifest.json` | Konfiguration der Extension (Manifest V3, Berechtigungen) |
| `background.js` | Logik: T3Monitor lesen, OpenProject öffnen und befüllen |
| `options.html` / `options.js` | Einstellungsseite |
| `background.v1.js`, `*.bak*` | Ältere Versionen (Sicherung, werden nicht geladen) |

## Fehlerbehebung

| Meldung / Problem | Lösung |
|---|---|
| „Update-Historie nicht gefunden“ | Auf der T3Monitor-Seite der Website mit der Update-Historie starten. |
| „Editor nicht gefunden“ | OpenProject hat zu lange geladen (> 30 s). Erneut im T3Monitor starten. |
| „Bitte auf der T3Monitor-Seite starten“ | Der Ablauf beginnt immer im T3Monitor. |
| Login-Seite in OpenProject | Einloggen – die Extension trägt danach automatisch ein (innerhalb von 10 Minuten). |
| Falsches Protokoll geöffnet | In den Einstellungen die Zuordnung der Website korrigieren. |
| Klick auf `chrome://`-Seiten | Ohne Funktion (von Chrome gesperrt). |

## Versionen

| Version | Änderungen |
|---|---|
| 1.2 | Abfrage „Wer führt aus?“, ausgeglichene Namensverteilung, README |
| 1.1 | Ein-Klick-Ablauf, Einstellungsseite, Zuordnung, mehrere Namen, Fix `chrome://`-Fehler |
| 1.0.x | Duplikatschutz, Ergänzen fehlender Updates, intelligente Uhrzeit |
| 1.0 | Erste Version (zwei Klicks) |

---

Autor: S. Sisupalan · Seite 1 von 1 · Intern
