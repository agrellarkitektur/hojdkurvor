"""Låtsasfiler för Byggnad och Fastighetsindelning Nedladdning, vektor (Kinda, 0513).

Skikt och fält enligt Lantmäteriets produktbeskrivningar. Huset ligger där
make_landskap.py lägger huset i laserdatan (E 539790–539810, N 6427694–6427706,
takfot 6 m, nock 10 m), så höjden kan kontrolleras. Komplementbyggnaden finns
inte i laserdatan och ska därför sakna höjd.

Kör med python3.12 (GDAL):  python3.12 test/data/make_vektor.py test/data
"""
import os, sys, zipfile
from osgeo import ogr, osr
ogr.UseExceptions()
UT = sys.argv[1]
SRS = osr.SpatialReference(); SRS.ImportFromEPSG(3006)


def ruta(x0, y0, x1, y1):
    return f'POLYGON (({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))'


def skikt(ds, namn, geom, falt):
    l = ds.CreateLayer(namn, SRS, geom, ['GEOMETRY_NAME=geometri'])
    for n, t in falt:
        l.CreateField(ogr.FieldDefn(n, t))
    return l


def lagg(l, wkt, **attr):
    f = ogr.Feature(l.GetLayerDefn())
    if l.GetGeomType() == ogr.wkbMultiPolygon and wkt.startswith('POLYGON'):
        wkt = 'MULTIPOLYGON (' + wkt[len('POLYGON '):] + ')'
    for k, v in attr.items():
        f.SetField(k, v)
    f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
    l.CreateFeature(f)


