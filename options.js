const $ = id => document.getElementById(id);
const row = (m = {}) => {
  const tr = document.createElement('tr');
  tr.innerHTML = '<td><input class="site"></td><td><input class="uid"></td><td><input class="op" type="url"></td><td><button class="del" title="Entfernen">✕</button></td>';
  tr.querySelector('.site').value = m.site || ''; tr.querySelector('.uid').value = m.uid || ''; tr.querySelector('.op').value = m.op || '';
  tr.querySelector('.del').onclick = () => tr.remove();
  $('map').appendChild(tr);
};
chrome.storage.local.get(['names', 'askTime', 'map'], c => {
  $('names').value = ((c.names && c.names.length) ? c.names : ['Siva', 'Anu BN']).join(', ');
  $('askTime').checked = c.askTime !== false;
  (c.map || []).forEach(row);
  if (!(c.map || []).length) row();
});
$('addRow').onclick = () => row();
$('save').onclick = () => {
  const map = [...$('map').rows].map(r => ({
    site: r.querySelector('.site').value.trim(), uid: r.querySelector('.uid').value.trim(), op: r.querySelector('.op').value.trim()
  })).filter(m => m.op && (m.site || m.uid));
  const names = $('names').value.split(',').map(x => x.trim()).filter(Boolean);
  chrome.storage.local.set({ names, askTime: $('askTime').checked, map }, () => {
    $('msg').textContent = 'Gespeichert.'; setTimeout(() => $('msg').textContent = '', 2000);
  });
};

// ---------- CSV Export / Import (Spalten: Typ;Website/Wert;UID;OpenProject-Link) ----------
const CSV_HEAD = ['Typ', 'Website/Wert', 'UID', 'OpenProject-Link'];
const csvCell = v => /[";\r\n]/.test(v = String(v ?? '')) ? '"' + v.replace(/"/g, '""') + '"' : v;
const csvParse = (txt, sep) => { // RFC 4180, Anführungszeichen und Zeilenumbrüche in Feldern erlaubt
  const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out.filter(r => r.some(c => c.trim()));
};
const flash = t => { $('msg').textContent = t; setTimeout(() => $('msg').textContent = '', 4000); };
$('exportCsv').onclick = () => {
  const rows = [CSV_HEAD, ['Ausführung', $('names').value.trim(), '', ''], ['Uhrzeit abfragen', $('askTime').checked ? 'ja' : 'nein', '', '']];
  for (const r of $('map').rows) rows.push(['Zuordnung', ...['.site', '.uid', '.op'].map(c => r.querySelector(c).value.trim())]);
  const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'patchday-einstellungen-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('importCsv').onclick = () => $('csvFile').click();
$('csvFile').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const txt = (await file.text()).replace(/^﻿/, '');
  const first = txt.split(/\r?\n/, 1)[0];
  const rows = csvParse(txt, (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',');
  if (!rows.length || rows[0][0].trim() !== CSV_HEAD[0]) return flash('Ungültige CSV: Kopfzeile „' + CSV_HEAD.join(';') + '“ erwartet.');
  const map = [];
  for (const [typ = '', v = '', uid = '', op = ''] of rows.slice(1)) {
    const t = typ.trim().toLowerCase();
    if (t === 'ausführung') $('names').value = v.trim();
    else if (t === 'uhrzeit abfragen') $('askTime').checked = /^(ja|true|1|x)$/i.test(v.trim());
    else if (t === 'zuordnung') map.push({ site: v.trim(), uid: uid.trim(), op: op.trim() });
  }
  $('map').innerHTML = '';
  map.forEach(row); if (!map.length) row();
  flash(map.length + ' Zuordnung(en) importiert – bitte „Speichern“ klicken.');
};
