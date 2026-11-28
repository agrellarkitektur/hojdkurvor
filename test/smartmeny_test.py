# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för planvyns verktyg i 0.16.6 (BN–BQ, BP): Flytta och Rotera, smartmenyn, Lås form och Lås
placering, texter och hörnnummer att dra, egna mått, måtten i rader, träd och hus i planvyn och Se dolda.

    python3 test/server.py test/data . &
    python3 test/smartmeny_test.py <utkatalog> [tema]
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
    # knapparna till cad-apa är dolda (BV/AÄ)
    dolda = pg.evaluate("[...document.querySelectorAll('[data-cadapa]')].map(e => e.hidden)")
    print('0) cad-apa dolda:', dolda)
    assert dolda and all(dolda)
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
    for v in ('byggnader', 'fastigheter', 'laser', 'trad'):
        loc = pg.locator(f'input[name=tillval][value={v}]')
        if loc.is_enabled(): loc.check()
    pg.click('#flik-plats')
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    pg.on('dialog', lambda d: d.accept())
    pg.click('#skapa')
    pg.wait_for_function("!document.getElementById('skapa').disabled && !document.getElementById('resultat').hidden", timeout=240000)

    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(600)
    kroppar = lambda: pg.evaluate("TERRANG_TEST.planvy.volymer()")
    S = lambda uttryck: pg.evaluate(f"(() => {{ const S = TERRANG_TEST.planvy._test.S; return {uttryck}; }})()")
    def skarm(x, y):
        return pg.evaluate(f"""(() => {{ const t = TERRANG_TEST.planvy._test, s = t.w2s([{x}, {y}]), r = document.querySelector('.planvy-svg').getBoundingClientRect(); return [r.x + s[0], r.y + s[1]]; }})()""")
    def klick(x, y):
        sx, sy = skarm(x, y); pg.mouse.move(sx, sy); pg.wait_for_timeout(40); pg.mouse.click(sx, sy); pg.wait_for_timeout(150)
    def dra(x, y, dx, dy):
        sx, sy = skarm(x, y); pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + dx, sy + dy, steps=8); pg.mouse.up(); pg.wait_for_timeout(150)
    def rekt(e, n, b_, d):
        pg.click('[data-verktyg=rekt]')
        pg.fill('.planvy-kommando', f'{e};{n}'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(80)
        sx, sy = skarm(e + b_, n + d); pg.mouse.move(sx, sy); pg.wait_for_timeout(80)
        pg.fill('.planvy-kommando', f'{b_}x{d}'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(150)
    def meny():
        return pg.locator('.planvy-smart button').all_text_contents() if pg.is_visible('.planvy-smart') else []
    def visa(x, y, z=6):
        pg.evaluate(f"(() => {{ const t = TERRANG_TEST.planvy._test; t.S.vy.cx = {x}; t.S.vy.cy = {y}; t.S.vy.z = {z}; t.rita(); }})()"); pg.wait_for_timeout(100)
    def avmarkera():
        if pg.is_visible('.planvy-smart'): pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        if S('S.verktyg') != 'valj': pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
        for _ in range(3):
            if S('S.vald') is None: break
            pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    def menyval(text):
        pg.locator('.planvy-smart button', has_text=text).first.click(); pg.wait_for_timeout(150)
    pg.evaluate("TERRANG_TEST.planvy._test.S.riktning = 0")

    # 1. ett befintligt hus 20 × 8 och en tillbyggnad 6 × 4 på norra sidan, som i bilden 28 november
    rekt(539790, 6427690, 20, 8)
    pg.select_option('#planvy [data-f=status]', 'befintlig'); pg.wait_for_timeout(100)
    pg.fill('#planvy [data-f=namn]', 'Lägenheter'); pg.dispatch_event('#planvy [data-f=namn]', 'change'); pg.wait_for_timeout(100)
    rekt(539796, 6427698, 6, 4)
    pg.select_option('#planvy [data-f=status]', 'tillbyggnad'); pg.wait_for_timeout(100)
    avmarkera()
    pg.click('[data-pv=passa]'); pg.wait_for_timeout(200)
    rad = pg.evaluate("Situationsplan.matt(TERRANG_TEST.planvy.volymer(), []).filter(m => m.typ !== 'grans' && m.n && m.n[1] > 0.99).map(m => [m.text, m.rad, Math.round((m.fran[1] + m.bas) * 100) / 100])")
    print('1) måtten åt norr:', rad)
    assert sorted(r[0] for r in rad if r[1] == 0) == ['6,0', '6,0', '8,0'] and [r[0] for r in rad if r[1] == 1] == ['20,0']
    assert len(set(r[2] for r in rad)) == 1, 'samma linje'

    # 2. smartmenyn: klick mitt i tillbyggnaden, på ett hörn och på en sida
    klick(539799, 6427700.5)
    m = meny(); print('2) byggnad:', m)
    assert 'Flytta' in m and 'Lås form' in m and 'Lås placering' in m
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    klick(539802, 6427702)
    m = meny(); print('   hörn:', m)
    assert 'Flytta härifrån' in m and 'Rotera kring hörnet' in m and 'Mått till tomtgräns härifrån' in m
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    klick(539802, 6427700)
    m = meny(); print('   sida:', m)
    assert any('yttermått' in x.lower() for x in m) and 'Entré här' in m
    avmarkera()

    # 3. Flytta: en fristående byggnad från sitt hörn till husets sydöstra hörn
    rekt(539815, 6427684, 5, 3)
    pg.keyboard.press('m'); pg.wait_for_timeout(100)
    klick(539815, 6427684); klick(539810, 6427690)
    f = kroppar()[-1]['fotavtryck']
    print('3) flyttad, hörnet:', f[0])
    assert any(abs(q[0] - 539810) < 1e-6 and abs(q[1] - 6427690) < 1e-6 for q in f), 'hörnet hamnar exakt'
    # skrivet avstånd
    pg.keyboard.press('m'); pg.wait_for_timeout(100)
    klick(539810, 6427690)
    sx, sy = skarm(539816, 6427690); pg.mouse.move(sx, sy); pg.wait_for_timeout(80)
    pg.fill('.planvy-kommando', '@4;0'); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(150)
    f2 = kroppar()[-1]['fotavtryck']
    print('   @4;0:', round(f2[0][0] - f[0][0], 3))
    assert abs(f2[0][0] - f[0][0] - 4) < 1e-6

    # 4. Rotera: vrid 30°, sedan rotationspunkt, referens (sidan) och mål (husets södra sida)
    pg.click('[data-a=vrid]'); pg.fill('.pv-vridin', '30'); pg.press('.pv-vridin', 'Enter'); pg.wait_for_timeout(150)
    f = kroppar()[-1]['fotavtryck']
    pg.keyboard.press('o'); pg.wait_for_timeout(100)
    klick(*f[0])
    mitt = [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2]
    klick(*mitt); klick(539800, 6427690)
    f = kroppar()[-1]['fotavtryck']
    vinklar = [math.degrees(math.atan2(f[(i + 1) % 4][1] - f[i][1], f[(i + 1) % 4][0] - f[i][0])) % 90 for i in range(4)]
    print('4) vinklar efter Rotera:', [round(a, 3) for a in vinklar])
    assert all(min(a, 90 - a) < 0.01 for a in vinklar)

    # 5. Lås form: ett hörn flyttar hela byggnaden med samma storlek
    pg.click('[data-a=lasform]'); pg.wait_for_timeout(100)
    f0 = kroppar()[-1]['fotavtryck']
    dra(*f0[2], 30, -20)
    f1 = kroppar()[-1]['fotavtryck']
    sid = lambda f: sorted(round(math.dist(f[i], f[(i + 1) % 4]), 4) for i in range(4))
    print('5) låst form:', sid(f0), sid(f1), round(f1[0][0] - f0[0][0], 3))
    assert sid(f0) == sid(f1) and abs(f1[0][0] - f0[0][0]) > 0.5
    # Lås placering: inget går att flytta
    pg.click('[data-a=lasplats]'); pg.wait_for_timeout(100)
    c = [sum(q[0] for q in f1) / 4, sum(q[1] for q in f1) / 4]
    dra(*c, 60, 40)
    f2 = kroppar()[-1]['fotavtryck']
    print('6) låst placering:', f2 == f1, 'låst' in pg.locator('.pv-lasikon').all_text_contents())
    assert f2 == f1 and kroppar()[-1].get('last') is True
    pg.keyboard.press('Delete'); pg.wait_for_timeout(100)
    assert len(kroppar()) == 3, 'en låst byggnad tas inte bort'

    # 7. texten för tillbyggnaden dras ut åt öster, ledaren pekar på mitten
    avmarkera()
    klick(539799, 6427700.5); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)   # markera tillbyggnaden, stäng menyn
    et = pg.locator('.pv-etikett[data-etikett]', has_text='BYGGNAD 2').first
    bb = et.bounding_box()
    pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.mouse.down()
    pg.mouse.move(bb['x'] + bb['width'] / 2 + 160, bb['y'] + bb['height'] / 2 - 40, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    till = [v for v in kroppar() if v['status'] == 'tillbyggnad'][0]
    ann = {k: v for k, v in (till.get('matt') or {}).items() if '|et|' in k}
    print('7) texten:', ann)
    assert ann and list(ann.values())[0]['t'][0] > 5
    # Välj vart ledaren pekar: ett hörn
    et = pg.locator('.pv-etikett[data-etikett]', has_text='BYGGNAD 2').first
    bb = et.bounding_box(); pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(150)
    print('   meny:', meny())
    menyval('Välj vart ledaren pekar'); klick(539802, 6427702)
    till = [v for v in kroppar() if v['status'] == 'tillbyggnad'][0]
    pil = [v for k, v in till['matt'].items() if '|et|' in k][0]['pil']
    print('   pilen:', pil)
    assert abs(pil[0] - 3) < 1e-6 and abs(pil[1] - 2) < 1e-6

    # 8. hörnnummer dras
    avmarkera()
    pg.check('[data-visa=koordlista]'); pg.wait_for_timeout(200)
    nr = pg.locator('.pv-koordnr[data-nr]').first; bb = nr.bounding_box()
    pg.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.mouse.down(); pg.mouse.move(bb['x'] + 40, bb['y'] - 30, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)
    alla = {k: v for x in kroppar() for k, v in (x.get('matt') or {}).items() if '|nr|' in k}
    print('8) nummer:', alla, 'linjer', pg.locator('.pv-nrlinje').count())
    assert alla and pg.locator('.pv-nrlinje').count() == 1

    # 9. eget gränsmått från ett hörn av en ny byggnad
    rekt(539860, 6427700, 6, 5)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    visa(539863, 6427702)
    g0 = pg.locator('.pv-gmattext').count()
    lagt = False
    for hx, hy in ((539860, 6427700), (539866, 6427700), (539866, 6427705), (539860, 6427705)):
        klick(hx, hy)
        knapp = pg.locator('.planvy-smart button', has_text='Mått till tomtgräns härifrån')
        if pg.is_visible('.planvy-smart') and knapp.count() and knapp.is_enabled():
            knapp.click(); pg.wait_for_timeout(150); lagt = True; break
        avmarkera()
    print('9) eget gränsmått:', lagt, g0, '→', pg.locator('.pv-gmattext').count())
    assert lagt and pg.locator('.pv-gmattext').count() == g0 + 1
    avmarkera()

    # 10. ett hus från Lantmäteriet döljs ur smartmenyn och visas med Se dolda
    hus = pg.evaluate("""(() => { const t = TERRANG_TEST.planvy._test, vol = TERRANG_TEST.planvy.volymer();
      return t.hus.filter(h => !h.dolt).map(h => { const f = h.fotavtryck; return [f.reduce((s, q) => s + q[0], 0) / f.length, f.reduce((s, q) => s + q[1], 0) / f.length]; })
        .filter(c => !vol.some(v => Kropp.inuti(v.fotavtryck, c[0], c[1]))); })()""")
    print('10) hus:', len(hus))
    if hus:
        visa(*hus[0])
        n0 = pg.locator('.pv-hus').count()
        klick(*hus[0]); m = meny(); print('   meny:', m)
        menyval('Dölj huset')
        n1 = pg.locator('.pv-hus').count()
        pg.click('[data-pv=sedolda]'); pg.wait_for_timeout(150)
        n2 = pg.locator('.pv-husdolt').count()
        klick(*hus[0]); menyval('Visa huset')
        pg.click('[data-pv=sedolda]'); pg.wait_for_timeout(150)
        print('   hus:', n0, '→', n1, 'utgrått', n2, '→', pg.locator('.pv-hus').count())
        assert n1 == n0 - 1 and n2 == 1 and pg.locator('.pv-hus').count() == n0

    # 11. ett träd: krona ur smartmenyn
    t = pg.evaluate("(() => { const s = TERRANG_TEST.planvy._test.S; return s.trad.filter(t => !t.dolt).map(t => [t.x, t.y, t.krona])[0] || null; })()")
    if not t:   # testdatans utsnitt har inga träd: lägg till ett eget
        visa(539850, 6427740)
        pg.click('[data-verktyg=trad]'); klick(539850, 6427740); pg.click('[data-verktyg=valj]'); pg.wait_for_timeout(100)
        t = pg.evaluate("(() => { const s = TERRANG_TEST.planvy._test.S; return s.trad.filter(t => !t.dolt).map(t => [t.x, t.y, t.krona])[0] || null; })()")
    assert t, 'ett träd'
    print('11) träd:', t)
    if t:
        pg.check('[data-visa=trad]') if not pg.is_checked('[data-visa=trad]') else None
        pg.wait_for_timeout(100)
        visa(t[0], t[1])
        klick(t[0], t[1]); print('   meny:', meny())
        assert pg.is_visible('.planvy-smart [data-tf=krona]')
        if True:
            pg.fill('.planvy-smart [data-tf=krona]', '7,5'); pg.press('.planvy-smart [data-tf=krona]', 'Enter'); pg.wait_for_timeout(200)
            k2 = pg.evaluate(f"TERRANG_TEST.planvy._test.S.trad.find(q => Math.hypot(q.x - {t[0]}, q.y - {t[1]}) < 0.2).krona")
            print('   krona:', t[2], '→', k2)
            assert abs(k2 - 7.5) < 1e-6

    avmarkera()
    visa(539805, 6427695, 14)
    klick(539799, 6427700.5); pg.wait_for_timeout(100)
    pg.screenshot(path=f'{UT}/smartmeny_1_{TEMA}.png')
    avmarkera()
    pg.screenshot(path=f'{UT}/smartmeny_2_{TEMA}.png')

    # 12. situationsplanen som PDF: texten, ledaren och numren som de dragits
    with ctx.expect_page(timeout=120000) as ny:
        pg.click('[data-a=sp-pdf]')
    flik = ny.value
    flik.wait_for_selector('a[download]', timeout=120000)
    with flik.expect_download() as dl:
        flik.click('a[download]')
    pdf = open(dl.value.path(), 'rb').read()
    open(f'{UT}/smartmeny.pdf', 'wb').write(pdf)
    flik.close()
    txt = subprocess.run(['pdftotext', f'{UT}/smartmeny.pdf', '-'], capture_output=True, text=True).stdout
    print('12) PDF:', len(pdf), 'LÄGENHETER' in txt, 'BYGGNAD 2' in txt)
    assert 'LÄGENHETER' in txt and 'BYGGNAD 2' in txt

    # 13. omladdning: låsen och texterna ligger kvar
    pg.click('[data-pv=stang]'); pg.wait_for_timeout(1500)
    pg.reload(); pg.wait_for_timeout(2500)
    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(600)
    k = kroppar()
    print('13) efter omladdning:', [(v['namn'], v.get('last'), v.get('lastForm'), len(v.get('matt') or {})) for v in k])
    assert any(v.get('last') for v in k) and any('|et|' in x for v in k for x in (v.get('matt') or {}))
    print('fel:', fel)
    assert not fel, fel
    print('smartmeny_test: godkänt')
    b.close()
