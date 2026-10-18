"""
Test av mobilflödet (390 × 844, pekskärm) mot testservern.

    python3 test/mobil_test.py <utkatalog>

Markera med ramen, läs resultatbladet, kopiera, byt till hela verktyget och tillbaka,
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
        pg.tap('#mobil-markera-knapp'); pg.wait_for_timeout(600)
        print('  ', pg.locator('#mobil-storlek').inner_text(), '|', pg.locator('#mobil-kommun').inner_text(), '|', pg.locator('#mobil-system').inner_text())
        pg.screenshot(path=f'{UT}/m2_resultat_{tema}.png')
        pg.tap('#mobil-kopiera'); pg.wait_for_timeout(200)
        print('   kopierat:', pg.evaluate('navigator.clipboard.readText()').replace('\n', ' / ')[:160])
        print('   beställ:', pg.get_attribute('#mobil-bestall', 'href'))
        pg.tap('#mobil-hela-2'); pg.wait_for_timeout(600)
        print('   hela verktyget:', not pg.evaluate("document.body.classList.contains('mobilflode')"), '| utsnitt kvar:', pg.input_value('#xmin'))
        pg.screenshot(path=f'{UT}/m3_hela_{tema}.png')
        pg.locator('#till-mobilvy').scroll_into_view_if_needed(); pg.tap('#till-mobilvy'); pg.wait_for_timeout(400)
        print('   tillbaka:', pg.evaluate("document.body.classList.contains('mobilflode')"), '| fel:', fel or 'inga')
        ctx.close()
    b.close()
