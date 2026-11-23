# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för planvyns verktyg och situationsplanens tillägg (0.16.1).

    python3 test/server.py test/data . &
    python3 test/planverktyg_test.py <utkatalog> [tema]

Skapar underlaget med byggnader, fastighetsgränser, ortofoto och träd och prövar i Rita i plan: underlaget
(ortofoto, höjdkurvor, träd) under ritningen, knappen Mått, markeringen i plan (kryss med indrag, nock,
skärmtak), numrerade hörn med koordinatlista, en ledare med fritext (sparas i projektet), Vrid mot linje,
egna träd, fastigheten ur kartan, takanslutningen och situationsplanen som PDF med underlaget.
"""
import sys, re, os, math, subprocess
UT = sys.argv[1] if len(sys.argv) > 1 else 'test/ut'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
os.makedirs(UT, exist_ok=True)
from playwright.sync_api import sync_playwright
ROT = 'http://127.0.0.1:8765'
INIT = f"""window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}'; window.TERRANG_TEST={{}};
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}
delete window.showSaveFilePicker;"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1500, 'height': 950}, accept_downloads=True)
    pg = ctx.new_page()
    fel = []
    pg.on('pageerror', lambda e: fel.append(str(e)))
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim|kumi).*'), lambda r: r.abort())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(800)
    pg.click('#rita'); box = pg.locator('#karta').bounding_box()
    cx, cy = box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.6
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 40, cy + 30, steps=5); pg.mouse.up()
    pg.select_option('#zon', '3006')
    for k, v in dict(xmin=539740, xmax=539940, ymin=6427640, ymax=6427760).items():
        pg.fill('#' + k, str(v)); pg.dispatch_event('#' + k, 'change')
    pg.wait_for_timeout(500)
    pg.fill('#projekt', 'Staren 1:2'); pg.dispatch_event('#projekt', 'input')
    for flik in ('underlag', 'analys'):
        pg.click('#flik-' + flik)
        pg.evaluate("document.querySelectorAll('.steg-panel details').forEach(d => d.open = true)")
        for r in pg.locator(f'#steg-{flik} input[name=tillval]:checked, #steg-{flik} input[name=val]:checked').all():
            if r.is_visible() and r.is_enabled(): r.uncheck()
    pg.click('#flik-underlag')
    for v in ('byggnader', 'fastigheter', 'ortofoto', 'laser', 'trad'):
        loc = pg.locator(f'input[name=tillval][value={v}]')
        if loc.is_enabled(): loc.check()
    pg.click('#flik-plats')
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    pg.on('dialog', lambda d: d.accept())
    pg.click('#skapa')
    pg.wait_for_function("!document.getElementById('skapa').disabled && !document.getElementById('resultat').hidden", timeout=240000)

    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(600)
    assert pg.is_visible('#planvy')
    kroppar = lambda: pg.evaluate("TERRANG_TEST.planvy.volymer()")
    def skarm(x, y):
        return pg.evaluate(f"""(() => {{ const t = TERRANG_TEST.planvy._test, s = t.w2s([{x}, {y}]), r = document.querySelector('.planvy-svg').getBoundingClientRect(); return [r.x + s[0], r.y + s[1]]; }})()""")
    def klick(x, y):
        sx, sy = skarm(x, y); pg.mouse.move(sx, sy); pg.wait_for_timeout(40); pg.mouse.click(sx, sy); pg.wait_for_timeout(150)
    def rekt(e, n, b_, d):
        pg.click('[data-verktyg=rekt]')
        pg.fill('.planvy-kommando', f'{e};{n}'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(80)
        sx, sy = skarm(e + b_, n + d); pg.mouse.move(sx, sy); pg.wait_for_timeout(80)
        pg.fill('.planvy-kommando', f'{b_}x{d}'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(150)
    pg.evaluate("TERRANG_TEST.planvy._test.S.riktning = 0")

    # 1. underlaget under ritningen
    u = pg.evaluate("({ orto: document.querySelectorAll('.pv-under image').length, kurvor: document.querySelectorAll('.pv-under .pv-u-kurva').length, trad: document.querySelectorAll('.pv-under .pv-u-trad').length })")
    print('1) underlag:', u)
    assert u['orto'] == 1 and u['kurvor'] > 0, 'ortofoto och höjdkurvor i planvyn'

    # 2. huvudbyggnad och flygel, markering i plan
    rekt(539790, 6427700, 12, 8)
    pg.select_option('#planvy [data-f=slag]', 'huvud'); pg.wait_for_timeout(100)
    pg.select_option('#planvy [data-f=takform]', 'sadel'); pg.wait_for_timeout(100)
    rekt(539802, 6427702, 6, 4)
    pg.select_option('#planvy [data-f=slag]', 'komplement'); pg.wait_for_timeout(100)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    pg.click('[data-pv=passa]'); pg.wait_for_timeout(200)
    k = kroppar()
    print('2) slag:', [(v.get('slag'), v.get('huvudbyggnad')) for v in k], 'linjer', pg.locator('.pv-huvudkryss').count())
    assert [v.get('slag') for v in k] == ['huvud', 'komplement'] and k[0]['huvudbyggnad'] and not k[1]['huvudbyggnad']
    assert pg.locator('.pv-huvudkryss').count() == 3, 'kryss (två linjer) och nock (en)'

    # 3. Mått av och på
    n0 = pg.locator('.pv-mattext').count()
    pg.click('[data-pv=matt]'); pg.wait_for_timeout(150)
    n1 = pg.locator('.pv-mattext').count() + pg.locator('.pv-gmattext').count()
    pg.click('[data-pv=matt]'); pg.wait_for_timeout(150)
    print('3) mått:', n0, '→', n1, '→', pg.locator('.pv-mattext').count())
    assert n0 > 0 and n1 == 0 and pg.locator('.pv-mattext').count() == n0

    # 4. numrerade hörn och koordinatlista
    pg.check('[data-visa=koordlista]'); pg.wait_for_timeout(200)
    nr = pg.locator('.pv-koordnr').all_text_contents()
    print('4) hörnnummer:', nr)
    assert len(nr) >= 6 and nr[0] == '1'
    assert pg.locator('.planvy-panel h3', has_text='Koordinatlista').count() == 1

    # 5. ledare
    pg.click('[data-verktyg=ledare]'); pg.wait_for_timeout(100)
    klick(539796, 6427704); klick(539780, 6427720)
    assert pg.is_visible('.planvy-textin')
    pg.fill('.planvy-textin', 'Plank 1,8 m'); pg.press('.planvy-textin', 'Enter'); pg.wait_for_timeout(200)
    print('5) ledare:', pg.locator('.pv-ledartext').all_text_contents())
    assert pg.locator('.pv-ledartext').all_text_contents() == ['Plank 1,8 m']
    pg.click('[data-verktyg=valj]')

    # 6. vrid mot linje: en kopia av flygeln vriden 30°, och sedan mot huset
    rekt(539780, 6427680, 5, 3)
    pg.click('[data-a=vrid]'); pg.fill('.pv-vridin', '30'); pg.press('.pv-vridin', 'Enter'); pg.wait_for_timeout(150)
    v3 = kroppar()[-1]; f = v3['fotavtryck']
    m = [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2]
    pg.click('[data-a=vridmot]'); pg.wait_for_timeout(100)
    klick(*m); klick(539796, 6427700)   # husets södra sida
    f = kroppar()[-1]['fotavtryck']
    vinklar = [math.degrees(math.atan2(f[(i + 1) % 4][1] - f[i][1], f[(i + 1) % 4][0] - f[i][0])) % 90 for i in range(4)]
    print('6) vinklar efter Vrid mot linje:', [round(a, 3) for a in vinklar])
    assert all(min(a, 90 - a) < 0.01 for a in vinklar), 'sidorna följer husets'
    pg.keyboard.press('Delete'); pg.wait_for_timeout(150)

    # 7. eget träd: lägg till och ta bort
    t0 = pg.evaluate("TERRANG_TEST.planvy._test.S.trad.length")
    pg.click('[data-verktyg=trad]'); pg.wait_for_timeout(100)
    klick(539813, 6427713)
    t1 = pg.evaluate("TERRANG_TEST.planvy._test.S.trad.filter(t => t.ny).length")
    klick(539813, 6427713)
    t2 = pg.evaluate("TERRANG_TEST.planvy._test.S.trad.filter(t => t.ny).length")
    print('7) träd:', t0, 'egna', t1, '→', t2)
    assert t1 == 1 and t2 == 0

    # 8. fastigheten ur kartan
    pg.fill('[data-u=fastighet]', ''); pg.dispatch_event('[data-u=fastighet]', 'change')
    pg.click('[data-verktyg=fast]'); pg.wait_for_timeout(100)
    klick(539796, 6427712); pg.wait_for_timeout(500)
    fast = pg.input_value('[data-u=fastighet]')
    print('8) fastighet:', fast)
    assert fast, 'beteckningen hämtad'

    # 9. takanslutning: flygeln mot huset
    pg.click('[data-verktyg=valj]'); klick(539805, 6427704)
    pg.select_option('#planvy [data-f=takform]', 'sadel'); pg.wait_for_timeout(100)
    pg.click('[data-a=anslut]'); pg.wait_for_timeout(200)
    ut = [v.get('takutdrag') for v in kroppar()]
    print('9) takutdrag:', ut)
    assert ut[1] and ut[1][0] > 0
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    pg.check('[data-visa=trad]') if not pg.is_checked('[data-visa=trad]') else None
    pg.wait_for_timeout(200)
    pg.screenshot(path=f'{UT}/planverktyg_1_{TEMA}.png')

    # 10. situationsplanen som PDF med underlaget, ledaren och koordinatlistan
    with ctx.expect_page(timeout=120000) as ny:
        pg.click('[data-a=sp-pdf]')
    flik = ny.value
    flik.wait_for_selector('a[download]', timeout=120000)
    with flik.expect_download() as dl:
        flik.click('a[download]')
    pdf = open(dl.value.path(), 'rb').read()
    open(f'{UT}/planverktyg.pdf', 'wb').write(pdf)
    flik.close()
    txt = subprocess.run(['pdftotext', f'{UT}/planverktyg.pdf', '-'], capture_output=True, text=True).stdout
    print('10) PDF:', len(pdf), 'KOORDINATER' in txt, 'Plank' in txt, 'Höjdkurva' in txt)
    assert 'KOORDINATER' in txt and 'Plank 1,8 m' in txt and 'Höjdkurva' in txt and 'Komplementbyggnad' in txt

    # 11. omladdning: ledaren och valen ligger kvar
    pg.click('[data-pv=stang]'); pg.wait_for_timeout(1500)
    pg.reload(); pg.wait_for_timeout(2500)
    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(600)
    print('11) efter omladdning:', pg.locator('.pv-ledartext').all_text_contents(), pg.is_checked('[data-visa=koordlista]'), [v.get('slag') for v in kroppar()])
    assert pg.locator('.pv-ledartext').all_text_contents() == ['Plank 1,8 m'] and pg.is_checked('[data-visa=koordlista]')
    print('fel:', fel)
    assert not fel, fel
    print('planverktyg_test: godkänt')
    b.close()
