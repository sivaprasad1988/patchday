// Patchday 1.2 – Ein Klick auf T3Monitor: Daten lesen -> OpenProject öffnen -> automatisch eintragen.
const T3M = 't3m.hub.gingco.de', OP = 'op.hub.gingco.de';
const LS = chrome.storage.local, SS = chrome.storage.session;
const DEF_NAMES = ['Siva', 'Anu BN'];
const getCfg = async () => { const c = Object.assign({ askTime: true, map: [] }, await LS.get(['names', 'askTime', 'map'])); if (!Array.isArray(c.names) || !c.names.length) c.names = DEF_NAMES; return c; };
const run = (tabId, func, args = [], world = 'ISOLATED') =>
  chrome.scripting.executeScript({ target: { tabId }, func, args, world }).then(r => r[0] && r[0].result).catch(e => { console.warn('Patchday:', e.message); return null; });
const ask = (tabId, msg, def = '') => run(tabId, (m, d) => prompt(m, d), [msg, def]);
const say = (tabId, msg) => run(tabId, m => alert(m), [msg]);
const hostOf = u => { try { return new URL(u).host; } catch (e) { return ''; } };
const PK = id => 'p' + id;

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
  const m = cfg.map.find(x => x.uid && d.uid && String(x.uid) === d.uid)
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
  const url = op.replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\/edit$/, '') + '/edit';
  await SS.set({ [PK(tab.id)]: { data: d, cfg: { names: cfg.names, askTime: cfg.askTime }, url, ts: Date.now() } });
  chrome.tabs.update(tab.id, { url });
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

// ---------- läuft auf T3Monitor ----------
function readT3M() {
  const t = document.getElementById('tblUpdateHistory');
  if (!t) return { error: 'Update-Historie nicht gefunden.' };
  const site = ((document.querySelector('h1') || {}).innerText || '').trim();
  const rows = [...t.rows].map(r => [...r.cells].map(c => c.innerText.trim()))
    .filter(c => c.length >= 6 && /^\d{2}\.\d{2}\.\d{4}$/.test(c[0]));
  const gm = new Map();
  for (const r of rows) {
    let g = gm.get(r[0]);
    if (!g) { g = { raw: r[0], d: r[0].split('.').reverse().join('-'), items: [], seen: {} }; gm.set(r[0], g); }
    const id = r[4] + '|' + r[1] + '|' + r[3];
    if (g.seen[id]) continue;
    g.seen[id] = 1;
    g.items.push({ key: r[4], name: r[5], o: r[1], n: r[3] });
  }
  const groups = [...gm.values()].map(({ seen, ...g }) => g);
  if (!groups.length) return { error: 'Keine Einträge in der Update-Historie gefunden.' };
  const uid = new URLSearchParams(location.search).get('showUid') || '';
  return { site, uid, groups, cnt: groups.reduce((a, g) => a + g.items.length, 0),
           legacyOp: uid ? (localStorage.getItem('pd_op_' + uid) || '') : '' };
}

