"""Höjdmodell för testlandskapet: 1 m, E 537750–541750, N 6425700–6429700, två COG-rutor.
Kör med python3.12 (GDAL)."""
import sys, os
import numpy as np
from osgeo import gdal, osr
gdal.UseExceptions()
UT = sys.argv[1]


def mark(X, Y):
    return (100 + 0.02 * (X - 539000) + 5 * np.sin(X / 40) * np.cos(Y / 55)
            + 90 * np.exp(-((X - 541200) ** 2 + (Y - 6427000) ** 2) / (2 * 400 ** 2)))


N0, N1 = 6425700, 6429700
for namn, e0, e1 in (('m642_53', 537750, 540000), ('m642_54', 540000, 541750)):
    w, h = e1 - e0, N1 - N0
    ds = gdal.GetDriverByName('MEM').Create('', w, h, 1, gdal.GDT_Float32)
    ds.SetGeoTransform((e0, 1, 0, N1, 0, -1))
    s = osr.SpatialReference(); s.ImportFromEPSG(5845); ds.SetSpatialRef(s)
    b = ds.GetRasterBand(1); b.SetNoDataValue(-9999)
    for r0 in range(0, h, 500):
        rr = min(500, h - r0)
        yy, xx = np.mgrid[0:rr, 0:w]
        X = e0 + xx + 0.5; Y = N1 - (r0 + yy) - 0.5
        b.WriteArray(mark(X, Y).astype('float32'), 0, r0)
    gdal.Translate(os.path.join(UT, namn + '.tif'), ds, format='COG',
                   creationOptions=['COMPRESS=DEFLATE', 'PREDICTOR=FLOATING_POINT', 'BLOCKSIZE=512', 'OVERVIEWS=AUTO'])
    print(namn, os.path.getsize(os.path.join(UT, namn + '.tif')) // 1e6, 'MB')
