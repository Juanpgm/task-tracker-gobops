$ErrorActionPreference = 'Stop'

$base = 'https://web-production-79739.up.railway.app'
$apiKey = 'AIzaSyAET3L93mkCiGtXLW7XVL-wIck4k4rvzdM'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "prod.flow.$ts@example.com"
$pass = 'CataTrack!2026'

function Invoke-Step {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [string]$ContentType = 'application/json',
        [hashtable]$Headers = @{}
    )

    $params = @{ Method = $Method; Uri = $Url; SkipHttpErrorCheck = $true; Headers = $Headers }
    if ($null -ne $Body) { $params.Body = $Body }
    if ($ContentType) { $params.ContentType = $ContentType }

    $resp = Invoke-WebRequest @params
    $parsed = $resp.Content
    try { $parsed = $resp.Content | ConvertFrom-Json -Depth 20 } catch {}

    return [pscustomobject]@{
        step   = $Name
        status = [int]$resp.StatusCode
        body   = $parsed
    }
}

$registerPayload = @{
    email                = $email
    password             = $pass
    full_name            = 'Prueba Flujo Prod'
    cellphone            = '3000000000'
    nombre_centro_gestor = 'QA'
} | ConvertTo-Json

$r1 = Invoke-Step -Name 'register' -Method 'POST' -Url "$base/auth/register" -Body $registerPayload
$r2 = Invoke-Step -Name 'register_duplicate' -Method 'POST' -Url "$base/auth/register" -Body $registerPayload

$signInPayload = @{ email = $email; password = $pass; returnSecureToken = $true } | ConvertTo-Json
$r3 = Invoke-Step -Name 'firebase_signin' -Method 'POST' -Url "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" -Body $signInPayload

$idToken = $null
if ($r3.body.idToken) { $idToken = $r3.body.idToken }

$r4 = $null
$r5 = $null
if ($idToken) {
    $loginPayload = @{ id_token = $idToken } | ConvertTo-Json
    $r4 = Invoke-Step -Name 'backend_login' -Method 'POST' -Url "$base/auth/login" -Body $loginPayload

    $authHeaders = @{ Authorization = "Bearer $idToken" }
    $r5 = Invoke-Step -Name 'validate_session' -Method 'POST' -Url "$base/auth/validate-session" -Body '{}' -Headers $authHeaders
}

[pscustomobject]@{
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    email        = $email
    results      = @($r1, $r2, $r3, $r4, $r5) | Where-Object { $_ -ne $null }
} | ConvertTo-Json -Depth 20
