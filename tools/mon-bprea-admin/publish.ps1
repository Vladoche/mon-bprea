param(
    [string]$DotnetPath = 'dotnet',
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'artifacts')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$dotnetCommand = (Get-Command $DotnetPath -ErrorAction Stop).Source
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) {
    if (@(Get-ChildItem -LiteralPath $output -Force).Count -ne 0) {
        throw 'Le dossier de livraison doit être neuf ou vide ; aucun artefact existant ne sera écrasé.'
    }
} else {
    New-Item -ItemType Directory -Path $output | Out-Null
}
$publish = Join-Path $output 'publish'
$vectors = Join-Path $output 'node-contract-vectors.json'
Push-Location $PSScriptRoot
try {
    & node (Join-Path $PSScriptRoot 'contract-vectors.mjs') $vectors
    if ($LASTEXITCODE -ne 0) { throw 'Échec des vecteurs de référence Node.' }
    & $dotnetCommand run --project Tests/MonBprea.Admin.Tests.csproj -c Release -- $vectors
    if ($LASTEXITCODE -ne 0) { throw 'Échec des tests du client administratif.' }
    & $dotnetCommand run --project WindowTests/MonBPREAAdmin.WindowTests.csproj -c Release
    if ($LASTEXITCODE -ne 0) { throw "Échec des tests de lancement et de l’interface Windows." }
    & $dotnetCommand publish App/MonBPREAAdmin.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishTrimmed=false -p:DebugType=None -p:DebugSymbols=false -o $publish
    if ($LASTEXITCODE -ne 0) { throw 'Échec de la publication Windows.' }
    & (Join-Path $PSScriptRoot 'inspect-release.ps1') -Directory $publish
    & (Join-Path $PSScriptRoot 'launch-smoke.ps1') -Executable (Join-Path $publish 'MonBPREAAdmin.exe')
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.md') -Destination (Join-Path $publish 'LIRE-MOI.md')
    $hash = (Get-FileHash -LiteralPath (Join-Path $publish 'MonBPREAAdmin.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText((Join-Path $publish 'SHA256.txt'), "$hash  MonBPREAAdmin.exe`n", [System.Text.UTF8Encoding]::new($false))
    Write-Output "Livraison Windows préparée dans $publish"
} finally {
    Pop-Location
}
