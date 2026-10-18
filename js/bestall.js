/*
 * Sidan Beställ: samlar beställningen och öppnar den som e-post i besökarens eget e-postprogram.
 * Ingenting skickas från sidan.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const TILL = 'kontakt@agrellarkitektur.se';
  const form = $('bestallning-form');
  if (!form) return;

  let sparat = null;
  try { sparat = JSON.parse(localStorage.getItem('terrang-utsnitt') || 'null'); } catch (e) { sparat = null; }
  if (sparat && sparat.text) {
    $('b-hamta').hidden = false;
    $('b-koord-hjalp').textContent = `Senaste området på kartan: ${sparat.r.xmax - sparat.r.xmin} × ${sparat.r.ymax - sparat.r.ymin} m i ${sparat.system}${sparat.kommun ? ', ' + sparat.kommun + ' kommun' : ''}.`;
  }
  $('b-hamta').addEventListener('click', () => {
    if (!sparat) return;
    $('b-koord').value = sparat.text;
    if (sparat.projekt && !$('b-projekt').value) $('b-projekt').value = sparat.projekt;
  });
  // kommer man från kartan (mobilen) fylls området i direkt
  if (/fran-kartan/.test(location.hash) && sparat && !$('b-koord').value) {
    $('b-koord').value = sparat.text;
    if (sparat.projekt && !$('b-projekt').value) $('b-projekt').value = sparat.projekt;
    setTimeout(() => { const el = document.getElementById('bestallning'); if (el) el.scrollIntoView({ block: 'start' }); }, 100);
  }
  $('b-klistra').addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { $('b-koord').value = t; return; }
    } catch (e) { /* visas nedan */ }
    $('b-koord').focus();
    $('b-koord-hjalp').textContent = 'Klistra in med Ctrl+V (Cmd+V på Mac) i rutan.';
  });

  function text() {
    const innehall = [...document.querySelectorAll('input[name=b-innehall]:checked')].map(c => '– ' + c.value);
    const rad = (etikett, v) => (v ? `${etikett}: ${v}` : '');
    return [
      'Hej,', '', 'Jag vill beställa ett underlag från höjdkurvor.se.', '',
      rad('Namn', $('b-namn').value.trim()), rad('E-post', $('b-epost').value.trim()), rad('Företag', $('b-org').value.trim()),
      rad('Projekt', $('b-projekt').value.trim()), '',
      'Område:', $('b-koord').value.trim(), '',
      'Innehåll:', ...(innehall.length ? innehall : ['– (inget valt)']), '',
      ...($('b-medd').value.trim() ? ['Meddelande:', $('b-medd').value.trim(), ''] : []),
      'Jag vill ha ett pris innan arbetet börjar.',
    ].filter((r, i, a) => !(r === '' && a[i - 1] === '')).join('\n');
  }
  function amne() {
    const p = $('b-projekt').value.trim();
    return 'Beställning av underlag' + (p ? ' – ' + p : '');
  }
  function kontrollera() {
    const fel = [];
    if (!$('b-namn').value.trim()) fel.push('namn');
    if (!/^\S+@\S+\.\S+$/.test($('b-epost').value.trim())) fel.push('e-postadress');
    if (!$('b-koord').value.trim()) fel.push('område');
    const p = $('b-fel');
    p.hidden = !fel.length;
    p.textContent = fel.length ? `Fyll i ${fel.join(', ').replace(/, ([^,]*)$/, ' och $1')}.` : '';
    return !fel.length;
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!kontrollera()) return;
    location.href = `mailto:${TILL}?subject=${encodeURIComponent(amne())}&body=${encodeURIComponent(text())}`;
    $('b-status').textContent = 'E-postprogrammet borde nu öppnas med beställningen. Gör det inte det, välj Kopiera beställningen och skicka den till ' + TILL + '.';
  });
  $('b-kopiera').addEventListener('click', async () => {
    if (!kontrollera()) return;
    const t = `Till: ${TILL}\nÄmne: ${amne()}\n\n${text()}`;
    let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
    }
    $('b-status').textContent = ok ? `Beställningen är kopierad. Klistra in den i ett mejl till ${TILL}.` : 'Kunde inte kopiera. Markera texten i fälten och kopiera för hand.';
  });
}());
