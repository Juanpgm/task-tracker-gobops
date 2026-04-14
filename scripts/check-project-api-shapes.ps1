$ErrorActionPreference = 'Stop'
$base = 'https://gestorproyectoapi-production.up.railway.app'

function Show-Endpoint {
    param([string]$Path)
    $resp = Invoke-WebRequest -Method GET -Uri "$base$Path" -SkipHttpErrorCheck
    Write-Output "$Path => $($resp.StatusCode)"
    $text = $resp.Content
    if ($text.Length -gt 800) { $text = $text.Substring(0, 800) }
    Write-Output $text
    Write-Output ""
}

Show-Endpoint '/unidades-proyecto'
Show-Endpoint '/intervenciones'
Show-Endpoint '/unidades-proyecto/init-360'
