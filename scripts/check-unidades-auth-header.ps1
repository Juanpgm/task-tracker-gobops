$ErrorActionPreference = 'Stop'

function Show($label, $resp) {
    Write-Output "$label => $($resp.StatusCode)"
}

$url = 'https://task-tracker-beta-pied.vercel.app/api/project/unidades-proyecto'
$resp1 = Invoke-WebRequest -Method GET -Uri $url -SkipHttpErrorCheck
Show 'sin auth' $resp1

$resp2 = Invoke-WebRequest -Method GET -Uri $url -Headers @{ Authorization = 'Bearer test-token' } -SkipHttpErrorCheck
Show 'con auth fake' $resp2

$url2 = 'https://task-tracker-beta-pied.vercel.app/api/project/unidades-proyecto/init-360'
$resp3 = Invoke-WebRequest -Method GET -Uri $url2 -Headers @{ Authorization = 'Bearer test-token' } -SkipHttpErrorCheck
Show 'init-360 con auth fake' $resp3
