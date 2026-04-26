<?php
// telegram-send.php — Server-side Telegram relay (token never exposed to client)
//
// Usage: POST /api/telegram-send.php with JSON body:
//   { "type": "TX", "text": "message content here" }
//
// Security notes:
//   - Bot token and chat ID live only on the server file system.
//   - No rate limiting implemented here; add fail2ban / nginx limit_req if needed.

header('Content-Type: application/json; charset=utf-8');

// ── Load secrets from the private config file ─────────────────────────────────
$configFile = __DIR__ . '/../config/telegram-secrets.php';

if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server misconfiguration: secrets file not found.']);
    exit;
}

$secrets = require $configFile;
$BOT_TOKEN = $secrets['bot_token']   ?? '';
$CHAT_ID   = $secrets['chat_id']    ?? '';

// ── Validate request method ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST only.']);
    exit;
}

// ── Parse JSON body ────────────────────────────────────────────────────────────
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || empty($body['text'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing or empty "text" field.']);
    exit;
}

$text = trim($body['text']);
if (strlen($text) > 4096) {
    $text = mb_substr($text, 0, 4096);
}

// ── Forward to Telegram Bot API ───────────────────────────────────────────────
$url = "https://api.telegram.org/bot{$BOT_TOKEN}/sendMessage";
$payload = json_encode([
    'chat_id' => $CHAT_ID,
    'text'    => $text,
    'parse_mode' => 'Markdown',
]);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

// ── Respond to client ─────────────────────────────────────────────────────────
if ($curlErr) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => "cURL error: {$curlErr}"]);
    exit;
}

$result = json_decode($response, true);
if ($httpCode === 200 && ($result['ok'] ?? false)) {
    echo json_encode(['ok' => true]);
} else {
    $desc = $result['description'] ?? 'Unknown error';
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => "Telegram API error: {$desc}"]);
}
