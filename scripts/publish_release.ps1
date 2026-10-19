param([Parameter(Mandatory=$true)][string]$Version)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root=Split-Path $PSScriptRoot -Parent
$releaseDir=Join-Path $root "dist/mini-games-v$Version"
$commit=git -c "safe.directory=$($root.Replace('\','/'))" -C $root rev-parse HEAD
if($LASTEXITCODE -ne 0){throw 'Cannot identify release commit'}
$credentialLines="protocol=https`nhost=github.com`n`n" | git credential fill
$passwordLine=$credentialLines | Where-Object { $_ -like 'password=*' } | Select-Object -First 1
if(!$passwordLine){throw 'GitHub authentication is unavailable'}
$headers=@{Authorization="Bearer $($passwordLine.Substring(9))";'User-Agent'='mini-games-release';Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28'}
$api='https://api.github.com/repos/HenryChen27/mini_games/releases'
$body=[IO.File]::ReadAllText((Join-Path $releaseDir 'release-notes.md'),[Text.Encoding]::UTF8)
$payload=@{tag_name="mini-games-v$Version";target_commitish=$commit;name="小游戏合集 $Version";body=$body;draft=$true;prerelease=$false}|ConvertTo-Json
$release=Invoke-RestMethod -Method Post -Uri $api -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
# Keep the release private until every downloadable asset has uploaded.
$assets=Get-ChildItem -LiteralPath $releaseDir -File | Where-Object { $_.Name -ne 'release-notes.md' }
foreach($asset in $assets){
  $upload=($release.upload_url -replace '\{.*$','')+'?name='+[Uri]::EscapeDataString($asset.Name)
  $uploaded=Invoke-RestMethod -Method Post -Uri $upload -Headers $headers -ContentType 'application/octet-stream' -Body ([IO.File]::ReadAllBytes($asset.FullName))
  if($uploaded.size -ne $asset.Length){throw "Upload size mismatch: $($asset.Name)"}
}
$published=Invoke-RestMethod -Method Patch -Uri "$api/$($release.id)" -Headers $headers -ContentType 'application/json' -Body '{"draft":false,"make_latest":"true"}'
Write-Output $published.html_url