def packa(gpkg, zipnamn):
    with zipfile.ZipFile(os.path.join(UT, zipnamn), 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(gpkg, os.path.basename(gpkg))
    os.remove(gpkg)
    print(zipnamn, os.path.getsize(os.path.join(UT, zipnamn)), 'byte')


S, I, R = ogr.OFTString, ogr.OFTInteger, ogr.OFTReal

# ---------------- byggnader
p = os.path.join(UT, 'byggnad_kn0513.gpkg')
if os.path.exists(p): os.remove(p)
ds = ogr.GetDriverByName('GPKG').CreateDataSource(p)
b = skikt(ds, 'byggnad', ogr.wkbMultiPolygon, [('objektidentitet', S), ('objekttyp', S), ('andamal1', S), ('andamal2', S),
    ('husnummer', I), ('huvudbyggnad', S), ('byggnadsnamn1', S), ('insamlingslage', S), ('lagesosakerhetplan', R)])
lagg(b, ruta(539790, 6427694, 539810, 6427706), objektidentitet='9a1e0c3e-0000-4000-8000-000000000001', objekttyp='Bostad',
     andamal1='Bostad;Småhus friliggande', husnummer=1, huvudbyggnad='Ja', insamlingslage='Takkant', lagesosakerhetplan=0.5)
lagg(b, ruta(539828, 6427716, 539833, 6427720), objektidentitet='9a1e0c3e-0000-4000-8000-000000000002', objekttyp='Komplementbyggnad',
     andamal1='Komplementbyggnad;', husnummer=2, huvudbyggnad='Nej', insamlingslage='Fasad', lagesosakerhetplan=0.5)
lagg(b, ruta(540600, 6428600, 540640, 6428630), objektidentitet='9a1e0c3e-0000-4000-8000-000000000003', objekttyp='Ekonomibyggnad',
     andamal1='Ekonomibyggnad;', husnummer=1, huvudbyggnad='Ja', byggnadsnamn1='Ladan', insamlingslage='Takkant', lagesosakerhetplan=1.0)
bp = skikt(ds, 'byggnadspunkt', ogr.wkbPoint, [('objekttyp', S), ('hojd', R)])
lagg(bp, 'POINT (539700 6427800)', objekttyp='Vindkraftverk', hojd=40.0)
ds = None
packa(p, 'byggnad_kn0513.zip')

# ---------------- fastighetsindelning (skikt som i 2025-versionen)
p = os.path.join(UT, 'fastighetsindelning_kn0513.gpkg')
if os.path.exists(p): os.remove(p)
ds = ogr.GetDriverByName('GPKG').CreateDataSource(p)


def skiktG(namn, geom, falt):
    l = ds.CreateLayer(namn, SRS, geom, ['GEOMETRY_NAME=geom'])
    for n, t in falt:
        l.CreateField(ogr.FieldDefn(n, t))
    return l


yta = skiktG('registerenhetsomradesyta', ogr.wkbPolygon, [('objektidentitet', S), ('registerenhetsreferens', S), ('objekttyp', S),
    ('lanskod', S), ('kommunkod', S), ('kommunnamn', S), ('trakt', S), ('block', S), ('enhet', I), ('omradesnummer', I),
    ('samjelittera', S), ('osakertlage', I), ('etikett', S)])
PARK = [('STAREN', '1', 2, 1, 'fastighetsområde', ruta(539760, 6427660, 539840, 6427740)),
        ('STAREN', '1', 3, 1, 'fastighetsområde', ruta(539840, 6427660, 539920, 6427740)),
        ('KISA', '1', 7, 1, 'fastighetsområde',
         'POLYGON ((539500 6427500,540200 6427500,540200 6428000,539500 6428000,539500 6427500),'
         '(539760 6427660,539920 6427660,539920 6427740,539760 6427740,539760 6427660))'),
        ('KISA', 'S', 1, 1, 'samfällighetsområde', ruta(540200, 6427500, 540220, 6428000))]
for i, (trakt, blk, enh, omr, typ, wkt) in enumerate(PARK):
    lagg(yta, wkt, objektidentitet=f'f0000000-0000-4000-8000-00000000000{i}', registerenhetsreferens=f'r{i}', objekttyp=typ,
         lanskod='05', kommunkod='0513', kommunnamn='KINDA', trakt=trakt, block=blk, enhet=enh, omradesnummer=omr, osakertlage=0,
         etikett=f'{blk}:{enh}' if blk != 'S' else f's:{enh}')
gr = skiktG('registerenhetsomradesgrans', ogr.wkbLineString, [('objektidentitet', S), ('objekttyp', S), ('jb15grans', I),
    ('tatningsgrans', I), ('lagesosakerhetplan', R), ('matmetodplan', S)])
LINJER = [('LINESTRING (539760 6427660,539840 6427660,539920 6427660)', 'fastighetsgräns', 0.03, 'Geodetisk Totalstation'),
          ('LINESTRING (539920 6427660,539920 6427740,539840 6427740,539760 6427740)', 'fastighetsgräns', 0.03, 'Geodetisk Totalstation'),
          ('LINESTRING (539760 6427740,539760 6427660)', 'fastighetsgräns', 4.5, 'Digitalisering Bordsdigitalisering Ortofoto'),
          ('LINESTRING (539840 6427660,539840 6427740)', 'fastighetsgräns', 0.45, 'Geodetisk Nätverks-RTK'),
          ('LINESTRING (539500 6427500,540200 6427500,540200 6428000,539500 6428000,539500 6427500)', 'traktgräns', 4.5,
           'Digitalisering Bordsdigitalisering Ortofoto')]
for i, (wkt, typ, fel, met) in enumerate(LINJER):
    lagg(gr, wkt, objektidentitet=f'g{i}', objekttyp=typ, jb15grans=0, tatningsgrans=0, lagesosakerhetplan=fel, matmetodplan=met)
gp = skiktG('granspunkt', ogr.wkbPoint, [('objektidentitet', S), ('objekttyp', S), ('markeringstyp', S), ('etikett', S),
    ('lagesosakerhetplan', R), ('matmetodplan', S)])
for i, (x, y) in enumerate(((539760, 6427660), (539840, 6427660), (539920, 6427660), (539840, 6427740))):
    lagg(gp, f'POINT ({x} {y})', objektidentitet=f'p{i}', objekttyp='fastighetsgränspunkt', markeringstyp='rör i mark',
         etikett=f'{i + 1} rm', lagesosakerhetplan=0.03, matmetodplan='Geodetisk Totalstation')
tr = skiktG('traktyta', ogr.wkbMultiPolygon, [('objektidentitet', S), ('objekttyp', S), ('kommunkod', S), ('etikett', S)])
lagg(tr, ruta(539500, 6427500, 540200, 6428000), objektidentitet='t1', objekttyp='trakt', kommunkod='0513', etikett='KISA')
ds = None
packa(p, 'fastighetsindelning_kn0513.zip')
