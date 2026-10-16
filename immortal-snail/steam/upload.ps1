<#
.SYNOPSIS
  Upload Snailmate Chess to Steam with SteamCMD (Windows PowerShell 5.1 or PowerShell 7).

.DESCRIPTION
  Same as upload.sh. Set these first (in the same PowerShell window):

    $env:STEAM_USER  = "your_steamworks_account"   # the password is typed into SteamCMD
    $env:APP_ID      = "1234560"
    $env:DEPOT_WIN   = "1234561"
    $env:DEPOT_LINUX = "1234562"
    $env:SET_LIVE    = "beta"                      # optional: beta branch to set live
    $env:STEAMCMD    = "C:\steamcmd\steamcmd.exe"  # optional if steamcmd.exe is on PATH

  then:  .\upload.ps1 -DryRun     (check everything, print the build scripts)
         .\upload.ps1             (upload)

  Windows does not record Linux executable bits. Use -WindowsOnly here and upload the Linux
  depot from Linux, macOS or WSL with upload.sh, or the Linux build may not start for players.

.PARAMETER DryRun
  Check everything and print the generated scripts; upload nothing.
.PARAMETER Preview
  SteamPipe preview build: SteamCMD checks the files and writes logs, nothing is uploaded.
.PARAMETER WindowsOnly
  Build only the Windows depot.
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$Preview,
  [switch]$WindowsOnly
)
$ErrorActionPreference = 'Stop'

# The game's executables (see ..\desktop\electron-builder.yml and upload.sh).
$WinExe = 'SnailmateChess.exe'
$LinuxExe = 'snailmate-chess'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$templates = Join-Path $here 'scripts'
$content = Join-Path $here 'content'
$out = Join-Path $here 'output'
$problems = New-Object System.Collections.Generic.List[string]

