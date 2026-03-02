$ErrorActionPreference = 'Stop'

$base = 'https://web-production-79739.up.railway.app'
$apiKey = 'AIzaSyAET3L93mkCiGtXLW7XVL-wIck4k4rvzdM'
$envPath = 'a:\programing_workspace\catatrack\env.local'

function Get-EnvVarValue {
    param(
        [string]$FilePath,
        [string]$Key
    )

    $line = Select-String -Path $FilePath -Pattern "^$Key=" | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Line.Substring($Key.Length + 1)
}

function ConvertTo-Base64Url {
    param([byte[]]$Bytes)
    $b64 = [Convert]::ToBase64String($Bytes)
    return $b64.TrimEnd('=') -replace '\+', '-' -replace '/', '_'
}

function New-FirebaseCustomToken {
    param(
        [string]$ServiceAccountJson,
        [string]$Uid,
        [hashtable]$Claims
    )

    $svc = $ServiceAccountJson | ConvertFrom-Json
    $headerObj = @{ alg = 'RS256'; typ = 'JWT' }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $payloadObj = @{
        iss    = $svc.client_email
        sub    = $svc.client_email
        aud    = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'
        iat    = $now
        exp    = $now + 3600
        uid    = $Uid
        claims = $Claims
    }

    $headerJson = ($headerObj | ConvertTo-Json -Compress)
    $payloadJson = ($payloadObj | ConvertTo-Json -Compress -Depth 10)

    $headerEncoded = ConvertTo-Base64Url -Bytes ([Text.Encoding]::UTF8.GetBytes($headerJson))
    $payloadEncoded = ConvertTo-Base64Url -Bytes ([Text.Encoding]::UTF8.GetBytes($payloadJson))
    $unsigned = "$headerEncoded.$payloadEncoded"

    $privateKeyPem = $svc.private_key
    $privateKeyB64 = ($privateKeyPem -replace '-----BEGIN PRIVATE KEY-----', '' -replace '-----END PRIVATE KEY-----', '' -replace '\s', '')
    $privateKeyBytes = [Convert]::FromBase64String($privateKeyB64)

    $rsa = [System.Security.Cryptography.RSA]::Create()
    $rsa.ImportPkcs8PrivateKey($privateKeyBytes, [ref]0) | Out-Null

    $signatureBytes = $rsa.SignData(
        [Text.Encoding]::UTF8.GetBytes($unsigned),
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $signatureEncoded = ConvertTo-Base64Url -Bytes $signatureBytes

    return "$unsigned.$signatureEncoded"
}

function Invoke-TestApi {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$ContentType,
        [object]$Body
    )

    $params = @{ Method = $Method; Uri = $Url; Headers = $Headers; SkipHttpErrorCheck = $true; AllowInsecureRedirect = $true }
    if ($PSBoundParameters.ContainsKey('ContentType') -and $ContentType) { $params.ContentType = $ContentType }
    if ($PSBoundParameters.ContainsKey('Body') -and $null -ne $Body) { $params.Body = $Body }

    $resp = Invoke-WebRequest @params
    $parsedBody = $resp.Content
    if ($resp.Content) {
        try { $parsedBody = $resp.Content | ConvertFrom-Json -Depth 20 } catch {}
    }

    return [pscustomobject]@{
        endpoint = $Name
        method   = $Method
        status   = [int]$resp.StatusCode
        body     = $parsedBody
    }
}

$serviceAccountJson = Get-EnvVarValue -FilePath $envPath -Key 'FIREBASE_SERVICE_ACCOUNT_JSON'
if (-not $serviceAccountJson) {
    throw 'No se encontró FIREBASE_SERVICE_ACCOUNT_JSON en env.local'
}

$uid = "superadmin-test-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$claims = @{
    role           = 'super_admin'
    roles          = @('super_admin', 'admin_general')
    is_super_admin = $true
    is_admin       = $true
}

