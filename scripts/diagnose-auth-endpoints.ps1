$ErrorActionPreference = 'Stop'

$base = 'https://web-production-79739.up.railway.app'
$apiKey = 'AIzaSyAET3L93mkCiGtXLW7XVL-wIck4k4rvzdM'
$email = 'catatrack.test.1772464135@example.com'
$pass = 'CataTrack!2026#New'

$signInBody = @{ email = $email; password = $pass; returnSecureToken = $true } | ConvertTo-Json
$signin = Invoke-RestMethod -Method POST -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" -ContentType 'application/json' -Body $signInBody
$headers = @{ Authorization = "Bearer $($signin.idToken)" }

$targets = @(
    '/auth/config',
    '/admin/users',
    '/auth/admin/users?limit=5&offset=0'
)

foreach ($target in $targets) {
    $resp = Invoke-WebRequest -Method GET -Uri ($base + $target) -Headers $headers -SkipHttpErrorCheck
    Write-Output "=== $target ==="
    Write-Output "status=$($resp.StatusCode)"
    if ($resp.Content) {
        Write-Output $resp.Content
    }
    else {
        Write-Output '<empty>'
    }
}
