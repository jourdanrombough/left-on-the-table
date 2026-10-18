<?php
/**
 * Left on the Table: PHP backend for hosting the scanner on your own site (WordPress or any PHP host).
 *
 * Upload this folder (index.html, app.js, api.php, examples/, icons, manifest.json) to e.g. /left-on-the-table/.
 * Visitors can replay the example scans. Live scans run only for you:
 *   - On WordPress: you must be logged in as an administrator.
 *   - Elsewhere: set LTT_PASSWORD below (or in ltt-config.php) and the browser asks for it once.
 *
 * DataForSEO credentials are read server-side and never sent to the browser, from the first of:
 *   1. PHP constants DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD (e.g. defined in wp-config.php)
 *   2. Environment variables DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD
 *   3. ltt-config.php in this folder:  <?php return ['login' => '...', 'password' => '...', 'access_password' => '...'];
 */

const LTT_ALLOWED = [
    'dataforseo_labs/google/domain_rank_overview/live',
    'dataforseo_labs/google/ranked_keywords/live',
    'dataforseo_labs/google/keywords_for_site/live',
    'dataforseo_labs/google/related_keywords/live',
    'dataforseo_labs/google/keyword_suggestions/live',
    'dataforseo_labs/google/serp_competitors/live',
    'keywords_data/google_ads/search_volume/live',
    'serp/google/organic/live/advanced',
    'ai_optimization/claude/llm_responses/live',
    'ai_optimization/chat_gpt/llm_responses/live',
];
const LTT_CACHE_DAYS = 7;

$cfg = file_exists(__DIR__ . '/ltt-config.php') ? (include __DIR__ . '/ltt-config.php') : [];
if (!is_array($cfg)) $cfg = [];

// ---- WordPress (optional): find wp-load.php in this folder or above
$wp = false;
foreach (['/wp-load.php', '/../wp-load.php', '/../../wp-load.php', '/../../../wp-load.php'] as $rel) {
    if (file_exists(__DIR__ . $rel)) { define('WP_USE_THEMES', false); require_once __DIR__ . $rel; $wp = true; break; }
}

function ltt_json($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode($data);
    exit;
}

function ltt_creds($cfg) {
    $login = defined('DATAFORSEO_LOGIN') ? DATAFORSEO_LOGIN : (getenv('DATAFORSEO_LOGIN') ?: ($cfg['login'] ?? ''));
    $pass  = defined('DATAFORSEO_PASSWORD') ? DATAFORSEO_PASSWORD : (getenv('DATAFORSEO_PASSWORD') ?: ($cfg['password'] ?? ''));
    return ($login && $pass) ? [$login, $pass] : null;
}

function ltt_authorized($wp, $cfg) {
    if ($wp && function_exists('current_user_can')) return is_user_logged_in() && current_user_can('manage_options');
    $pw = $cfg['access_password'] ?? (defined('LTT_PASSWORD') ? LTT_PASSWORD : '');
    if (!$pw) return false;
    return isset($_SERVER['PHP_AUTH_PW']) && hash_equals($pw, $_SERVER['PHP_AUTH_PW']);
}

function ltt_dfs($creds, $endpoint, $task = null) {
    $ch = curl_init('https://api.dataforseo.com/v3/' . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 180,
        CURLOPT_USERPWD => $creds[0] . ':' . $creds[1],
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    ]);
    if ($task !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([$task])); }
    $body = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) return ['status_code' => 0, 'status_message' => $err, 'cost' => 0, 'result' => null];
    $j = json_decode($body, true);
    $t = $j['tasks'][0] ?? [];
    return ['status_code' => $t['status_code'] ?? ($j['status_code'] ?? 0), 'status_message' => $t['status_message'] ?? ($j['status_message'] ?? ''),
            'cost' => $t['cost'] ?? 0, 'result' => $t['result'] ?? null];
}

$dataDir = __DIR__ . '/ltt-data';
if (!is_dir($dataDir)) { @mkdir($dataDir . '/cache', 0750, true); @mkdir($dataDir . '/scans', 0750, true); }
if (!file_exists($dataDir . '/.htaccess')) @file_put_contents($dataDir . '/.htaccess', "Require all denied\nDeny from all\n");