// ---------- läuft auf OpenProject (MAIN world, braucht ckeditorInstance) ----------
async function writeOP(data, cfg) {
  const pad = n => String(n).padStart(2, '0');
  let ed = null;
  for (let i = 0; i < 60 && !ed; i++) {               // bis 30 s auf den Editor warten
    ed = (document.querySelector('.ck-editor__editable') || {}).ckeditorInstance || null;
    if (!ed) await new Promise(r => setTimeout(r, 500));
  }
  if (!ed) { alert('Editor nicht gefunden. Bitte auf der T3Monitor-Seite erneut starten.'); return; }

  const pageKey = 'pd_site_' + location.pathname.replace(/\/edit$/, '');
  const prev = localStorage.getItem(pageKey);
  if (prev && prev !== data.site && !confirm('ACHTUNG: Diese Seite wurde bisher für ' + prev +
      ' verwendet, jetzt kommen die Daten von ' + data.site + '.\nTrotzdem fortfahren?')) return;

  const doc = new DOMParser().parseFromString('<div id="r">' + ed.getData() + '</div>', 'text/html');
  const root = doc.getElementById('r');
  const tbl = [...root.querySelectorAll('table')].find(t => /Datum/i.test((t.rows[0] || {}).textContent || '')) || root.querySelector('table');
  let tbody = tbl ? (tbl.tBodies[0] || tbl.appendChild(doc.createElement('tbody'))) : null;
  const cellTxt = r => r.cells[0] ? r.cells[0].textContent.trim() : '';
  const iso = s => {
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    return m ? m[3] + '-' + pad(m[2]) + '-' + pad(m[1]) : '';
  };
  const exRows = tbl ? [...tbl.rows] : [];

  // Abgleich: neue Daten -> neue Zeile; vorhandene Daten -> nur fehlende Updates ergänzen
  const byD = new Map();
  exRows.forEach(r => { const x = iso(cellTxt(r)); if (x) { if (!byD.has(x)) byD.set(x, []); byD.get(x).push(r); } });
  const dash = v => !v || v === '–' || v === '-';
  const rxE = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const B = '(^|[^a-z0-9_.-])', E = '($|[^a-z0-9_.-])';
  const lns = r => {
    const c = r.cells[1]; if (!c) return [];
    return c.innerHTML.replace(/<br\s*\/?>|<\/(p|li|div)>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').toLowerCase().split('\n');
  };
  const has = (ls, i) => {
    const k = new RegExp(B + rxE(String(i.key).toLowerCase()) + E);
    const v = dash(i.n) ? i.o : i.n;
    const vr = dash(v) ? null : new RegExp(B + 'v?' + rxE(String(v).toLowerCase()) + E);
    return ls.some(l => k.test(l) && (!vr || vr.test(l)));
  };
  const neu = [], add = [];
  for (const g of data.groups) {
    const rs = byD.get(g.d);
    if (!rs) { neu.push(g); continue; }
    const miss = g.items.filter(i => !has(rs.flatMap(lns), i));
    if (miss.length) add.push({ g: { ...g, items: miss }, r: rs[0] });
  }
  if (!neu.length && !add.length) { alert(data.site + ': Keine neuen Einträge, alles ist schon im Protokoll.'); return; }

  const legacy = exRows.some(r => /^\d{1,2}\.\d{1,2}\.\d{4}/.test(cellTxt(r)));
  const fmtD = d => legacy ? d.split('-').reverse().join('.') : d;

  // Uhrzeit: 09:00–12:00 / 13:00–17:00; gleicher Tag -> fortlaufend nach der letzten Website
  const W = [[540, 720], [780, 1020]];
  const toT = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const toM = t => { const a = t.split(':').map(Number); return a[0] * 60 + a[1]; };
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const fresh = () => {
    const tot = W.reduce((s, w) => s + w[1] - w[0], 0);
    let x = Math.floor(Math.random() * tot);
    for (const w of W) { const l = w[1] - w[0]; if (x < l) return w[0] + x; x -= l; }
    return W[0][0];
  };
  const rnd = d => {
    const last = localStorage.getItem('pd_t_' + d);
    if (last) {
      let m = toM(last) + ri(8, 25);
      if (m > W[0][1] && m < W[1][0]) m = W[1][0] + ri(0, 15);
      if (m <= W[1][1]) return toT(m);
    }
    return toT(fresh());
  };
  const now = new Date();
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const nowT = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const times = {};
  const od = neu.filter(g => g.d !== today).map(g => g.d);
  if (od.length) {
    let parts = [''];
    if (cfg.askTime) {
      const inp = prompt('Uhrzeit (HH:MM) für diese Daten, in dieser Reihenfolge, mit Komma getrennt:\n' + od.map(fmtD).join(', ') +
        '\n\nBeispiel: 14:30, 09:15\nNur eine Zeit = für alle Daten. Leer = automatisch 09:00-17:00 (ohne Mittagspause 12-13 Uhr, gleicher Tag: fortlaufend nach der letzten Website)', '');
      if (inp === null) return;
      parts = inp.split(',').map(x => x.trim());
      if (parts.some(x => x && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(x))) { alert('Ungültige Uhrzeit. Bitte HH:MM verwenden, z. B. 09:30.'); return; }
      if (parts.length > 1 && parts.length !== od.length) { alert('Anzahl der Zeiten (' + parts.length + ') passt nicht zur Anzahl der Daten (' + od.length + ').'); return; }
    }
    od.forEach((d, i) => { const v = parts.length === 1 ? parts[0] : parts[i]; times[d] = v ? (v.length === 4 ? '0' + v : v) : rnd(d); });
  }
  const tOf = g => g.d === today ? nowT : times[g.d];

  // Ausführung: ausgeglichen verteilen – wer im Protokoll bisher seltener eingetragen ist, kommt zuerst (Gleichstand = zufällig)
  const use = {};
  cfg.names.forEach(n => { use[n] = exRows.filter(r => r.cells[2] && r.cells[2].textContent.trim().toLowerCase() === n.toLowerCase()).length; });
  const pick = () => {
    const min = Math.min(...cfg.names.map(n => use[n]));
    const c = cfg.names.filter(n => use[n] === min);
    const n = c[Math.floor(Math.random() * c.length)];
    use[n]++;
    return n;
  };
  neu.forEach(g => { g.who = pick(); });

  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const line = i => {
    const core = i.key === 'typo3';
    if (legacy) {
      const k = core ? 'TYPO3 Core' : i.key;
      if (dash(i.o)) return k + ': neu installiert (' + i.n + ')';
      if (dash(i.n)) return k + ': entfernt (' + i.o + ')';
      return k + ': ' + i.o + ' -> ' + i.n;
    }
    return (core ? 'TYPO3' : i.name + ' (' + i.key + ')') + ' : ' + i.o + ' to ' + i.n;
  };
  const headOf = (c, o) => c && o ? 'Update TYPO3 Core & Plugins:' : (c ? 'Update TYPO3 Core:' : 'Update Plugins:');
  const head = g => legacy ? headOf(g.items.some(i => i.key === 'typo3'), g.items.some(i => i.key !== 'typo3')) : 'Update Extensions:';
  const mk = g => {
    const tr = doc.createElement('tr');
    tr.innerHTML = '<td>' + fmtD(g.d) + ' ' + tOf(g) + '</td><td><p>' + head(g) + '</p><ul>' +
      g.items.map(i => '<li>' + esc(line(i)) + '</li>').join('') + '</ul></td><td>' + esc(g.who) + '</td><td>&nbsp;</td>';
    return tr;
  };
  if (!tbody) {
    const w = doc.createElement('div');
    w.innerHTML = '<h2><strong>Übersicht aller vorgenommenen Updates/Patches</strong></h2><figure class="table"><table><thead><tr><th>Datum / Uhrzeit</th><th>Was wurde vorgenommen</th><th>Ausführung</th><th>Anmerkung</th></tr></thead><tbody></tbody></table></figure>';
    root.prepend(...w.childNodes);
    tbody = root.querySelector('tbody');
  }
  for (const g of neu) {
    const tr = mk(g);
    const before = [...tbody.rows].find(r => { const x = iso(cellTxt(r)); return x && x < g.d; });
    if (before) tbody.insertBefore(tr, before); else tbody.appendChild(tr);
  }
  for (const a of add) {
    let c = a.r.cells[1];
    if (!c) { while (a.r.cells.length < 2) a.r.appendChild(doc.createElement('td')); c = a.r.cells[1]; }
    const uls = c.querySelectorAll('ul');
    let ul = uls[uls.length - 1];
    if (!ul) { ul = doc.createElement('ul'); c.appendChild(ul); }
    for (const i of a.g.items) { const li = doc.createElement('li'); li.textContent = line(i); ul.appendChild(li); }
    const p = c.querySelector('p');
    if (p && /^Update (TYPO3 Core & Plugins|TYPO3 Core|Plugins):$/.test(p.textContent.trim())) {
      const t = p.textContent;
      p.textContent = headOf(/Core/.test(t) || a.g.items.some(i => i.key === 'typo3'), /Plugins/.test(t) || a.g.items.some(i => i.key !== 'typo3'));
    }
  }
  if (!confirm('Website: ' + data.site + '\nOpenProject: ' + location.pathname.replace(/\/edit$/, '') +
      '\n\nNeue Zeilen: ' + neu.length + '\n' + neu.map(g => fmtD(g.d) + ' ' + tOf(g) + ' – ' + g.who + ' (' + g.items.length + ' Updates)').join('\n') +
      (add.length ? '\n\nErgänzte Zeilen: ' + add.length + '\n' + add.map(a => cellTxt(a.r) + ' (+' + a.g.items.length + ' Updates)').join('\n') : '') +
      '\n\nSpeichern?')) return;
  ed.setData(root.innerHTML);
  localStorage.setItem(pageKey, data.site);
  for (const g of neu) { const k = 'pd_t_' + g.d, o = localStorage.getItem(k), t = tOf(g); if (!o || toM(t) > toM(o)) localStorage.setItem(k, t); }
  const lim = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  Object.keys(localStorage).filter(k => k.startsWith('pd_t_') && k.slice(5) < lim).forEach(k => localStorage.removeItem(k));
  const b = [...document.querySelectorAll('button,input[type=submit]')].find(x => /^\s*(Save|Speichern)\s*$/.test(x.innerText || x.value));
  if (b) b.click(); else alert('Inhalt eingefügt, bitte selbst speichern.');
}
