<?php
/*
 * Vidarebefordrar GET-frågor till ett fåtal öppna geodatatjänster, för webbläsare
 * som inte får fråga dem direkt (CORS). Bara adresser som börjar som i $VITLISTA
 * släpps igenom. Inga cookies eller inloggningsuppgifter skickas vidare.
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
$TYPER = ['application/json', 'application/geo+json', 'image/png', 'text/xml', 'application/xml', 'text/plain'];
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

$ctx = stream_context_create(['http' => [
    'method' => 'GET',
    'timeout' => 25,
    'ignore_errors' => true,
    'follow_location' => 1,
    'max_redirects' => 2,
    'header' => "User-Agent: hojdkurvor.se\r\nAccept: application/json, image/png, */*\r\n",
]]);
$svar = @file_get_contents($u, false, $ctx, 0, $MAX + 1);
if ($svar === false) fel(502, 'Kunde inte nå tjänsten');
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
header('Cache-Control: public, max-age=3600');
echo $svar;
