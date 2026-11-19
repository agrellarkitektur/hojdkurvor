<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Tar emot synpunkter från formuläret Skicka synpunkter och mejlar dem vidare
 * (Höjdkurvor 0.7.0). Samma upplägg som feedback.php i cad-apa.
 *
 * Mottagaren står inte här, eftersom koden är öppen. Den står i
 * feedback-config.php, samma fil som cad-apa använder. Den letas upp i mappen
 * ovanför appen (t.ex. public_html, där den ligger kvar vid uppdateringar och
 * delas med cad-apa) och sedan i appens egen mapp:
 *
 *   <?php
 *   return [
 *     'to'   => 'du@dindomän.se',
 *     'from' => 'noreply@dindomän.se',
 *   ];
 *
 * `from` ska vara en adress som finns på webbplatsens egen domän. Den används
 * också som kuvertavsändare (Return-Path), så att brev som vidarebefordras,
 * t.ex. från webbposten till Gmail, inte stoppas av SPF och DMARC.
 *
 * Öppna synpunkter.php i webbläsaren för att se om konfigurationen hittas.
 *
 * Skydd mot spam: ett dolt fält som bara robotar fyller i, en spärr mot
 * formulär som skickas på under tre sekunder, högst fem meddelanden i timmen
 * per avsändare, högst 30 i timmen från alla tillsammans och en gräns för
 * längden. Formuläret tas bara emot från appens egna sidor (0.13.3): anropet
 * ska vara JSON och komma från samma värdnamn som skriptet ligger på, så att
 * en annan webbplats inte kan få sina besökare att skicka det. Inga
 * personuppgifter sparas; spärren använder en hash av adressen och glöms
 * efter en timme.
 */

const MAX_PER_AVSANDARE = 5;
const MAX_ALLA = 30;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function svara(int $kod, array $kropp): void {
  http_response_code($kod);
  echo json_encode($kropp, JSON_UNESCAPED_UNICODE);
  exit;
}

/** Konfigurationen, eller ett felmeddelande som säger vad som är fel. */
function lasKonfig(): array {
  $platser = ['mappen ovanför' => dirname(__DIR__) . '/feedback-config.php', 'appens mapp' => __DIR__ . '/feedback-config.php'];
  $fil = null; $var = null;
  foreach ($platser as $namn => $f) {
    if (@is_file($f)) { $fil = $f; $var = $namn; break; }
  }
  if (!$fil) {
    $fel = 'Synpunkter är inte uppsatta på den här servern: hittar inte feedback-config.php, varken i mappen ovanför appen eller i appens mapp.';
    if (ini_get('open_basedir')) $fel .= ' Webbhotellet begränsar vilka mappar skriptet får läsa (open_basedir); lägg filen i appens mapp.';
    return ['fel' => $fel];
  }
  $k = @include $fil;
  if (!is_array($k)) return ['fel' => "feedback-config.php hittades ($var) men ger ingen lista. Den ska sluta med return [ ... ];"];
  foreach (['to', 'from'] as $n) {
    if (!filter_var($k[$n] ?? '', FILTER_VALIDATE_EMAIL)) return ['fel' => "feedback-config.php hittades ($var) men '$n' är ingen giltig e-postadress."];
  }
  return ['konfig' => $k, 'var' => $var];
}

// Kontroll: öppna synpunkter.php i webbläsaren för att se om allt är uppsatt.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
  $k = lasKonfig();
  if (isset($k['fel'])) svara(503, ['ok' => false, 'error' => $k['fel']]);
  svara(200, ['ok' => true, 'config' => $k['var'], 'mail' => function_exists('mail') ? 'finns' : 'saknas']);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') svara(405, ['ok' => false, 'error' => 'Fel metod.']);

/** Värdnamnet (med port) i en adress, med små bokstäver. Tom text om adressen inte går att läsa. */
function vardnamn(string $adress): string {
  $d = parse_url($adress);
  if (!is_array($d) || empty($d['host'])) return '';
  return strtolower($d['host']) . (isset($d['port']) ? ':' . $d['port'] : '');
}

/**
 * Kommer anropet från appens egen sida? Webbläsaren skickar Origin med varje
 * POST från fetch, och Sec-Fetch-Site säger om sidan ligger på samma adress.
 * Saknas Origin prövas Referer. Saknas båda avvisas anropet.
 */
function franEgenSida(): bool {
  $plats = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
  if ($plats !== '' && $plats !== 'same-origin') return false;
  $har = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
  $kalla = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
  if ($kalla === '' || $kalla === 'null') $kalla = (string)($_SERVER['HTTP_REFERER'] ?? '');
  $fran = vardnamn($kalla);
  if ($har === '' || $fran === '') return false;
  $utanPort = fn($v) => preg_replace('/:(80|443)$/', '', $v);
  return $utanPort($fran) === $utanPort($har);
}