# ---- settings -----------------------------------------------------------------------------
Write-Host 'Checking settings...'
$required = @('STEAM_USER', 'APP_ID', 'DEPOT_WIN')
if (-not $WindowsOnly) { $required += 'DEPOT_LINUX' }
$cfg = @{}
foreach ($name in @('STEAM_USER', 'APP_ID', 'DEPOT_WIN', 'DEPOT_LINUX', 'SET_LIVE', 'BUILD_DESC', 'STEAMCMD')) {
  $cfg[$name] = [Environment]::GetEnvironmentVariable($name)
}
foreach ($name in $required) {
  if ([string]::IsNullOrWhiteSpace($cfg[$name])) { $problems.Add("$name is not set") }
}
foreach ($name in @('APP_ID', 'DEPOT_WIN', 'DEPOT_LINUX')) {
  if ($cfg[$name] -and $cfg[$name] -notmatch '^\d+$') { $problems.Add("$name must be a number (got `"$($cfg[$name])`")") }
}
if (-not $WindowsOnly -and $cfg.DEPOT_WIN -and $cfg.DEPOT_WIN -eq $cfg.DEPOT_LINUX) { $problems.Add('DEPOT_WIN and DEPOT_LINUX must be different depots') }
$setLive = "$($cfg.SET_LIVE)"
if ($setLive -and $setLive -notmatch '^[A-Za-z0-9_.-]+$') { $problems.Add('SET_LIVE must be a branch name (letters, digits, - _ .)') }
if ($setLive -in @('default', 'public')) { $problems.Add('SET_LIVE cannot be the default branch: set that live in Steamworks (App Admin > SteamPipe > Builds)') }

# ---- content --------------------------------------------------------------------------------
Write-Host "Checking content in $content ..."
$win = Join-Path $content 'windows'
$lin = Join-Path $content 'linux'
$need = @((Join-Path $win $WinExe), (Join-Path $win 'resources\app.asar'))
if (-not $WindowsOnly) {
  $need += @((Join-Path $lin $LinuxExe), (Join-Path $lin "$LinuxExe.bin"), (Join-Path $lin 'resources\app.asar'))
}
foreach ($file in $need) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { $problems.Add("missing $file (unzip the builds into steam\content\windows and steam\content\linux)") }
}

if ($problems.Count -gt 0) {
  foreach ($p in $problems) { Write-Host "  x $p" -ForegroundColor Red }
  Write-Error "upload.ps1: $($problems.Count) problem(s); nothing was uploaded."
}

# ---- build scripts ------------------------------------------------------------------------------
$version = '?'
$product = 'Snailmate Chess'
try {
  $pkg = Get-Content -Raw (Join-Path $here '..\desktop\package.json') | ConvertFrom-Json
  if ($pkg.version) { $version = $pkg.version }
  if ($pkg.productName) { $product = $pkg.productName }
} catch { }
$desc = if ($cfg.BUILD_DESC) { $cfg.BUILD_DESC } else { "$product $version $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'))" }
$desc = $desc.Replace('"', "'").Replace('\', '/')
$values = @{
  'APP_ID'      = $cfg.APP_ID
  'DEPOT_WIN'   = $cfg.DEPOT_WIN
  'DEPOT_LINUX' = $cfg.DEPOT_LINUX
  'BUILD_DESC'  = $desc
  'PREVIEW'     = $(if ($Preview) { '1' } else { '0' })
  'SET_LIVE'    = $setLive
}

function Render([string]$template) {
  $lines = Get-Content -LiteralPath (Join-Path $templates $template)
  if (-not $setLive) { $lines = $lines | Where-Object { $_ -notmatch '"SetLive"' } }
  if ($WindowsOnly) { $lines = $lines | Where-Object { $_ -notmatch '\{\{DEPOT_LINUX\}\}' } }
  $text = ($lines -join "`n") + "`n"
  foreach ($key in $values.Keys) { $text = $text.Replace("{{$key}}", "$($values[$key])") }
  if ($text -match '\{\{') { throw "unfilled placeholder in $template" }
  return $text
}

New-Item -ItemType Directory -Force -Path (Join-Path $out 'logs') | Out-Null
$appVdf = Join-Path $out "app_build_$($cfg.APP_ID).vdf"
$files = @(
  @{ Path = $appVdf; Text = (Render 'app_build.vdf.template') },
  @{ Path = (Join-Path $out "depot_build_$($cfg.DEPOT_WIN).vdf"); Text = (Render 'depot_build_windows.vdf.template') }
)
if (-not $WindowsOnly) {
  $files += @{ Path = (Join-Path $out "depot_build_$($cfg.DEPOT_LINUX).vdf"); Text = (Render 'depot_build_linux.vdf.template') }
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($f in $files) { [System.IO.File]::WriteAllText($f.Path, $f.Text, $utf8) }

if (Get-Command node -ErrorAction SilentlyContinue) {
  & node (Join-Path $templates 'vdf-check.mjs') @($files | ForEach-Object { $_.Path })
  if ($LASTEXITCODE -ne 0) { Write-Error 'upload.ps1: a generated build script is not valid VDF' }
}

# ---- run --------------------------------------------------------------------------------------
$steamcmd = $cfg.STEAMCMD
if (-not $steamcmd) {
  $found = Get-Command steamcmd.exe, steamcmd -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $steamcmd = $found.Source }
}
$cmdArgs = @('+login', $cfg.STEAM_USER, '+run_app_build', $appVdf, '+quit')

if ($DryRun) {
  foreach ($f in $files) {
    Write-Host ''
    Write-Host "===== $($f.Path.Substring($here.Length + 1)) ====="
    Write-Host $f.Text
  }
  Write-Host "Dry run: would now run`n  $(if ($steamcmd) { $steamcmd } else { 'steamcmd.exe' }) $($cmdArgs -join ' ')"
  if (-not $WindowsOnly) { Write-Warning 'Uploading the Linux depot from Windows can lose its executable bits. Prefer upload.sh on Linux/macOS/WSL, or use -WindowsOnly.' }
  exit 0
}

if (-not $steamcmd -or -not (Test-Path -LiteralPath $steamcmd)) {
  Write-Error 'upload.ps1: SteamCMD not found. Download it from https://developer.valvesoftware.com/wiki/SteamCMD and set $env:STEAMCMD to steamcmd.exe'
}
if (-not $WindowsOnly) { Write-Warning 'Uploading the Linux depot from Windows can lose its executable bits. Prefer upload.sh on Linux/macOS/WSL, or use -WindowsOnly.' }
Write-Host "Uploading app $($cfg.APP_ID). SteamCMD will ask for your password and Steam Guard code."
& $steamcmd @cmdArgs
if ($LASTEXITCODE -ne 0) { Write-Error "SteamCMD failed (exit $LASTEXITCODE). Logs: $(Join-Path $out 'logs')" }
Write-Host 'Done. See the build in Steamworks: App Admin > SteamPipe > Builds.'