$a = $_GET['a'] ?? '';
$creds = ltt_creds($cfg);
$ok = ltt_authorized($wp, $cfg);

if ($a === 'health') {
    if ($ok && $creds) ltt_json(['ok' => true, 'mode' => 'local', 'host' => $wp ? 'wordpress' : 'php']);
    $out = ['ok' => true, 'mode' => 'demo'];
    if ($wp && function_exists('wp_login_url')) $out['login'] = wp_login_url($_SERVER['HTTP_REFERER'] ?? home_url('/'));
    elseif (!$wp && ($cfg['access_password'] ?? (defined('LTT_PASSWORD') ? LTT_PASSWORD : ''))) $out['login'] = 'api.php?a=login';
    if (!$creds) $out['note'] = 'no DataForSEO credentials configured';
    ltt_json($out);
}

if ($a === 'login') {
    if (!$ok) { header('WWW-Authenticate: Basic realm="Left on the Table"'); ltt_json(['status_message' => 'Password required'], 401); }
    header('Location: ./'); exit;
}

if (!$ok) {
    if (!$wp) { header('WWW-Authenticate: Basic realm="Left on the Table"'); }
    ltt_json(['status_code' => 401, 'status_message' => 'Log in to run live scans'], 401);
}
if (!$creds) ltt_json(['status_code' => 500, 'status_message' => 'No DataForSEO credentials configured on the server'], 500);

if ($a === 'balance') {
    $r = ltt_dfs($creds, 'appendix/user_data');
    ltt_json(['balance' => $r['result'][0]['money']['balance'] ?? null]);
}

if ($a === 'dfs') {
    $req = json_decode(file_get_contents('php://input'), true) ?: [];
    $ep = $req['endpoint'] ?? '';
    $task = $req['task'] ?? [];
    if (!in_array($ep, LTT_ALLOWED, true)) ltt_json(['status_code' => 403, 'status_message' => 'Endpoint not allowed: ' . $ep], 403);
    $key = sha1($ep . json_encode($task));
    $path = $dataDir . '/cache/' . $key . '.json';
    if (empty($req['fresh']) && file_exists($path) && time() - filemtime($path) < LTT_CACHE_DAYS * 86400) {
        $r = json_decode(file_get_contents($path), true);
        $r['cached'] = true; $r['cost'] = 0;
        ltt_json($r);
    }
    $t0 = microtime(true);
    $r = ltt_dfs($creds, $ep, $task);
    $r['seconds'] = round(microtime(true) - $t0, 2);
    if (($r['status_code'] ?? 0) == 20000) @file_put_contents($path, json_encode($r));
    ltt_json($r);
}

if ($a === 'scans') {
    $out = [];
    foreach (array_reverse(glob($dataDir . '/scans/*.json') ?: []) as $f) {
        $d = json_decode(file_get_contents($f), true);
        if (!$d) continue;
        $out[] = ['file' => 'scans/' . basename($f), 'domain' => $d['domain'] ?? '', 'keyword' => $d['keyword'] ?? '',
                  'location' => $d['location']['label'] ?? '', 'date' => $d['date'] ?? '', 'headline' => $d['headline'] ?? ''];
        if (count($out) >= 40) break;
    }
    ltt_json($out);
}

if ($a === 'scan') {
    $f = basename($_GET['f'] ?? '');
    $path = $dataDir . '/scans/' . $f;
    if (!$f || !file_exists($path)) ltt_json(['error' => 'not found'], 404);
    header('Content-Type: application/json'); readfile($path); exit;
}

if ($a === 'save') {
    $raw = file_get_contents('php://input');
    $d = json_decode($raw, true);
    if (!$d) ltt_json(['error' => 'bad scan'], 400);
    $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(($d['domain'] ?? 'scan') . '-' . ($d['keyword'] ?: 'site') . '-' . ($d['location']['label'] ?? ''))), '-');
    $name = date('Ymd-Hi') . '-' . substr($slug, 0, 80) . '.json';
    file_put_contents($dataDir . '/scans/' . $name, $raw);
    ltt_json(['file' => 'scans/' . $name]);
}

ltt_json(['error' => 'unknown action'], 404);
