# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för planvyn (0.14.0): byggnadskroppar i plan.

    python3 test/server.py test/data . &
    python3 test/planvy_test.py <utkatalog> [tema]

Skapar underlaget med byggnader och fastighetsgränser för testtomten (Staren 1:2), öppnar
Rita i plan och prövar: ta in det befintliga huset (huvudbyggnad, kryss), rita en tillbyggnad
med klick (snäpp mot husknuten) och mått i inmatningsraden, status och FG (FG lika bef), måttet
mellan kropparna, de tre måtten till tomtgräns mot två gränser, ändra ett gränsmått så att
kroppen flyttas, ångra, en polygon ur inmatningsraden, entrépilen, status Rivs, att listan under
04 Skiss och projektet följer med, och att 3D-vyn får kropparna utom den som rivs.
"""
import sys, re, os, json
UT = sys.argv[1] if len(sys.argv) > 1 else 'test/ut'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
os.makedirs(UT, exist_ok=True)
from playwright.sync_api import sync_playwright
ROT = 'http://127.0.0.1:8765'
INIT = f"""window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}'; window.TERRANG_TEST={{}};
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1500, 'height': 950})
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
    print('skapat:', pg.inner_text('#status-text')[:90])

    # --- planvyn
    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(500)
    assert pg.is_visible('#planvy'), 'planvyn öppnas'
    def skarm(x, y):
        return pg.evaluate(f"""(() => {{ const t = TERRANG_TEST.planvy._test, s = t.w2s([{x}, {y}]), r = document.querySelector('.planvy-svg').getBoundingClientRect(); return [r.x + s[0], r.y + s[1]]; }})()""")
    def kroppar():
        return pg.evaluate("TERRANG_TEST.planvy.volymer()")
    def klick(x, y):
        sx, sy = skarm(x, y); pg.mouse.move(sx, sy); pg.wait_for_timeout(50); pg.mouse.click(sx, sy); pg.wait_for_timeout(150)
    print('riktning:', pg.evaluate("TERRANG_TEST.planvy._test.S.riktning"))

    # befintligt hus ur Lantmäteriet
    pg.keyboard.press('l'); klick(539800, 6427700)
    k = kroppar()
    print('1) befintlig:', [(v['namn'], v['status'], v['kalla'], v['huvudbyggnad'], v['golv']) for v in k])
    assert len(k) == 1 and k[0]['status'] == 'befintlig' and k[0]['kalla'].endswith('0001') and k[0]['huvudbyggnad']
    assert pg.locator('.pv-huvudkryss').count() == 2, 'kryss över huvudbyggnaden'
    bef_golv = k[0]['golv']
    pg.click('[data-pv=passa]'); pg.wait_for_timeout(200)   # närmare: kropparna med 15 m runt om

    # tillbyggnad: rektangel från husknuten, 4 × 5,6 i inmatningsraden
    pg.keyboard.press('r'); klick(539810.3, 6427694.2)   # snäpper mot hörnet
    sx, sy = skarm(539814, 6427700); pg.mouse.move(sx, sy); pg.wait_for_timeout(100)
    pg.fill('.planvy-kommando', '4x5,6'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(200)
    k = kroppar(); t = k[-1]
    xs = sorted(q[0] for q in t['fotavtryck']); ys = sorted(q[1] for q in t['fotavtryck'])
    print('2) rektangel:', xs[0], xs[-1], ys[0], ys[-1])
    assert abs(xs[0] - 539810) < 1e-3 and abs(xs[-1] - 539814) < 1e-3 and abs(ys[0] - 6427694) < 1e-3 and abs(ys[-1] - 6427699.6) < 1e-3
    pg.select_option('.planvy-panel select[data-f=status]', 'tillbyggnad'); pg.wait_for_timeout(150)
    pg.fill('.planvy-panel input[data-f=golv]', str(bef_golv).replace('.', ',')); pg.dispatch_event('.planvy-panel input[data-f=golv]', 'change'); pg.wait_for_timeout(150)
    etiketter = pg.locator('.pv-etikett').all_text_contents()
    print('   etiketter:', etiketter)
    assert 'FG lika bef' in etiketter
    rel = [x for x in pg.locator('.pv-mattext').all_text_contents()]
    print('   mått:', rel)
    assert '6,4' in rel, 'måttet mellan kropparna (6,4 m upp till husets hörn)'
    assert '20,0' in rel and '12,0' in rel, 'yttermått på det befintliga'
    gm = pg.locator('.pv-gmattext').all_text_contents()
    print('   till tomtgräns:', gm)
    assert len(gm) == 3, 'tre mått till tomtgräns'
    pg.screenshot(path=f'{UT}/planvy_1_{TEMA}.png')

    # ändra ett gränsmått: kroppen flyttas vinkelrätt mot gränsen
    fore = kroppar()[-1]['fotavtryck']
    m = pg.locator('.pv-gmattext').first; varde = m.text_content(); bb = m.bounding_box()
    pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(200)
    pg.fill('.planvy-mattin', '30'); pg.press('.planvy-mattin', 'Enter'); pg.wait_for_timeout(200)
    nya = pg.locator('.pv-gmattext').all_text_contents(); efter = kroppar()[-1]['fotavtryck']
    print('3) gränsmått', varde, '→ 30:', nya)
    assert '30,0' in nya and efter != fore
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    assert kroppar()[-1]['fotavtryck'] == fore, 'ångra'

    # dra tillbyggnaden i hörnet (inte vald, annars är hörnet ett grepp): hörnet snäpper mot husets hörn
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    sx, sy = skarm(539810.05, 6427699.55); tx, ty = skarm(539810.2, 6427705.8)
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move((sx + tx) / 2, (sy + ty) / 2, steps=4); pg.mouse.move(tx, ty, steps=4); pg.mouse.up(); pg.wait_for_timeout(200)
    ys = sorted(q[1] for q in kroppar()[-1]['fotavtryck'])
    print('3b) dragen till husets hörn:', ys[0], ys[-1], pg.locator('.pv-mattext').all_text_contents())
    assert abs(ys[-1] - 6427706) < 1e-3 and abs(ys[0] - 6427700.4) < 1e-3, 'hörnet snäppte'
    assert '6,4' in pg.locator('.pv-mattext').all_text_contents(), 'måttet mellan kropparna nu nedtill'
    # dra i ett grepp på den valda: rektangeln blir djupare, motstående hörn står still
    sx, sy = skarm(539814, 6427700.4); tx, ty = skarm(539816, 6427700.4)
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(tx, ty, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    xs = sorted(q[0] for q in kroppar()[-1]['fotavtryck'])
    print('3c) greppet:', xs[0], xs[-1])
    assert abs(xs[0] - 539810) < 1e-3 and abs(xs[-1] - 539816) < 0.05
    pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    assert kroppar()[-1]['fotavtryck'] == fore, 'ångra två steg'

    # polygon ur inmatningsraden
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.keyboard.press('p')
    for rad in ['539770;6427670', '@8;0', '@0;5', '@-8;0']:
        pg.fill('.planvy-kommando', rad); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(80)
    pg.fill('.planvy-kommando', ''); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(200)
    k = kroppar()
    print('4) polygon:', len(k), round(abs(sum(a[0] * b_[1] - b_[0] * a[1] for a, b_ in zip(k[-1]['fotavtryck'], k[-1]['fotavtryck'][1:] + k[-1]['fotavtryck'][:1])) / 2), 2))
    assert len(k) == 3
    pg.select_option('.planvy-panel select[data-f=status]', 'rivs'); pg.wait_for_timeout(150)

    # entrépil på husets södra fasad
    pg.keyboard.press('Escape'); pg.keyboard.press('e'); klick(539800, 6427694)
    k = kroppar()
    print('5) entré:', [v['entre'] for v in k])
    assert k[0]['entre'] is not None and pg.locator('.pv-entre').count() == 1
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.screenshot(path=f'{UT}/planvy_2_{TEMA}.png')

    # stäng: listan och projektet
    pg.click('[data-pv=stang]'); pg.wait_for_timeout(1500)
    assert pg.is_hidden('#planvy')
    print('6) listan:', pg.locator('#volymlista li').count(), '|', pg.inner_text('#status-text')[:90])
    assert pg.locator('#volymlista li').count() == 3

    # 3D-vyn: kropparna utom den som rivs
    pg.click('#visa-3d'); pg.wait_for_function("window.TERRANG_TEST.vy3d", timeout=60000); pg.wait_for_timeout(800)
    v3 = pg.evaluate("TERRANG_TEST.vy3d.volymer().map(v => v.status || 'ny')")
    print('7) 3D:', v3)
    assert sorted(v3) == ['befintlig', 'tillbyggnad']
    pg.screenshot(path=f'{UT}/planvy_3d_{TEMA}.png')
    pg.click('#vy3d-plan'); pg.wait_for_timeout(500)
    assert pg.is_visible('#planvy') and len(kroppar()) == 3, 'Plan i 3D-vyn öppnar planvyn med alla kroppar'
    pg.click('[data-pv=stang]'); pg.wait_for_timeout(300)

    # projektet: kropparna med status, huvudbyggnad, källa och entré finns kvar efter omladdning
    pg.reload(); pg.wait_for_timeout(2500)
    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(500)
    k = kroppar()
    print('8) efter omladdning:', [(v['status'], v['huvudbyggnad'], bool(v['kalla']), v['entre']) for v in k], '| gränser:', pg.locator('.pv-grans').count())
    assert sorted(v['status'] for v in k) == ['befintlig', 'rivs', 'tillbyggnad'] and any(v['entre'] for v in k) and any(v['huvudbyggnad'] for v in k)
    assert pg.locator('.pv-grans').count() > 0, 'gränserna ur det sparade resultatet'
    pg.click('[data-pv=stang]'); pg.wait_for_timeout(300)

    # Skapa igen: huset som är ritat som kropp ersätts av kroppen i underlaget
    pg.click('#flik-plats'); pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    pg.click('#skapa')
    pg.wait_for_function("!document.getElementById('skapa').disabled && !document.getElementById('resultat').hidden", timeout=180000)
    pg.click('#visa-3d'); pg.wait_for_function("window.TERRANG_TEST.senaste", timeout=60000); pg.wait_for_timeout(500)
    s9 = pg.evaluate("(() => { const s = TERRANG_TEST.senaste(); return { hus: s.byggnader.map(b => b.id), ersatta: (s.byggnaderErsatta || []).map(b => b.id), volymer: s.volymer.map(v => v.status) }; })()")
    print('9) Skapa igen:', s9)
    assert not any(h.endswith('0001') for h in s9['hus']) and s9['ersatta'][0].endswith('0001') and len(s9['volymer']) == 3
    pg.click('#vy3d-stang'); pg.wait_for_timeout(300)

    print('fel:', fel)
    assert not fel, fel
    print('planvy_test: godkänt')
    b.close()
