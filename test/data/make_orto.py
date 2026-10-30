"""Låtsasortofoton för testerna, i samma form som Lantmäteriets Ortofoto Nedladdning (COG, SWEREF 99 TM).

    python3.12 test/data/make_orto.py test/data

Kräver numpy och GDAL (osgeo) och att make_dtm.py har körts (bilden är en skuggning av höjdmodellen).
Skapar tre filer i test/data:
  o64275_5390_t_mr25.tif  2025, rgbi (4 band, DEFLATE), 539 000–539 800, 6 427 000–6 429 000, 0,5 m
  o64275_5398_t_mr25.tif  2025, rgbi, 539 800–540 600 (grannrutan, för mosaiken)
  o64275_5390_t_fm19.tif  2019, rgb (3 band, JPEG/YCbCr), samma yta som den första
Kontrollmönster: röda linjer (255, 0, 0), 1 m breda, längs x = 539 x10, 539 x20 … (var tionde meter i öst)
och blå linjer (0, 0, 255) längs y = 6 427 x05, x15 … I rutan 2019 är linjerna gula.
"""
import os, sys
import numpy as np
from osgeo import gdal

UT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(__file__)
S = 0.5
Y0, Y1 = 6427000, 6429000


def dtm(x0, x1):
    """Markhöjd 1 m för x0..x1 ur höjdrutorna."""
    delar = []
    for e0, namn in ((530000, 'm642_53.tif'), (540000, 'm642_54.tif')):
        a, b = max(x0, e0), min(x1, e0 + 10000)
        if b <= a:
            continue
        ds = gdal.Open(os.path.join(UT, namn))
        gt = ds.GetGeoTransform()
        c0, r0 = int(round((a - gt[0]) / gt[1])), int(round((gt[3] - Y1) / -gt[5]))
        delar.append(ds.GetRasterBand(1).ReadAsArray(c0, r0, int(b - a), Y1 - Y0).astype(np.float32))
    return np.hstack(delar)


def bild(x0, x1, ar):
    z = dtm(x0, x1)
    z = np.repeat(np.repeat(z, 2, axis=0), 2, axis=1)       # 1 m → 0,5 m
    gy, gx = np.gradient(z, S)
    skugga = np.clip(0.75 + (-gx * 0.6 + gy * 0.6) * 1.2, 0.35, 1.0)
    h, w = z.shape
    rgb = np.stack([skugga * 120 + 30, skugga * 150 + 40, skugga * 90 + 20]).astype(np.float32)
    if x0 >= 539800:
        rgb[2] += 40                                         # grannrutan något blåare, så att skarven syns
    xs = x0 + (np.arange(w) + 0.5) * S
    ys = Y1 - (np.arange(h) + 0.5) * S
    # grå vägbanor längs två av testserverns OSM-vägar (0.11.0), så att mätningen av bredden prövas:
    # Bygatan 7,5 m bred och Skolvägen 5 m, Bygatan 1 m norr om OSM-linjen
    X, Yg = np.meshgrid(xs, ys)
    for pts, bredd, dy in ((((539400, 6427640), (539600, 6427660), (539800, 6427650), (540100, 6427700)), 7.5, 1.0),
                           (((539700, 6427500), (539705, 6427650), (539720, 6427900)), 5.0, 0.0)):
        d = np.full(X.shape, np.inf, dtype=np.float32)
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            ay += dy; by += dy
            vx, vy = bx - ax, by - ay
            t = np.clip(((X - ax) * vx + (Yg - ay) * vy) / (vx * vx + vy * vy), 0, 1)
            d = np.minimum(d, np.hypot(X - ax - t * vx, Yg - ay - t * vy))
        vag = d <= bredd / 2
        for k, c in enumerate((112, 110, 106)):
            rgb[k][vag] = c + (skugga[vag] - 0.75) * 30
    linje_x = np.abs(xs - np.round(xs / 10) * 10) < 0.5
    linje_y = np.abs((ys - 5) - np.round((ys - 5) / 10) * 10) < 0.5
    rod, bla = (255, 0, 0), (0, 0, 255)
    if ar == 2019:
        rod = bla = (255, 230, 0)
    for k in range(3):
        rgb[k][:, linje_x] = rod[k]
        rgb[k][linje_y, :] = bla[k]
    # ett tomt hörn (nodata 0,0,0), som vid kusten
    rgb[:, :40, :40] = 0
    return np.clip(rgb, 0, 255).astype(np.uint8)


def skriv(namn, x0, x1, ar, band4):
    rgb = bild(x0, x1, ar)
    h, w = rgb.shape[1:]
    n = 4 if band4 else 3
    mem = gdal.GetDriverByName('MEM').Create('', w, h, n, gdal.GDT_Byte)
    mem.SetGeoTransform((x0, S, 0, Y1, 0, -S))
    mem.SetProjection('EPSG:3006')
    for k in range(3):
        mem.GetRasterBand(k + 1).WriteArray(rgb[k])
    if band4:
        nir = np.where(rgb[0] > 0, 200, 0).astype(np.uint8)
        mem.GetRasterBand(4).WriteArray(nir)
    for k in range(n):
        mem.GetRasterBand(k + 1).SetNoDataValue(0)
    opt = ['COMPRESS=DEFLATE', 'BLOCKSIZE=512'] if band4 else ['COMPRESS=JPEG', 'QUALITY=92', 'BLOCKSIZE=512']
    gdal.Translate(os.path.join(UT, namn), mem, format='COG', creationOptions=opt)
    print(namn, w, 'x', h)


gdal.UseExceptions()
skriv('o64275_5390_t_mr25.tif', 539000, 539800, 2025, True)
skriv('o64275_5398_t_mr25.tif', 539800, 540600, 2025, True)
skriv('o64275_5390_t_fm19.tif', 539000, 539800, 2019, False)
