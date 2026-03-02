$ErrorActionPreference = 'Stop'

$base = 'https://web-production-79739.up.railway.app'
$apiKey = 'AIzaSyAET3L93mkCiGtXLW7XVL-wIck4k4rvzdM'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "registro.test.$ts@example.com"
$pass = 'CataTrack!2026'
$payload = @{ email = $email; password = $pass; full_name = 'Prueba Registro'; cellphone = '3000000000'; nombre_centro_gestor = 'QA' } | ConvertTo-Json

function Call-Endpoint {
    param(
        [string]$Step,
        [string]$Method,
        [string]$Url,
        [string]$ContentType,
        [string]$Body
    )

    $params = @{ Method = $Method; Uri = $Url; SkipHttpErrorCheck = $true }
    if ($ContentType) { $params.ContentType = $ContentType }
    if ($Body) { $params.Body = $Body }

    $resp = Invoke-WebRequest @params
    $parsed = $resp.Content
    try { $parsed = $resp.Content | ConvertFrom-Json -Depth 20 } catch {}

    return [pscustomobject]@{
        step   = $Step
        status = [int]$resp.StatusCode
        body   = $parsed
    }
}

$r1 = Call-Endpoint -Step 'register_first_try' -Method 'POST' -Url "$base/auth/register" -ContentType 'application/json' -Body $payload
$r2 = Call-Endpoint -Step 'register_duplicate_try' -Method 'POST' -Url "$base/auth/register" -ContentType 'application/json' -Body $payload

$signInPayload = @{ email = $email; password = $pass; returnSecureToken = $true } | ConvertTo-Json
$r3 = Call-Endpoint -Step 'firebase_signin_after_register' -Method 'POST' -Url "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" -ContentType 'application/json' -Body $signInPayload

[pscustomobject]@{
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    email        = $email
    results      = @($r1, $r2, $r3)
} | ConvertTo-Json -Depth 20
