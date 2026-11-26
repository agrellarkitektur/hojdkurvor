# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för rättelserna i 0.16.3 (granskningen 26 november) mot testservern
(test/server.py) med Playwright och Chromium.

    python3 test/rattelser_test.py <utkatalog> [tema]

Prövar:
- C1/C2: under Skapa är panelen inert, ett ändrat hörn låser inte upp Skapa och ramen har inga handtag.
- D6: med planvyn öppen når Tab aldrig sidan bakom, och sidhuvudet och .layout är inert.
- C17: två klick på Visa i 3D ger en vy.
- C7: en skiss från cad-apa stänger planvyn.
- C8: efter omladdning och ett Skapa med fel lösenord finns det förra underlaget kvar.
"""
import re, sys, os
from playwright.sync_api import sync_playwright

UT = sys.argv[1] if len(sys.argv) > 1 else '.'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
ROT = 'http://127.0.0.1:8765'
os.makedirs(UT, exist_ok=True)
INIT = f"""
window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}';
window.TERRANG_TEST = {{}}; window.TERRANG_CADAPA = 'http://localhost:8765/';
delete window.showSaveFilePicker;
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}
"""


def klart(pg):
    pg.wait_for_function("!document.getElementById('skapa').disabled && !document.getElementById('resultat').hidden", timeout=180000)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1500, 'height': 950})
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim).*'), lambda r: r.abort())
    pg = ctx.new_page()
    fel = []
    pg.on('pageerror', lambda e: fel.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(800)
    pg.click('#rita'); box = pg.locator('#karta').bounding_box()
    cx, cy = box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.6
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 40, cy + 30, steps=5); pg.mouse.up()
    pg.select_option('#zon', '3006')
    for k, v in dict(xmin=539740, xmax=539940, ymin=6427640, ymax=6427760).items():
        pg.fill('#' + k, str(v)); pg.dispatch_event('#' + k, 'change')
    pg.wait_for_timeout(500)
    for flik in ('underlag', 'analys'):
        pg.click('#flik-' + flik)
        pg.evaluate("document.querySelectorAll('.steg-panel details').forEach(d => d.open = true)")
        for r in pg.locator(f'#steg-{flik} input[name=tillval]:checked, #steg-{flik} input[name=val]:checked').all():
            if r.is_visible() and r.is_enabled(): r.uncheck()
    pg.click('#flik-underlag')
    pg.check('input[name=tillval][value=byggnader]')
    pg.click('#flik-plats')
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')

    # --- C1/C2: Skapa med höjddatan fördröjd
    langsam = lambda r: (pg.wait_for_timeout(1500), r.continue_())
    ctx.route(re.compile(r'.*\.tif.*'), langsam)
    pg.click('#skapa'); pg.wait_for_timeout(300)
    inert = pg.evaluate("document.getElementById('panel-rulla').inert")
    handtag = pg.locator('.handtag-wrap').count()
    pg.evaluate("document.getElementById('xmax').focus()")
    fokus = pg.evaluate("document.activeElement && document.activeElement.id")
    assert fokus != 'xmax', 'fältet går inte att nå under Skapa'
    # ett ändrat hörn (här från ett skript, som när ett hörn ändras på annat sätt) låser inte upp Skapa
    pg.evaluate("const e = document.getElementById('xmax'); e.value = '539960'; e.dispatchEvent(new Event('change'))")
    pg.wait_for_timeout(100)
    print('under Skapa: panelen inert', inert, '| handtag', handtag, '| Skapa låst efter ändrat hörn', pg.is_disabled('#skapa'))
    assert inert, 'panelen är inert under Skapa'
    assert handtag == 0, 'ramen har inga handtag under Skapa'
    assert pg.is_disabled('#skapa'), 'Skapa låses inte upp mitt i körningen (C1)'
    klart(pg)
    pg.evaluate("const e = document.getElementById('xmax'); e.value = '539940'; e.dispatchEvent(new Event('change'))")
    pg.click('#skapa'); klart(pg)
    ctx.unroute(re.compile(r'.*\.tif.*'), langsam)
    assert not pg.evaluate("document.getElementById('panel-rulla').inert"), 'panelen är inte inert efter Skapa'
    print('skapat:', pg.inner_text('#status-text')[:80])

    # --- D6: planvyn, och Tab stannar i den
    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(500)
    assert pg.is_visible('#planvy')
    assert pg.evaluate("document.querySelector('.toppmeny').inert && document.querySelector('.layout').inert"), 'sidan bakom är inert'
    utanfor = 0
    for _ in range(60):
        pg.keyboard.press('Tab')
        if pg.evaluate("!!document.activeElement && document.activeElement !== document.body && !document.getElementById('planvy').contains(document.activeElement)"): utanfor += 1
    print('Tab 60 gånger, fokus utanför planvyn:', utanfor)
    assert utanfor == 0, 'fokus går inte till sidan bakom planvyn (D6)'
    pg.screenshot(path=os.path.join(UT, f'rattelser_planvy_{TEMA}.png'))

    pg.click('[data-pv=stang]'); pg.wait_for_timeout(300)
    assert not pg.evaluate("document.querySelector('.toppmeny').inert || document.querySelector('.layout').inert"), 'sidan är inte inert efter planvyn'

    # --- C17: två klick på Visa i 3D
    pg.evaluate("document.getElementById('visa-3d').click(); document.getElementById('visa-3d').click()")
    pg.wait_for_timeout(4000)
    canvas = pg.locator('#vy3d-yta canvas').count()
    print('två klick på Visa i 3D: canvas', canvas, '| bakom inert', pg.evaluate("document.querySelector('.layout').inert"))
    assert canvas == 1, 'en 3D-vy (C17)'
    assert pg.evaluate("document.querySelector('.layout').inert"), 'sidan bakom 3D-vyn är inert'
    pg.click('#vy3d-stang'); pg.wait_for_timeout(300)

    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(500)
    # --- C7: en skiss från cad-apa stänger planvyn
    pg.evaluate("""window.postMessage({ typ: 'cad-apa:skiss', data: { format: 'cad-apa-skiss', version: 1, volymer: [{ id: 'c1', namn: 'Från cad-apa', golv: 120, takfot: 4, takform: 'platt', taklutning: 0,
      fotavtryck: [[539800, 6427680], [539812, 6427680], [539812, 6427690], [539800, 6427690]] }] } }, '*')""")
    pg.wait_for_timeout(600)
    print('efter skiss från cad-apa: planvyn', 'öppen' if pg.is_visible('#planvy') else 'stängd', '| volymer', pg.evaluate("TERRANG_TEST.byggProjekt ? TERRANG_TEST.byggProjekt().inmatning.volymer.map(v => v.namn) : null"))
    assert not pg.is_visible('#planvy'), 'planvyn stängs när en skiss kommer från cad-apa (C7)'
    assert not pg.evaluate("document.querySelector('.toppmeny').inert || document.querySelector('.layout').inert"), 'sidan är inte inert efter planvyn'

    # skissen från cad-apa nollställer resultatet: skapa igen inför C8
    pg.click('#flik-plats'); pg.click('#skapa'); klart(pg)

    # --- C8: omladdning, fel lösenord, det förra underlaget finns kvar
    pg.wait_for_timeout(2500)   # resultatet sparas i webbläsaren
    pg.reload(); pg.wait_for_timeout(2500)
    fore = not pg.is_hidden('#resultat')
    print('efter omladdning: underlaget inläst', fore, '|', pg.inner_text('#status-text')[:80])
    assert fore, 'det sparade underlaget läses in'
    pg.click('#flik-plats'); pg.fill('#anv', 'test'); pg.fill('#losen', 'fel'); pg.dispatch_event('#losen', 'change')
    pg.click('#skapa')
    pg.wait_for_function("!document.getElementById('skapa').disabled", timeout=60000)
    pg.wait_for_timeout(800)
    kvar = not pg.is_hidden('#resultat')
    print('efter fel lösenord: underlaget kvar', kvar, '|', pg.inner_text('#status-text')[:120])
    assert kvar, 'det förra underlaget finns kvar (C8)'
    pg.reload(); pg.wait_for_timeout(2500)
    assert not pg.is_hidden('#resultat'), 'och finns kvar efter nästa omladdning'

    print('fel på sidan:', fel)
    assert not fel, fel
    b.close()
print('rattelser_test: ok')
