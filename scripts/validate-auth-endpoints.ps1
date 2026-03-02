$ErrorActionPreference = 'Stop'

$base = 'https://web-production-79739.up.railway.app'
$apiKey = 'AIzaSyAET3L93mkCiGtXLW7XVL-wIck4k4rvzdM'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "catatrack.test.$ts@example.com"
$pass = 'CataTrack!2026'
$newPass = 'CataTrack!2026#New'
$fullName = 'Usuario Prueba API'
$cell = '3000000000'
$centro = 'Pruebas QA'

$results = New-Object System.Collections.Generic.List[object]

function Invoke-TestApi {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$ContentType,
        [object]$Body
    )

    try {
        $params = @{ Method = $Method; Uri = $Url; Headers = $Headers; UseBasicParsing = $true }
        if ($PSBoundParameters.ContainsKey('ContentType') -and $ContentType) { $params.ContentType = $ContentType }
        if ($PSBoundParameters.ContainsKey('Body') -and $null -ne $Body) { $params.Body = $Body }

        $resp = Invoke-WebRequest @params
        $bodyText = $resp.Content
        $parsedBody = $bodyText
        if ($bodyText) {
            try { $parsedBody = $bodyText | ConvertFrom-Json -Depth 20 } catch {}
        }

        $results.Add([pscustomobject]@{
                endpoint = $Name
                method   = $Method
                url      = $Url
                status   = [int]$resp.StatusCode
                ok       = $true
                body     = $parsedBody
            }) | Out-Null

        return [pscustomobject]@{ status = [int]$resp.StatusCode; body = $parsedBody }
    }
    catch {
        $status = 0
        $errBody = $_.Exception.Message

        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
            try {
                $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errBody = $sr.ReadToEnd()
            }
            catch {}
        }

        $parsedErr = $errBody
        if ($errBody) {
            try { $parsedErr = $errBody | ConvertFrom-Json -Depth 20 } catch {}
        }

        $results.Add([pscustomobject]@{
                endpoint = $Name
                method   = $Method
                url      = $Url
                status   = $status
                ok       = $false
                body     = $parsedErr
            }) | Out-Null

        return [pscustomobject]@{ status = $status; body = $parsedErr }
    }
}

# Public endpoints
Invoke-TestApi -Name '/auth/register/health-check' -Method 'GET' -Url "$base/auth/register/health-check" | Out-Null
Invoke-TestApi -Name '/auth/config' -Method 'GET' -Url "$base/auth/config" | Out-Null

$registerBody = @{ email = $email; password = $pass; full_name = $fullName; cellphone = $cell; nombre_centro_gestor = $centro } | ConvertTo-Json
Invoke-TestApi -Name '/auth/register' -Method 'POST' -Url "$base/auth/register" -ContentType 'application/json' -Body $registerBody | Out-Null

# Firebase token for authenticated tests
$signInPayload = @{ email = $email; password = $pass; returnSecureToken = $true } | ConvertTo-Json
$firebaseResp = Invoke-TestApi -Name 'Firebase signInWithPassword' -Method 'POST' -Url "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" -ContentType 'application/json' -Body $signInPayload
$idToken = $firebaseResp.body.idToken
$uid = $firebaseResp.body.localId

