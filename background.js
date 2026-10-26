// Patchday 1.4 – Ein Klick auf T3Monitor: Daten lesen -> OpenProject öffnen -> automatisch eintragen.
importScripts('shared.js'); // T3M, OP, getCfg, uidOf, opEditUrl, readT3M, writeOP
const LS = chrome.storage.local, SS = chrome.storage.session;
const run = (tabId, func, args = [], world = 'ISOLATED') =>
  chrome.scripting.executeScript({ target: { tabId }, func, args, world }).then(r => r[0] && r[0].result).catch(e => { console.warn('Patchday:', e.message); return null; });
const ask = (tabId, msg, def = '') => run(tabId, (m, d) => prompt(m, d), [msg, def]);
const say = (tabId, msg) => run(tabId, m => alert(m), [msg]);
const hostOf = u => { try { return new URL(u).host; } catch (e) { return ''; } };
const PK = id => 'p' + id;

// Rechtsklick auf das Symbol -> "Alle ausführen" (Fortschrittsseite steuert den Lauf)
chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.create({ id: 'all', title: 'Alle ausführen', contexts: ['action'] }));
chrome.contextMenus.onClicked.addListener(i => { if (i.menuItemId === 'all') chrome.tabs.create({ url: 'batch.html' }); });

chrome.action.onClicked.addListener(async (tab) => {
  const host = hostOf(tab.url);
  if (host === OP) { // Fallback: manueller Klick auf OpenProject, falls Auto-Start nicht lief
    const p = (await SS.get(PK(tab.id)))[PK(tab.id)];
    if (!p) return say(tab.id, 'Bitte auf der T3Monitor-Seite der Website starten.');
    await SS.remove(PK(tab.id));
    return run(tab.id, writeOP, [p.data, p.cfg], 'MAIN');
  }
  if (host !== T3M) { // z. B. chrome://-Seiten: dort darf nichts eingeblendet werden
    if (/^https?:/.test(tab.url || '')) say(tab.id, 'Nur auf T3Monitor oder OpenProject verwenden.');
    return;
  }

  const d = await run(tab.id, readT3M);
  if (!d || d.error) return say(tab.id, (d && d.error) || 'Fehler beim Lesen.');
  const cfg = await getCfg();
  const m = cfg.map.find(x => d.uid && uidOf(x) === d.uid)
         || cfg.map.find(x => x.site && x.site.trim().toLowerCase() === d.site.toLowerCase());
  let op = m && m.op;
  if (!op) {
    op = await ask(tab.id, 'Website: ' + d.site + '\n' + d.cnt + ' Einträge an ' + d.groups.length +
      ' Tagen.\n\nKeine Zuordnung in den Einstellungen. OpenProject-Link (Patchday Protokoll):', d.legacyOp || '');
    if (!op || !op.trim()) return;
    op = op.trim();
    cfg.map.push({ site: d.site, uid: d.uid, op });
    await LS.set({ map: cfg.map });
  }
  // Wer führt aus? Eingabe = diese Person(en); leer = Namen aus den Einstellungen (ausgeglichen verteilt)
  const who = await ask(tab.id, 'Ausführung: Wer führt aus?\nMehrere Namen mit Komma trennen.\nLeer lassen = aus Einstellungen: ' + cfg.names.join(', '), '');
  if (who === null) return; // Abbrechen
  const names = who.split(',').map(x => x.trim()).filter(Boolean);
  if (names.length) cfg.names = names;
  const url = opEditUrl(op);
  // OpenProject in neuem Tab direkt neben T3Monitor öffnen; Daten vor dem Laden ablegen, damit der Auto-Start sie sicher findet
  const nt = (await chrome.tabs.create({ url: 'about:blank', windowId: tab.windowId, index: tab.index + 1, openerTabId: tab.id, active: true })).id;
  await SS.set({ [PK(nt)]: { data: d, cfg: { names: cfg.names, askTime: cfg.askTime }, url, ts: Date.now() } });
  chrome.tabs.update(nt, { url });
});

// Sobald die OpenProject-Bearbeitungsseite geladen ist: automatisch eintragen (genau einmal).
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || hostOf(tab.url) !== OP) return;
  const p = (await SS.get(PK(tabId)))[PK(tabId)];
  if (!p) return;
  if (Date.now() - p.ts > 600000) return SS.remove(PK(tabId));        // älter als 10 Min. -> verwerfen
  if (tab.url.split(/[?#]/)[0].replace(/\/+$/, '') !== p.url) return;  // z. B. Login-Seite -> warten
  await SS.remove(PK(tabId));                                          // vor dem Start entfernen = kein Doppel-Eintrag
  run(tabId, writeOP, [p.data, p.cfg], 'MAIN');
});
chrome.tabs.onRemoved.addListener(id => SS.remove(PK(id)));

