<?php
/*
 * Vidarebefordrar frågor till Lantmäteriets öppna STAC-katalog, för webbläsare
 * som inte får fråga katalogen direkt. Bara GET, bara katalogsökvägar, inga
 * inloggningsuppgifter skickas vidare.
 *
 * Anrop: stac.php?p=/stac-hojd/v1/collections/dsm-skoglig-copc/items?bbox=...
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// Svaren läses bara med fetch. Öppnas de direkt får de inte köra skript på sajtens domän.
header("Content-Security-Policy: default-src 'none'; sandbox");

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo '{"fel":"Bara GET"}';
    exit;
}

$p = isset($_GET['p']) ? (string) $_GET['p'] : '';
$delar = explode('?', $p, 2);
$sokvag = $delar[0];
$fraga = isset($delar[1]) ? $delar[1] : '';

if (!preg_match('#^/stac-(hojd|vektor|bild)/v1(/[A-Za-z0-9_./-]*)?$#', $sokvag) || strpos($sokvag, '..') !== false
    || ($fraga !== '' && !preg_match('#^[A-Za-z0-9_.,:=&%+-]*$#', $fraga))) {
    http_response_code(400);
    echo '{"fel":"Otillåten sökväg"}';
    exit;
}

$url = 'https://api.lantmateriet.se' . $sokvag . ($fraga !== '' ? '?' . $fraga : '');
$ctx = stream_context_create(['http' => [
    'method' => 'GET',
    'timeout' => 20,
    'ignore_errors' => true,
    'header' => "Accept: application/geo+json, application/json\r\nUser-Agent: Terrangunderlag\r\n",
]]);
$svar = @file_get_contents($url, false, $ctx);
if ($svar === false) {
    http_response_code(502);
    echo '{"fel":"Kunde inte nå Lantmäteriet"}';
    exit;
}
$status = 200;
if (isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0], $m)) {
    $status = (int) $m[1];
}
http_response_code($status);
header('Cache-Control: public, max-age=3600');
echo $svar;