if ($idToken) {
    $authHeaders = @{ Authorization = "Bearer $idToken" }

    $loginBody = @{ id_token = $idToken } | ConvertTo-Json
    Invoke-TestApi -Name '/auth/login' -Method 'POST' -Url "$base/auth/login" -ContentType 'application/json' -Body $loginBody | Out-Null
    Invoke-TestApi -Name '/auth/validate-session' -Method 'POST' -Url "$base/auth/validate-session" -Headers $authHeaders -ContentType 'application/json' -Body '{}' | Out-Null

    $changeBody = "uid=$uid&new_password=$newPass"
    Invoke-TestApi -Name '/auth/change-password' -Method 'POST' -Url "$base/auth/change-password" -Headers $authHeaders -ContentType 'application/x-www-form-urlencoded' -Body $changeBody | Out-Null

    $googleBody = "google_token=$idToken"
    Invoke-TestApi -Name '/auth/google' -Method 'POST' -Url "$base/auth/google" -ContentType 'application/x-www-form-urlencoded' -Body $googleBody | Out-Null

    Invoke-TestApi -Name '/auth/workload-identity/status' -Method 'GET' -Url "$base/auth/workload-identity/status" -Headers $authHeaders | Out-Null

    # Endpoints requiring admin roles
    Invoke-TestApi -Name '/auth/user/{uid}' -Method 'DELETE' -Url "$base/auth/user/$uid" -Headers $authHeaders | Out-Null
    Invoke-TestApi -Name '/admin/users' -Method 'GET' -Url "$base/admin/users" -Headers $authHeaders | Out-Null
    Invoke-TestApi -Name '/auth/admin/users' -Method 'GET' -Url "$base/auth/admin/users?limit=5&offset=0" -Headers $authHeaders | Out-Null
    Invoke-TestApi -Name '/auth/admin/users/super-admins' -Method 'GET' -Url "$base/auth/admin/users/super-admins?limit=5&offset=0" -Headers $authHeaders | Out-Null
    Invoke-TestApi -Name '/auth/admin/users/{uid}' -Method 'GET' -Url "$base/auth/admin/users/$uid" -Headers $authHeaders | Out-Null

    $updBody = @{ full_name = 'Usuario Prueba API Updated' } | ConvertTo-Json
    Invoke-TestApi -Name '/auth/admin/users/{uid} (PUT)' -Method 'PUT' -Url "$base/auth/admin/users/$uid" -Headers $authHeaders -ContentType 'application/json' -Body $updBody | Out-Null

    $rolesBody = @{ roles = @('operativo') } | ConvertTo-Json
    Invoke-TestApi -Name '/auth/admin/users/{uid}/roles' -Method 'POST' -Url "$base/auth/admin/users/$uid/roles" -Headers $authHeaders -ContentType 'application/json' -Body $rolesBody | Out-Null

    $exp = (Get-Date).ToUniversalTime().AddHours(1).ToString('o')
    $tempPermBody = @{ permission = 'users.read'; expires_at = $exp } | ConvertTo-Json
    Invoke-TestApi -Name '/auth/admin/users/{uid}/temporary-permissions' -Method 'POST' -Url "$base/auth/admin/users/$uid/temporary-permissions" -Headers $authHeaders -ContentType 'application/json' -Body $tempPermBody | Out-Null
    Invoke-TestApi -Name '/auth/admin/users/{uid}/temporary-permissions/{permission}' -Method 'DELETE' -Url "$base/auth/admin/users/$uid/temporary-permissions/users.read" -Headers $authHeaders | Out-Null

    $rolesList = Invoke-TestApi -Name '/auth/admin/roles' -Method 'GET' -Url "$base/auth/admin/roles" -Headers $authHeaders
    $roleId = $null
    if ($rolesList.body -is [System.Array] -and $rolesList.body.Count -gt 0) {
        if ($rolesList.body[0].id) { $roleId = $rolesList.body[0].id }
        elseif ($rolesList.body[0].role_id) { $roleId = $rolesList.body[0].role_id }
        elseif ($rolesList.body[0].name) { $roleId = $rolesList.body[0].name }
    }
    if (-not $roleId) { $roleId = 'admin_general' }

    Invoke-TestApi -Name '/auth/admin/roles/{role_id}' -Method 'GET' -Url "$base/auth/admin/roles/$roleId" -Headers $authHeaders | Out-Null
    Invoke-TestApi -Name '/auth/admin/audit-logs' -Method 'GET' -Url "$base/auth/admin/audit-logs?limit=5" -Headers $authHeaders | Out-Null
    Invoke-TestApi -Name '/auth/admin/system/stats' -Method 'GET' -Url "$base/auth/admin/system/stats" -Headers $authHeaders | Out-Null
}

$report = [pscustomobject]@{
    generated_at    = (Get-Date).ToUniversalTime().ToString('o')
    test_user_email = $email
    test_user_uid   = $uid
    has_token       = [bool]$idToken
    results         = $results
}

$report | ConvertTo-Json -Depth 20
