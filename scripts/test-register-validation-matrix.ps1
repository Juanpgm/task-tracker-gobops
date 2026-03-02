$ErrorActionPreference = 'Stop'

$base = 'https://web-production-79739.up.railway.app'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function Invoke-RegisterCase {
    param(
        [string]$Name,
        [object]$Payload,
        [string]$RawBody,
        [string]$ContentType = 'application/json'
    )

    $bodyToSend = $RawBody
    if (-not $PSBoundParameters.ContainsKey('RawBody')) {
        if ($null -eq $Payload) {
            $bodyToSend = ''
        }
        else {
            $bodyToSend = $Payload | ConvertTo-Json -Depth 20
        }
    }

    $resp = Invoke-WebRequest -Method POST -Uri "$base/auth/register" -ContentType $ContentType -Body $bodyToSend -SkipHttpErrorCheck
    $parsed = $resp.Content
    try { $parsed = $resp.Content | ConvertFrom-Json -Depth 20 } catch {}

    return [pscustomobject]@{
        case   = $Name
        status = [int]$resp.StatusCode
        body   = $parsed
    }
}

$cases = @()

# Control válido
$cases += Invoke-RegisterCase -Name 'valid_control' -Payload @{
    email                = "registro.matrix.$ts@example.com"
    password             = 'CataTrack!2026'
    full_name            = 'Matriz Registro'
    cellphone            = '3000000000'
    nombre_centro_gestor = 'QA'
}

# Email inválido
$cases += Invoke-RegisterCase -Name 'invalid_email_format' -Payload @{
    email                = 'correo-invalido'
    password             = 'CataTrack!2026'
    full_name            = 'Email Invalido'
    cellphone            = '3000000000'
    nombre_centro_gestor = 'QA'
}

# Password débil
$cases += Invoke-RegisterCase -Name 'weak_password' -Payload @{
    email                = "registro.weak.$ts@example.com"
    password             = '123'
    full_name            = 'Password Debil'
    cellphone            = '3000000000'
    nombre_centro_gestor = 'QA'
}

# Falta email
$cases += Invoke-RegisterCase -Name 'missing_email' -Payload @{
    password             = 'CataTrack!2026'
    full_name            = 'Sin Email'
    cellphone            = '3000000000'
    nombre_centro_gestor = 'QA'
}

# Falta password
$cases += Invoke-RegisterCase -Name 'missing_password' -Payload @{
    email                = "registro.nopass.$ts@example.com"
    full_name            = 'Sin Password'
    cellphone            = '3000000000'
    nombre_centro_gestor = 'QA'
}

# Falta full_name
$cases += Invoke-RegisterCase -Name 'missing_full_name' -Payload @{
    email                = "registro.noname.$ts@example.com"
    password             = 'CataTrack!2026'
    cellphone            = '3000000000'
    nombre_centro_gestor = 'QA'
}

# Body vacío
$cases += Invoke-RegisterCase -Name 'empty_json_body' -RawBody '' -ContentType 'application/json'

# JSON malformado
$cases += Invoke-RegisterCase -Name 'malformed_json' -RawBody '{"email":"x@example.com", "password":' -ContentType 'application/json'

[pscustomobject]@{
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    endpoint     = '/auth/register'
    total_cases  = $cases.Count
    results      = $cases
} | ConvertTo-Json -Depth 20