$customToken = New-FirebaseCustomToken -ServiceAccountJson $serviceAccountJson -Uid $uid -Claims $claims
$signInCustomBody = @{ token = $customToken; returnSecureToken = $true } | ConvertTo-Json -Depth 10
$firebaseCustomSignIn = Invoke-RestMethod -Method POST -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$apiKey" -ContentType 'application/json' -Body $signInCustomBody

$idToken = $firebaseCustomSignIn.idToken
$realUid = $firebaseCustomSignIn.localId
$headers = @{ Authorization = "Bearer $idToken" }

$results = New-Object System.Collections.Generic.List[object]

$results.Add((Invoke-TestApi -Name '/auth/login (custom super_admin token)' -Method 'POST' -Url "$base/auth/login" -ContentType 'application/json' -Body (@{ id_token = $idToken } | ConvertTo-Json))) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/validate-session' -Method 'POST' -Url "$base/auth/validate-session" -Headers $headers -ContentType 'application/json' -Body '{}')) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/config' -Method 'GET' -Url "$base/auth/config" -Headers $headers)) | Out-Null

$results.Add((Invoke-TestApi -Name '/admin/users' -Method 'GET' -Url "$base/admin/users" -Headers $headers)) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/admin/users' -Method 'GET' -Url "$base/auth/admin/users?limit=5&offset=0" -Headers $headers)) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/admin/users/super-admins' -Method 'GET' -Url "$base/auth/admin/users/super-admins?limit=5&offset=0" -Headers $headers)) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/admin/users/{uid}' -Method 'GET' -Url "$base/auth/admin/users/$realUid" -Headers $headers)) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/admin/users/{uid} (PUT)' -Method 'PUT' -Url "$base/auth/admin/users/$realUid" -Headers $headers -ContentType 'application/json' -Body (@{ full_name = 'Super Admin Test Updated' } | ConvertTo-Json))) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/admin/users/{uid}/roles' -Method 'POST' -Url "$base/auth/admin/users/$realUid/roles" -Headers $headers -ContentType 'application/json' -Body (@{ roles = @('super_admin') } | ConvertTo-Json))) | Out-Null

$exp = (Get-Date).ToUniversalTime().AddHours(1).ToString('o')
$results.Add((Invoke-TestApi -Name '/auth/admin/users/{uid}/temporary-permissions' -Method 'POST' -Url "$base/auth/admin/users/$realUid/temporary-permissions" -Headers $headers -ContentType 'application/json' -Body (@{ permission = 'users.read'; expires_at = $exp } | ConvertTo-Json))) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/admin/users/{uid}/temporary-permissions/{permission}' -Method 'DELETE' -Url "$base/auth/admin/users/$realUid/temporary-permissions/users.read" -Headers $headers)) | Out-Null

$rolesList = Invoke-TestApi -Name '/auth/admin/roles' -Method 'GET' -Url "$base/auth/admin/roles" -Headers $headers
$results.Add($rolesList) | Out-Null
$roleId = 'admin_general'
if ($rolesList.body -is [array] -and $rolesList.body.Count -gt 0) {
    if ($rolesList.body[0].id) { $roleId = $rolesList.body[0].id }
    elseif ($rolesList.body[0].role_id) { $roleId = $rolesList.body[0].role_id }
    elseif ($rolesList.body[0].name) { $roleId = $rolesList.body[0].name }
}
$results.Add((Invoke-TestApi -Name '/auth/admin/roles/{role_id}' -Method 'GET' -Url "$base/auth/admin/roles/$roleId" -Headers $headers)) | Out-Null

$results.Add((Invoke-TestApi -Name '/auth/admin/audit-logs' -Method 'GET' -Url "$base/auth/admin/audit-logs?limit=5" -Headers $headers)) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/admin/system/stats' -Method 'GET' -Url "$base/auth/admin/system/stats" -Headers $headers)) | Out-Null
$results.Add((Invoke-TestApi -Name '/auth/user/{uid}' -Method 'DELETE' -Url "$base/auth/user/$realUid" -Headers $headers)) | Out-Null

$report = [pscustomobject]@{
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    custom_uid   = $uid
    firebase_uid = $realUid
    token_type   = 'firebase_custom_token_signin'
    results      = $results
}

$report | ConvertTo-Json -Depth 20
