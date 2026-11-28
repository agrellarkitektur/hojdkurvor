# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för situationsplanen (0.16.0).

    python3 test/server.py test/data . &
    python3 test/situationsplan_test.py <utkatalog> [tema]

Skapar underlaget med byggnader och fastighetsgränser för testtomten, öppnar Rita i plan och prövar:
två nya kroppar i vinkel ritas som ett yttre skal (ingen linje mellan dem, ett mått per yttersida) och
delas upp i sina kroppar först när en av dem markeras; BYA räknar överlappet en gång; ett mått döljs och
kommer tillbaka; ett yttermått dras längre ut och ligger kvar; ritningshuvudets fält sparas i projektet;
situationsplanen som PDF (i en ny flik) och DXF; kartans skisslager har en kontur för byggnaden.
"""
import sys, re, os
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
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim).*'), lambda r: r.abort())
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
    pg.check('input[name=tillval][value=byggnader]'); pg.check('input[name=tillval][value=fastigheter]')
    pg.click('#flik-plats')
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    pg.on('dialog', lambda d: d.accept())
    pg.click('#skapa')
    pg.wait_for_function("!document.getElementById('skapa').disabled && !document.getElementById('resultat').hidden", timeout=180000)

    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(500)
    assert pg.is_visible('#planvy')
    def kroppar():
        return pg.evaluate("TERRANG_TEST.planvy.volymer()")
    def skarm(x, y):
        return pg.evaluate(f"""(() => {{ const t = TERRANG_TEST.planvy._test, s = t.w2s([{x}, {y}]), r = document.querySelector('.planvy-svg').getBoundingClientRect(); return [r.x + s[0], r.y + s[1]]; }})()""")
    def rekt(e, n, b_, d):
        pg.click('[data-verktyg=rekt]')
        pg.fill('.planvy-kommando', f'{e};{n}'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(80)
        sx, sy = skarm(e + b_, n + d); pg.mouse.move(sx, sy); pg.wait_for_timeout(80)
        pg.fill('.planvy-kommando', f'{b_}x{d}'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(150)
    pg.evaluate("TERRANG_TEST.planvy._test.S.riktning = 0")

    # två nya kroppar i vinkel: huset 12 × 8 och en flygel 4 × 14 som går in i det
    rekt(539790, 6427700, 12, 8)
    rekt(539798, 6427700, 4, 14)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)   # lämna inmatningsraden, avmarkera
    pg.click('[data-pv=passa]'); pg.wait_for_timeout(200)
    k = kroppar()
    print('0) kroppar:', [(v['status'], v['fotavtryck']) for v in k])
    assert len(k) == 2 and all(v['status'] == 'ny' for v in k)
    skal = pg.locator('path.pv-kropp')
    print('1) skal:', skal.count(), pg.locator('path.pv-kropp.pv-oppen').count())
    assert skal.count() == 1, 'två kroppar i vinkel är en byggnad'
    d = skal.first.get_attribute('d')
    assert d.count('L') == 5, f'L-formen har sex hörn: {d}'
    ytter = pg.locator('.pv-mattext').all_text_contents()
    print('   yttermått:', ytter)
    assert sorted(ytter) == sorted(['12,0', '14,0', '4,0', '6,0', '8,0', '8,0']), 'ett mått per yttersida, inga inne i byggnaden'
    bya = pg.inner_text('.planvy-panel .pv-harlett')
    print('   BYA:', bya.replace('\n', ' | '))
    assert 'tillkommande 120,0' in bya, 'överlappet räknas en gång (96 + 56 − 32)'
    pg.screenshot(path=f'{UT}/situationsplan_1_skal_{TEMA}.png')

    # markera flygeln: kropparna syns var för sig
    sx, sy = skarm(539800, 6427712); pg.mouse.click(sx, sy); pg.wait_for_timeout(200)
    print('2) markerad:', pg.locator('path.pv-kropp').count(), pg.locator('path.pv-kropp.pv-oppen').count())
    assert pg.locator('path.pv-kropp.pv-oppen').count() == 2, 'kropparna i den markerade byggnaden syns var för sig'
    pg.screenshot(path=f'{UT}/situationsplan_2_markerad_{TEMA}.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)   # stänger smartmenyn (0.16.6)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    assert pg.locator('path.pv-kropp').count() == 1

    # ett yttermått i skalet som tillhör en kropp: ändra det
    m = pg.locator('.pv-mattext', has_text='14,0').first; bb = m.bounding_box()
    pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(200)
    assert pg.is_visible('.planvy-mattin') and pg.is_visible('.planvy-mattdolj')
    pg.fill('.planvy-mattin', '15'); pg.press('.planvy-mattin', 'Enter'); pg.wait_for_timeout(200)
    print('3) 14 → 15:', pg.locator('.pv-mattext').all_text_contents())
    assert '15,0' in pg.locator('.pv-mattext').all_text_contents()
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)

    # dölj måttet 12,0 och visa det igen
    m = pg.locator('.pv-mattext', has_text='12,0').first; bb = m.bounding_box()
    pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(200)
    pg.click('.planvy-mattdolj'); pg.wait_for_timeout(200)
    efter = pg.locator('.pv-mattext').all_text_contents()
    print('4) dolt:', efter, [v.get('matt') for v in kroppar()])
    assert '12,0' not in efter and any(v.get('matt') for v in kroppar())
    assert pg.locator('[data-a=visadolda]').count() == 1
    pg.click('[data-a=visadolda]'); pg.wait_for_timeout(200)
    assert '12,0' in pg.locator('.pv-mattext').all_text_contents(), 'Visa dolda mått'

    # dra måttet 8,0 (västra gaveln) längre ut
    m = pg.locator('.pv-mattext', has_text='8,0').first; bb = m.bounding_box()
    sx, sy = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    mx, my = skarm(539796, 6427707); ux, uy = sx - mx, sy - my; l = (ux * ux + uy * uy) ** 0.5; ux, uy = ux / l, uy / l   # bort från byggnaden
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + ux * 30, sy + uy * 30, steps=4); pg.mouse.move(sx + ux * 60, sy + uy * 60, steps=4); pg.mouse.up(); pg.wait_for_timeout(200)
    offs = [a.get('off') for v in kroppar() for a in (v.get('matt') or {}).values()]
    print('5) flyttat:', offs)
    assert any(o and o > 2 for o in offs), 'förskjutningen sparas i meter'
    assert not pg.is_visible('.planvy-mattin'), 'att dra öppnar inte rutan'

    # ritningshuvudet och ramen
    assert pg.locator('.pv-sitplan').count() == 1
    pg.select_option('[data-ram=format]', 'a4:0'); pg.select_option('[data-ram=skala]', '500'); pg.wait_for_timeout(200)
    assert pg.locator('.pv-ram').count() == 1, 'ramen syns när formatet ändras'
    pg.fill('[data-u=uppdrag]', 'Nybyggnad av enbostadshus'); pg.dispatch_event('[data-u=uppdrag]', 'change')
    pg.fill('[data-u=ritadAv]', 'Agrell Arkitektur'); pg.dispatch_event('[data-u=ritadAv]', 'change')
    pg.wait_for_timeout(200)
    pg.screenshot(path=f'{UT}/situationsplan_3_ram_{TEMA}.png')

    # PDF i en ny flik
    with ctx.expect_page(timeout=120000) as ny:
        pg.click('[data-a=sp-pdf]')
    flik = ny.value
    flik.wait_for_selector('a[download]', timeout=120000)
    namn = flik.get_attribute('a[download]', 'download')
    with flik.expect_download() as dl:
        flik.click('a[download]')
    pdf = open(dl.value.path(), 'rb').read()
    open(f'{UT}/situationsplan.pdf', 'wb').write(pdf)
    print('6) PDF:', namn, len(pdf))
    assert namn == 'Staren 1_2_situationsplan_1-500_A4.pdf' and pdf[:4] == b'%PDF'
    flik.close()

    # DXF
    with pg.expect_download() as dl:
        pg.click('[data-a=sp-dxf]')
    dxf = open(dl.value.path(), encoding='latin-1').read()
    open(f'{UT}/situationsplan.dxf', 'w', encoding='latin-1').write(dxf)
    lager = sorted(set(re.findall(r'\n8\r?\n(SITPLAN_[A-Z_]+)', dxf)))
    print('7) DXF:', dl.value.suggested_filename, lager)
    for l in ('SITPLAN_NY', 'SITPLAN_FASTIGHETSGRANS', 'SITPLAN_MATT', 'SITPLAN_MATTEXT', 'SITPLAN_TEXT'):
        assert l in lager, l

    # 3D-vyn: samma byggnad, konturen som en union (sedan 0.10.0)
    pg.click('[data-pv="3d"]'); pg.wait_for_function("window.TERRANG_TEST.vy3d", timeout=60000); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{UT}/situationsplan_4_3d_{TEMA}.png')
    pg.click('#vy3d-plan'); pg.wait_for_timeout(500)
    assert pg.is_visible('#planvy')

    # stäng och ladda om: fälten och måtten ligger kvar i projektet, kartan har en kontur för byggnaden
    pg.click('[data-pv=stang]'); pg.wait_for_timeout(1500)
    pg.reload(); pg.wait_for_timeout(2500)
    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(500)
    falt = {f: pg.input_value(f'[data-u={f}]') for f in ('fastighet', 'uppdrag', 'ritadAv')}
    print('9) efter omladdning:', falt, pg.input_value('[data-ram=format]'), [bool(v.get('matt')) for v in kroppar()])
    assert falt['uppdrag'] == 'Nybyggnad av enbostadshus' and falt['ritadAv'] == 'Agrell Arkitektur' and falt['fastighet'] == 'Staren 1:2'
    assert pg.input_value('[data-ram=format]') == 'a4:0' and any(v.get('matt') for v in kroppar())
    print('fel:', fel)
    assert not fel, fel
    print('situationsplan_test: godkänt')
    b.close()
