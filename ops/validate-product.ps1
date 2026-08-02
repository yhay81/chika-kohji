[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Required = @(
  "README.md", "SOURCE.md", "PRIVACY.md", "SECURITY.md", "STACK.md", "DECISIONS.md", "EXPERIMENT.md", "LICENSE",
  "src/worker.tsx", "public/app.js", "public/styles.css", "public/data/index.json", "migrations/0001_telemetry.sql"
)
foreach ($Relative in $Required) {
  $Target = Join-Path $RepoRoot $Relative
  if (-not (Test-Path -LiteralPath $Target -PathType Leaf)) { throw "Missing required file: $Relative" }
}
$Index = Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "public/data/index.json") | ConvertFrom-Json
if ($Index.year -ne 2026 -or $Index.total -ne 25565 -or $Index.prefectures.Count -ne 47) { throw "Unexpected data index dimensions" }
$PointTotal = 0
$MaxBytes = 0
foreach ($Prefecture in $Index.prefectures) {
  $DataPath = Join-Path $RepoRoot ("public/data/pref/{0}.json" -f $Prefecture.code)
  if (-not (Test-Path -LiteralPath $DataPath -PathType Leaf)) { throw "Missing prefecture data: $($Prefecture.code)" }
  $File = Get-Item -LiteralPath $DataPath
  if ($File.Length -gt 1200000) { throw "Prefecture file exceeds delivery budget: $($Prefecture.code)" }
  $MaxBytes = [Math]::Max($MaxBytes, $File.Length)
  $Data = Get-Content -Raw -LiteralPath $DataPath | ConvertFrom-Json
  if ($Data.items.Count -ne $Prefecture.count) { throw "Prefecture count mismatch: $($Prefecture.code)" }
  $PointTotal += $Data.items.Count
}
if ($PointTotal -ne 25565) { throw "Point total mismatch" }
$Surface = (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "src/worker.tsx")) + (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "public/app.js"))
if ($Surface -match "public validation|success criteria|市場スコア|移行候補|収益性") { throw "Internal evaluation language leaked into product surface" }
$Css = Get-Content -Raw -LiteralPath (Join-Path $RepoRoot "public/styles.css")
if ($Css -match "gradient") { throw "Gradient styling is not allowed" }
$KeyFiles = @(Get-ChildItem -LiteralPath (Join-Path $RepoRoot "public") -File | Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" })
if ($KeyFiles.Count -ne 1 -or (Get-Content -Raw -LiteralPath $KeyFiles[0]).Trim() -ne $KeyFiles[0].BaseName) { throw "Invalid IndexNow key file" }
[ordered]@{ ok=$true; prefectures=$Index.prefectures.Count; points=$PointTotal; largest_prefecture_bytes=$MaxBytes; indexnow_key=$KeyFiles[0].BaseName } | ConvertTo-Json
