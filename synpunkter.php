<?php
/*
 * Tar emot synpunkter från formuläret Skicka synpunkter och mejlar dem vidare
 * (höjdkurvor.se 0.7.0). Samma upplägg som feedback.php i cad-apa.
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
 * per avsändare och en gräns för längden. Inga personuppgifter sparas;
 * spärren använder en hash av adressen och glöms efter en timme.
 */

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

// Högst fem i timmen per avsändare.
$nyckel = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|hojdkurvor');
$lager = sys_get_temp_dir() . '/hojdkurvor-synpunkt-' . substr($nyckel, 0, 32);
$nu = time();
$tider = is_file($lager) ? array_filter(array_map('intval', explode(',', (string)file_get_contents($lager))), fn($t) => $t > $nu - 3600) : [];
if (count($tider) >= 5) svara(429, ['ok' => false, 'error' => 'Många synpunkter på kort tid. Försök igen om en stund.']);
$tider[] = $nu;
@file_put_contents($lager, implode(',', $tider), LOCK_EX);

$amne = '=?UTF-8?B?' . base64_encode("Synpunkt på $version") . '?=';
$brod = $text . "\n\n—\nVersion: $version\nSida: $sida\nSkärm: $skarm\n" . ($epost !== '' ? "Svara till: $epost\n" : "Ingen e-post angiven (anonym).\n");
$huvud = [
  'From: =?UTF-8?B?' . base64_encode('höjdkurvor.se') . '?= <' . $fran . '>',
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
