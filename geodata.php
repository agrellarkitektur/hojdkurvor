<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Vidarebefordrar GET-frågor till ett fåtal öppna geodatatjänster, för webbläsare
 * som inte får fråga dem direkt (CORS). Bara adresser som börjar som i $VITLISTA
 * släpps igenom. Inga cookies eller inloggningsuppgifter skickas vidare.
 * Omdirigeringar följs bara till https på en av vitlistans servrar (0.13.3),
 * högst två gånger.
 *
 * Anrop: geodata.php?u=<urlkodad adress>
 */
header('X-Content-Type-Options: nosniff');
// Svaren läses bara med fetch. Öppnas de direkt får de inte köra skript på sajtens domän.
header("Content-Security-Policy: default-src 'none'; sandbox");

$VITLISTA = [
    'https://geodata.naturvardsverket.se/naturvardsregistret/wfs?',
    'https://geodata.naturvardsverket.se/naturvardsregistret/wms?',
    'https://geodata.naturvardsverket.se/n2000/wfs?',
    'https://pub.raa.se/visning/lamningar_v1/wms?',
    'https://gis-tjanster.mcf.se/arcgis/services/Oversvamningskarteringar/karteringar/MapServer/WmsServer?',
];
$TYPER = ['application/json', 'application/geo+json', 'application/vnd.geo+json', 'image/png', 'text/xml', 'application/xml', 'text/plain'];
$MAX = 8 * 1024 * 1024;

function fel($kod, $text) {
    http_response_code($kod);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['fel' => $text], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fel(405, 'Bara GET');
$u = isset($_GET['u']) ? (string) $_GET['u'] : '';
$ok = false;
foreach ($VITLISTA as $prefix) {
    if (strncmp($u, $prefix, strlen($prefix)) === 0) { $ok = true; break; }
}
if (!$ok || strlen($u) > 2000 || preg_match('/[\s\x00-\x1f]/', $u)) fel(400, 'Otillåten adress');

$VARDAR = array_unique(array_map(fn($p) => strtolower((string) parse_url($p, PHP_URL_HOST)), $VITLISTA));

/** Vart en omdirigering pekar, som hel adress. null om den inte får följas. */
function omdirigering($fran, $till, $vardar) {
    $till = trim($till);
    if ($till === '' || strlen($till) > 2000 || preg_match('/[\s\x00-\x1f]/', $till)) return null;
    $f = parse_url($fran);
    if (strncmp($till, '//', 2) === 0) $till = 'https:' . $till;
    elseif ($till[0] === '/') $till = 'https://' . $f['host'] . $till;
    elseif (!preg_match('#^https?://#i', $till)) return null;
    $d = parse_url($till);
    if (!is_array($d) || strtolower($d['scheme'] ?? '') !== 'https' || empty($d['host'])) return null;
    if (isset($d['user']) || isset($d['pass']) || (isset($d['port']) && (int) $d['port'] !== 443)) return null;
    return in_array(strtolower($d['host']), $vardar, true) ? $till : null;
}

// PHP får inte följa omdirigeringar själv: då prövas inte målet. Varje steg hämtas för sig.
$ctx = stream_context_create(['http' => [
    'method' => 'GET',
    'timeout' => 25,
    'ignore_errors' => true,
    'follow_location' => 0,
    'max_redirects' => 0,
    // En del brandväggar spärrar okända klienter; säg vilka vi är som en webbläsare gör (0.14.4)
    'header' => "User-Agent: Mozilla/5.0 (compatible; Hojdkurvor/1.0; +https://hojdkurvor.se/)\r\nAccept: application/json, application/geo+json, image/png, */*\r\n",
]]);
$adress = $u;
for ($steg = 0; ; $steg++) {
    $http_response_header = null;
    $svar = @file_get_contents($adress, false, $ctx, 0, $MAX + 1);
    if ($svar === false) fel(502, 'Kunde inte nå tjänsten');
    $kod = 0; $vidare = null;
    foreach ((array) $http_response_header as $rad) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $rad, $m)) $kod = (int) $m[1];
        if (preg_match('#^Location:\s*(.+)$#i', $rad, $m)) $vidare = $m[1];
    }
    if (!in_array($kod, [301, 302, 303, 307, 308], true) || $vidare === null) break;
    if ($steg >= 2) fel(502, 'Tjänsten omdirigerar för många gånger');
    $adress = omdirigering($adress, $vidare, $VARDAR);
    if ($adress === null) fel(502, 'Tjänsten hänvisar till en adress som inte är tillåten');
}
if (strlen($svar) > $MAX) fel(502, 'Svaret är för stort');

$status = 200;
$typ = 'application/octet-stream';
if (isset($http_response_header)) {
    foreach ($http_response_header as $rad) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $rad, $m)) $status = (int) $m[1];
        if (preg_match('#^Content-Type:\s*([^;]+)#i', $rad, $m)) $typ = strtolower(trim($m[1]));
    }
}
if (!in_array($typ, $TYPER, true)) fel(502, 'Oväntat svar från tjänsten');
http_response_code($status);
header('Content-Type: ' . $typ);
// Bara lyckade svar sparas i webbläsaren. Ett tillfälligt fel ska inte ligga kvar i en timme.
header($status === 200 ? 'Cache-Control: public, max-age=3600' : 'Cache-Control: no-store');
echo $svar;
