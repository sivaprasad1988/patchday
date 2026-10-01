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
