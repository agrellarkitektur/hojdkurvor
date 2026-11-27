# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Test av mobilflödet (390 × 844, pekskärm) mot testservern.

    python3 test/mobil_test.py <utkatalog>

Markera med ramen (och välj dess format, BS), läs resultatbladet, kopiera, byt till hela verktyget och tillbaka,
i alla tre teman. Kontrollerar också att sidan inte rullar i sidled.
"""
import re, sys, os, json
from pyproj import Transformer
from playwright.sync_api import sync_playwright

UT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(UT, exist_ok=True)
APP = 'http://localhost:8765/index.html'
LON, LAT = Transformer.from_crs(3006, 4326, always_xy=True).transform(539750, 6427700)
SOK = json.dumps([{'lat': str(LAT), 'lon': str(LON), 'display_name': 'Staren, Kinda kommun', 'name': 'Staren'}])

with sync_playwright() as p:
    b = p.chromium.launch()
    for tema in ('ritning', 'lugn', 'mork'):
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2,
                            permissions=['clipboard-read', 'clipboard-write'])
        ctx.add_init_script(f"try {{ localStorage.setItem('terrang-tema', '{tema}'); }} catch (e) {{}}")
        ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis).*'), lambda r: r.abort())
        ctx.route(re.compile(r'https://nominatim.*'), lambda r: r.fulfill(status=200, content_type='application/json', body=SOK))
        pg = ctx.new_page()
        fel = []
        pg.on('pageerror', lambda e: fel.append(str(e)))
        pg.goto(APP); pg.wait_for_timeout(800)
        print(tema, 'mobilflöde:', pg.evaluate("document.body.classList.contains('mobilflode')"),
              '| panel synlig:', pg.locator('.panel').is_visible(), '| sidled:', pg.evaluate('document.documentElement.scrollWidth'))
        pg.screenshot(path=f'{UT}/m1_start_{tema}.png')
        pg.fill('#mobil-sok-text', 'Staren'); pg.press('#mobil-sok-text', 'Enter'); pg.wait_for_timeout(400)
        pg.tap('#mobil-sokresultat button >> nth=0'); pg.wait_for_timeout(900)
        print('   ram:', pg.locator('#mobil-matt').inner_text(), '|', pg.locator('#mobil-markera').inner_text().replace('\n', ' / ')[:120])
        # format (BS): 2:1 ger en bred ram, att dra i ett hörn gör formatet fritt, och valet sparas
        def ram():
            return pg.evaluate("(() => { const r = document.getElementById('mobil-ram').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        r11 = ram()
        # 0.16.4 (DT): formatväljaren är ihopfälld; knappen fäller ut den
        assert pg.is_hidden('#mobil-format')
        pg.tap('#mobil-format-knapp'); pg.wait_for_timeout(100)
        pg.tap('[data-format="2:1"]'); pg.wait_for_timeout(150)
        assert pg.is_hidden('#mobil-format') and pg.inner_text('#mobil-format-namn') == '2:1'
        r21 = ram()
        print('   format 1:1', [round(v) for v in r11], '→ 2:1', [round(v) for v in r21], '|', pg.locator('#mobil-matt').inner_text())
        assert abs(r11[2] - r11[3]) < 2 and abs(r21[2] - 2 * r21[3]) < 2
        def dra(r, ddx, ddy):
            cx, cy = r[0] + r[2] / 2, r[1] + r[3] / 2
            hx, hy = r[0] + r[2], r[1] + r[3]
            pg.evaluate(f"""(() => {{ const h = document.querySelector('.mobil-ram .hörn-so'), o = {{ bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true }};
              h.dispatchEvent(new PointerEvent('pointerdown', Object.assign({{ clientX: {hx}, clientY: {hy} }}, o)));
              h.dispatchEvent(new PointerEvent('pointermove', Object.assign({{ clientX: {cx + ddx}, clientY: {cy + ddy} }}, o)));
              h.dispatchEvent(new PointerEvent('pointerup', Object.assign({{ clientX: {cx + ddx}, clientY: {cy + ddy} }}, o))); }})()""")
            pg.wait_for_timeout(150)
            return cx, cy
        # ett låst format behåller proportionerna när hörnet dras, bara storleken ändras
        cx, cy = dra(r21, 70, 20)
        rl = ram()
        print('   låst 2:1 dragen:', [round(v) for v in rl])
        assert abs(rl[2] - 2 * rl[3]) < 2 and abs(rl[2] - 140) < 2 and pg.get_attribute('[data-format="2:1"]', 'aria-checked') == 'true'
        # fritt format: bredd och höjd var för sig
        pg.tap('#mobil-format-knapp'); pg.wait_for_timeout(100); pg.tap('[data-format="fri"]'); pg.wait_for_timeout(150)
        cx, cy = dra(ram(), 70, 90)
        rf = ram()
        print('   fritt dragen:', [round(v) for v in rf], '| sparat:', pg.evaluate("localStorage.getItem('terrang-mobil-format')"))
        assert abs(rf[2] - 140) < 2 and abs(rf[3] - 180) < 2 and pg.get_attribute('[data-format="fri"]', 'aria-checked') == 'true'
        assert abs(rf[0] + rf[2] / 2 - cx) < 2 and abs(rf[1] + rf[3] / 2 - cy) < 2
        # hamburgaren (0.16.4, DT)
        assert pg.is_hidden('#huvudmeny')
        pg.tap('.meny-knapp'); pg.wait_for_timeout(150)
        assert pg.is_visible('#huvudmeny') and pg.is_visible('#huvudmeny a[href="om.html"]')
        pg.screenshot(path=f'{UT}/m1c_meny_{tema}.png')
        pg.tap('.meny-knapp'); pg.wait_for_timeout(150)
        assert pg.is_hidden('#huvudmeny')
        pg.screenshot(path=f'{UT}/m1b_format_{tema}.png')
        pg.tap('#mobil-markera-knapp'); pg.wait_for_timeout(600)
        print('   utsnittets sidor:', pg.evaluate("(() => { const x = +document.getElementById('xmax').value - +document.getElementById('xmin').value, y = +document.getElementById('ymax').value - +document.getElementById('ymin').value; return [x, y]; })()"))
        print('  ', pg.locator('#mobil-storlek').inner_text(), '|', pg.locator('#mobil-kommun').inner_text(), '|', pg.locator('#mobil-system').inner_text())
        pg.screenshot(path=f'{UT}/m2_resultat_{tema}.png')
        pg.tap('#mobil-kopiera'); pg.wait_for_timeout(200)
        print('   kopierat:', pg.evaluate('navigator.clipboard.readText()').replace('\n', ' / ')[:160])
        print('   beställ:', pg.get_attribute('#mobil-bestall', 'href'))
        pg.tap('#mobil-hela-2'); pg.wait_for_timeout(600)
        print('   hela verktyget:', not pg.evaluate("document.body.classList.contains('mobilflode')"), '| utsnitt kvar:', pg.input_value('#xmin'))
        pg.screenshot(path=f'{UT}/m3_hela_{tema}.png')
        # tillbaka med knappen på kartan (0.16.4, DT)
        assert pg.is_visible('#mobilvy-flyt')
        pg.tap('#mobilvy-flyt'); pg.wait_for_timeout(400)
        print('   tillbaka:', pg.evaluate("document.body.classList.contains('mobilflode')"), '| fel:', fel or 'inga')
        assert pg.evaluate("document.body.classList.contains('mobilflode')") and not fel
        # platsen kvar efter omladdning (0.16.4, DT): utan område står kartan där den var
        pg.tap('#mobil-om'); pg.wait_for_timeout(300)
        c0 = pg.evaluate("localStorage.getItem('terrang-mobil-vy')")
        pg.reload(); pg.wait_for_timeout(1200)
        print('   efter omladdning:', c0, pg.evaluate("localStorage.getItem('terrang-mobil-vy')"))
        ctx.close()
    b.close()
