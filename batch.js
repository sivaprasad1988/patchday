// "Alle ausführen": alle Zuordnungen nacheinander – T3Monitor lesen, OpenProject öffnen, writeOP mit Bestätigung je Schritt.
const $ = id => document.getElementById(id);
const exec = (tabId, func, args = [], world = 'ISOLATED') =>
  chrome.scripting.executeScript({ target: { tabId }, func, args, world }).then(r => r[0] && r[0].result).catch(e => ({ error: e.message }));
const base = u => (u || '').split(/[?#]/)[0].replace(/\/+$/, '');
const hostOf = u => { try { return new URL(u).host; } catch (e) { return ''; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let stop = false;
$('stop').onclick = () => { stop = true; $('stop').disabled = true; $('stop').textContent = 'Stoppt nach aktueller Website…'; };

// Tab auf URL setzen und warten, bis die Seite geladen ist (max. 60 s); Ergebnis = tatsächliche URL (Login-Umleitung erkennbar)
const open = (tabId, url) => new Promise(res => {
  const l = (id, info, tab) => { if (id === tabId && info.status === 'complete') done(tab.url); };
  const done = u => { clearTimeout(to); chrome.tabs.onUpdated.removeListener(l); res(u || ''); };
  const to = setTimeout(() => done(''), 60000);
  chrome.tabs.onUpdated.addListener(l);
  chrome.tabs.update(tabId, { url }).catch(() => done(''));
});
// Nach Klick auf "Speichern": warten, bis die Bearbeitungsseite verlassen wurde (max. 30 s)
const saved = async (tabId, edit) => {
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (!t) return false;
    if (t.status === 'complete' && base(t.url) !== edit) return true;
  }
  return false;
};

(async () => {
  const cfg = await getCfg();
  const map = cfg.map.filter(m => m.op);
  const n = map.length;
  if (!n) { $('txt').textContent = 'Keine Zuordnungen in den Einstellungen.'; $('stop').hidden = true; return; }
  const rows = map.map((m, i) => {
    const tr = $('list').insertRow();
    tr.insertCell().textContent = i + 1;
    tr.insertCell().textContent = m.site || uidOf(m) || m.op;
    const st = tr.insertCell(); st.textContent = 'wartet';
    return st;
  });
  const set = (i, text, cls = '') => { rows[i].textContent = text; rows[i].className = cls; };

  const who = prompt('Alle ausführen (' + n + ' Websites)\n\nAusführung: Wer führt aus?\nMehrere Namen mit Komma trennen.\nLeer lassen = aus Einstellungen: ' + cfg.names.join(', '), '');
  if (who === null) { $('txt').textContent = 'Abgebrochen.'; $('stop').hidden = true; return; }
  const names = who.split(',').map(x => x.trim()).filter(Boolean);
  const c = { names: names.length ? names : cfg.names, askTime: cfg.askTime };

  const me = await chrome.tabs.getCurrent();
  const work = await chrome.tabs.create({ url: 'about:blank', windowId: me.windowId, active: true });
  const cnt = {};
  let i = 0;
  for (; i < n && !stop; i++) {
    const m = map[i], step = '[' + (i + 1) + '/' + n + '] ';
    $('txt').textContent = step + (m.site || '');
    $('bar').max = n; $('bar').value = i;
    chrome.action.setBadgeText({ text: (i + 1) + '/' + n });
    set(i, 'läuft…', 'run');
    const res = await (async () => {
      const uid = uidOf(m);
      if (!uid) return ['Fehler: keine UID / kein T3Monitor-Link in der Zuordnung', 'err'];
      if (hostOf(await open(work.id, t3mUrl(uid))) !== T3M) return ['Fehler: T3Monitor nicht erreichbar oder nicht angemeldet', 'err'];
      const d = await exec(work.id, readT3M);
      if (!d || d.error) return ['Fehler: ' + ((d && d.error) || 'T3Monitor nicht lesbar'), 'err'];
      rows[i].previousSibling.textContent = d.site || m.site;
      const edit = opEditUrl(m.op);
      if (base(await open(work.id, edit)) !== edit) return ['Fehler: OpenProject nicht angemeldet oder Seite nicht gefunden', 'err', 1];
      await chrome.tabs.update(work.id, { active: true });
      const r = await exec(work.id, writeOP, [d, c, { step }], 'MAIN');
      if (r === 'saved') return (await saved(work.id, edit)) ? ['Gespeichert ✓', 'ok']
        : ['Speichern nicht bestätigt – bitte im Arbeits-Tab prüfen', 'err', 1];
      if (r === 'nothing') return ['Nichts Neues (heute schon eingetragen)', 'ok'];
      if (r === 'cancel') return ['Übersprungen', ''];
      if (r === 'manual') return ['Inhalt eingefügt, bitte im Arbeits-Tab selbst speichern', 'err', 1];
      return ['Fehler: ' + ((r && r.error) || 'Arbeits-Tab geschlossen oder Skriptfehler'), 'err', 1];
    })();
    set(i, res[0], res[1]);
    cnt[res[1] || 'skip'] = (cnt[res[1] || 'skip'] || 0) + 1;
    if (res[2]) { // Arbeits-Tab geschlossen oder evtl. ungespeicherter Inhalt -> Tab nicht verlassen, Lauf stoppen
      const t = await chrome.tabs.get(work.id).catch(() => null);
      if (!t || base(t.url) === opEditUrl(m.op)) { stop = true; i++; break; }
    }
  }
  rows.forEach((st, k) => { if (st.textContent === 'wartet') set(k, 'nicht ausgeführt'); });
  $('bar').value = i;
  chrome.action.setBadgeText({ text: '' });
  $('txt').textContent = (stop ? 'Gestoppt' : 'Fertig') + ': ' + (cnt.ok || 0) + ' OK, ' + (cnt.skip || 0) + ' übersprungen, ' + (cnt.err || 0) + ' Fehler.';
  $('stop').hidden = true;
  chrome.tabs.update(me.id, { active: true });
})();
