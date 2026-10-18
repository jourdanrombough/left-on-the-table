<?php
// Copy to ltt-config.php (same folder as api.php) only if your keys are NOT already defined
// as DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD constants (wp-config.php) or environment variables.
// access_password is only used outside WordPress; on WordPress, live scans require an admin login.
return [
    'login' => 'you@example.com',
    'password' => 'your-dataforseo-api-password',
    'access_password' => 'choose-a-password',
];