if (!franEgenSida()) svara(403, ['ok' => false, 'error' => 'Formuläret kan bara skickas från appens egen sida.']);
// JSON går inte att skicka från ett vanligt formulär på en annan webbplats.
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) svara(415, ['ok' => false, 'error' => 'Formuläret kunde inte läsas.']);

$k = lasKonfig();
if (isset($k['fel'])) svara(503, ['ok' => false, 'error' => $k['fel']]);
$till = $k['konfig']['to'];
$fran = $k['konfig']['from'];

$ra = file_get_contents('php://input', false, null, 0, 20000);
$d = json_decode($ra ?: '', true);
if (!is_array($d)) svara(400, ['ok' => false, 'error' => 'Formuläret kunde inte läsas.']);

// Robotar fyller i det dolda fältet: låtsas att det gick bra.
if (!empty($d['website'])) svara(200, ['ok' => true]);
// För snabbt för en människa.
if ((int)($d['elapsed'] ?? 0) < 3000) svara(400, ['ok' => false, 'error' => 'Vänta några sekunder och försök igen.']);

$text = trim((string)($d['message'] ?? ''));
$epost = trim((string)($d['email'] ?? ''));
$version = mb_substr(preg_replace('/[^\p{L}\d .\-]/u', '', (string)($d['version'] ?? '')), 0, 40);
$sida = mb_substr(preg_replace('/[^\w\-]/u', '', (string)($d['sida'] ?? '')), 0, 30);
$skarm = mb_substr(preg_replace('/[^\d×x]/u', '', (string)($d['screen'] ?? '')), 0, 20);
if ($text === '') svara(400, ['ok' => false, 'error' => 'Skriv något först.']);
if (mb_strlen($text) > 5000) svara(400, ['ok' => false, 'error' => 'Texten är för lång (högst 5000 tecken).']);
if ($epost !== '' && !filter_var($epost, FILTER_VALIDATE_EMAIL)) svara(400, ['ok' => false, 'error' => 'E-postadressen ser inte rätt ut.']);

// Högst fem i timmen per avsändare och 30 i timmen från alla tillsammans.
// Räknarna läses och skrivs under samma lås, så att två samtidiga anrop inte
// räknas som ett.
$nu = time();
$nyckel = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|hojdkurvor');
$mapp = sys_get_temp_dir();
$las = @fopen($mapp . '/hojdkurvor-synpunkt.las', 'c');
if ($las) flock($las, LOCK_EX);
$lasTider = function (string $fil) use ($nu): array {
  $ra = is_file($fil) ? (string)@file_get_contents($fil) : '';
  return array_values(array_filter(array_map('intval', explode(',', $ra)), fn($t) => $t > $nu - 3600 && $t <= $nu + 60));
};
$egen = $mapp . '/hojdkurvor-synpunkt-' . substr($nyckel, 0, 32);
$alla = $mapp . '/hojdkurvor-synpunkt-alla';
$tider = $lasTider($egen);
$allaTider = $lasTider($alla);
$full = count($tider) >= MAX_PER_AVSANDARE ? 'Många synpunkter på kort tid. Försök igen om en stund.'
  : (count($allaTider) >= MAX_ALLA ? 'Formuläret har tagit emot många synpunkter den senaste timmen. Försök igen om en stund, eller skicka med e-post.' : null);
if ($full === null) {
  $tider[] = $nu; $allaTider[] = $nu;
  @file_put_contents($egen, implode(',', $tider));
  @file_put_contents($alla, implode(',', $allaTider));
}
if ($las) { flock($las, LOCK_UN); fclose($las); }
if ($full !== null) svara(429, ['ok' => false, 'error' => $full]);

$amne = '=?UTF-8?B?' . base64_encode("Synpunkt på $version") . '?=';
$brod = $text . "\n\n—\nVersion: $version\nSida: $sida\nSkärm: $skarm\n" . ($epost !== '' ? "Svara till: $epost\n" : "Ingen e-post angiven (anonym).\n");
$huvud = [
  'From: =?UTF-8?B?' . base64_encode('Höjdkurvor') . '?= <' . $fran . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 8bit',
];
if ($epost !== '') $huvud[] = 'Reply-To: ' . $epost;

// Kuvertavsändaren (Return-Path) sätts till samma adress som From. Annars
// skickar servern med sin egen adress, och när brevet vidarebefordras (t.ex.
// från webbposten till Gmail) faller SPF/DMARC och brevet slängs.
if (!function_exists('mail') || !@mail($till, $amne, $brod, implode("\r\n", $huvud), '-f' . $fran)) {
  svara(500, ['ok' => false, 'error' => 'Servern kunde inte skicka e-post. Webbhotellet kan kräva att avsändaren (from) är en adress på den egna domänen, eller SMTP.']);
}
svara(200, ['ok' => true]);
