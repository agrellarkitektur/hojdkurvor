"""Syntetiskt testlandskap kring testtomten (SWEREF 99 TM, RH 2000).

- Höjdmodell 1 m, 4 × 4 km, delad i Lantmäteriets 10 km-rutor 642_53 och 642_54 (COG med översikter)
- Laserdata skog (COPC) 1,3 × 1,2 km: enskilda träd, skogsbryn i söder och väster, ett hus med sadeltak
- Facit (träd och hus) som JSON för att kontrollera trädidentifiering och skuggor

Användning: make_landskap.py UTKATALOG WKT5845-FIL   (kör med python3.12 för GDAL-delen)
"""
import sys, json, os
import numpy as np

UT, WKTFIL = sys.argv[1], sys.argv[2]
os.makedirs(UT, exist_ok=True)
rng = np.random.default_rng(7)


def mark(X, Y):
    return (100 + 0.02 * (X - 539000) + 5 * np.sin(X / 40) * np.cos(Y / 55)
            + 90 * np.exp(-((X - 541200) ** 2 + (Y - 6427000) ** 2) / (2 * 400 ** 2)))


# ---------------- facit: träd och hus
trad = []
# skogsbryn i söder (N 6427440–6427585) och väster (E 539150–539480)
for x in np.arange(539150, 540150, 6.0):
    for y in np.arange(6427440, 6427586, 6.0):
        trad.append([x + rng.uniform(-1.5, 1.5), y + rng.uniform(-1.5, 1.5), rng.uniform(18, 25), rng.uniform(2.2, 3.2)])
for x in np.arange(539150, 539481, 6.0):
    for y in np.arange(6427590, 6428250, 6.0):
        trad.append([x + rng.uniform(-1.5, 1.5), y + rng.uniform(-1.5, 1.5), rng.uniform(20, 26), rng.uniform(2.2, 3.2)])
SOLITARER = [[539650, 6427750, 15, 3.0], [539700, 6427650, 12, 2.5], [539860, 6427765, 18, 3.5]]
trad += SOLITARER
trad = np.array(trad)
HUS = dict(x=539800, y=6427700, bx=10, by=6, takfot=6, nock=10)   # halva bredder

if '--bara-facit' not in sys.argv:
    # ---------------- laserpunkter
    E0, E1, N0, N1 = 539100.0, 540400.0, 6427100.0, 6428300.0
    n = int((E1 - E0) * (N1 - N0) * 1.2)
    X = rng.uniform(E0, E1, n); Y = rng.uniform(N0, N1, n)
    G = mark(X, Y); Z = G.copy(); K = np.full(n, 2, np.uint8)
    # träd: punkter inom kronan träffar kronan med 70 % sannolikhet (paraboloid), annars marken
    from scipy.spatial import cKDTree
    tr = cKDTree(trad[:, :2])
    d, i = tr.query(np.c_[X, Y], k=3)
    for kk in range(3):
        idx = i[:, kk]; dist = d[:, kk]
        h, r = trad[idx, 2], trad[idx, 3]
        inne = (dist < r) & (rng.random(n) < 0.7)
        topp = G + h * (1 - 0.35 * (dist / r) ** 2)
        hog = inne & (topp > Z)
        Z[hog] = topp[hog]; K[hog] = 1
    hus = (np.abs(X - HUS['x']) < HUS['bx']) & (np.abs(Y - HUS['y']) < HUS['by'])
    hb = mark(np.array([HUS['x']]), np.array([HUS['y']]))[0]
    Z[hus] = hb + HUS['nock'] - (HUS['nock'] - HUS['takfot']) * np.abs(Y[hus] - HUS['y']) / HUS['by']; K[hus] = 1
    brus = rng.random(n) < 0.0005
    Z[brus] += rng.choice([-30, 60], brus.sum()); K[brus] = np.where(Z[brus] > G[brus] + 40, 18, 7)

    import copclib as copc
    WKT = open(WKTFIL).read()
    cfg = copc.CopcConfigWriter(6, copc.Vector3(0.01, 0.01, 0.01), copc.Vector3(E0, N0, 0), WKT)
    hdr = cfg.las_header
    hdr.min = copc.Vector3(float(X.min()), float(Y.min()), float(Z.min()))
    hdr.max = copc.Vector3(float(X.max()), float(Y.max()), float(Z.max()))
    info = cfg.copc_info
    half = max(E1 - E0, N1 - N0) / 2 + 1
    info.center_x, info.center_y, info.center_z = (E0 + E1) / 2, (N0 + N1) / 2, float(Z.min() + Z.max()) / 2
    info.halfsize = half; info.spacing = 2 * half / 128
    w = copc.FileWriter(os.path.join(UT, 'y21c007-64275_5375_25.copc.laz'), cfg)
    r = rng.random(n)
    djup = np.where(r < 0.02, 0, np.where(r < 0.10, 1, np.where(r < 0.35, 2, 3)))
    x0, y0, z0 = info.center_x - half, info.center_y - half, info.center_z - half
    noder = {}
    for k in range(n):
        dd = int(djup[k]); c = 2 ** dd; s = 2 * half / c
        key = (dd, min(c - 1, int((X[k] - x0) / s)), min(c - 1, int((Y[k] - y0) / s)), min(c - 1, int((Z[k] - z0) / s)))
        noder.setdefault(key, []).append(k)
    for key, idx in noder.items():
        pts = copc.Points(w.copc_config.las_header)
        for k in idx:
            p = pts.CreatePoint()
            p.x, p.y, p.z = float(X[k]), float(Y[k]), float(Z[k])
            p.classification = int(K[k]); p.return_number = 1; p.number_of_returns = 1; p.intensity = 100
            pts.AddPoint(p)
        w.AddNode(copc.VoxelKey(*key), pts)
    w.Close()
    print('laser', n, 'punkter, klasser', {int(c): int((K == c).sum()) for c in np.unique(K)})

json.dump({'trad': trad.tolist(), 'solitarer': SOLITARER, 'hus': HUS}, open(os.path.join(UT, 'facit.json'), 'w'))
print('träd', len(trad))
