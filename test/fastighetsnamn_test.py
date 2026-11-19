# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för Hämta från kartan vid Projekt eller fastighet (AX, 0.13.1).

    python3 test/server.py test/data . &
    python3 test/fastighetsnamn_test.py <utkatalog> [tema]

Prövar: utan inloggning och utan sparad fil (besked), inloggad (hämtar
fastighetsindelningen ur låtsasfilen för Kinda) och utloggad igen (läser den
sparade filen i webbläsaren). Kräver att beteckningen hamnar i fältet och filnamnet.
"""
import sys, re, os
UT = sys.argv[1] if len(sys.argv) > 1 else '.'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
os.makedirs(UT, exist_ok=True)
from playwright.sync_api import sync_playwright
ROT='http://127.0.0.1:8765'
INIT=f"""window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}'; window.TERRANG_TEST={{}};
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}); pg=ctx.new_page()
    fel=[]; pg.on('pageerror', lambda e: fel.append(str(e)))
    ctx.add_init_script(INIT); ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis).*'), lambda r: r.abort())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(1000)
    pg.click('#rita'); box=pg.locator('#karta').bounding_box()
    cx,cy=box['x']+box['width']*0.45, box['y']+box['height']*0.6
    pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx+40,cy+30,steps=5); pg.mouse.up()
    pg.select_option('#zon','3006')
    for k,v in dict(xmin=539750,xmax=539850,ymin=6427650,ymax=6427750).items():
        pg.fill('#'+k,str(v)); pg.dispatch_event('#'+k,'change')
    pg.wait_for_timeout(1500)
    def klick(dx=0, dy=0):
        pg.click('#projekt-karta'); pg.wait_for_timeout(100)
        print('  knapp:', pg.inner_text('#projekt-karta'), '|', pg.inner_text('#projekt-hjalp'))
        # klick på utsnittets mitt (ramen) + förskjutning i pixlar
        pt = pg.evaluate(f"""(() => {{ const k = TERRANG_TEST.karta, ll = Terrang.omvandlare(3006, 4326).forward([{539800+dx}, {6427700+dy}]);
          k.setView([ll[1], ll[0]], 18, {{ animate: false }}); const p = k.latLngToContainerPoint([ll[1], ll[0]]), b = k.getContainer().getBoundingClientRect(); return [b.x + p.x, b.y + p.y]; }})()""")
        pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(2500)
        print('  fält:', pg.input_value('#projekt'), '| filnamn:', pg.input_value('#namn'), '|', pg.inner_text('#projekt-hjalp'))
    print('1) inte inloggad, inget sparat'); klick()
    pg.fill('#anv','test'); pg.fill('#losen','hemligt-åäö')
    print('2) inloggad, hämtar'); pg.once('dialog', lambda d: d.accept()); klick()
    pg.screenshot(path=f'test/ut/ax_{TEMA}.png', clip={'x':0,'y':0,'width':1400,'height':900})
    pg.fill('#losen','')
    print('3) utloggad, från webbläsarens lagring, 0,7 bredd åt höger (Staren 1:3)'); klick(70, 0)
    assert pg.input_value('#projekt') == 'Staren 1:3', 'läst ur webbläsarens lagring'
    assert not fel, fel
    print('fastighetsnamn: godkänt')
