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
    $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $publish 'MonBPREAAdmin.exe')).FileVersion
    if ($version -ne '1.1.0.0') { throw 'Version de publication inattendue.' }
    $zipPath = Join-Path $output 'MonBPREAAdmin-1.1-win-x64.zip'
    Compress-Archive -LiteralPath @((Join-Path $publish 'MonBPREAAdmin.exe'), (Join-Path $publish 'LIRE-MOI.md'), (Join-Path $publish 'SHA256.txt')) -DestinationPath $zipPath
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $names = @($archive.Entries.FullName | Sort-Object)
        if (($names -join ',') -cne 'LIRE-MOI.md,MonBPREAAdmin.exe,SHA256.txt') { throw 'Contenu ZIP inattendu.' }
        $stream = $archive.GetEntry('MonBPREAAdmin.exe').Open()
        try {
            $sha = [System.Security.Cryptography.SHA256]::Create()
            try { $archiveHash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
            finally { $sha.Dispose() }
        } finally { $stream.Dispose() }
        if ($archiveHash -cne $hash) { throw 'Empreinte ZIP divergente.' }
    } finally { $archive.Dispose() }
    Write-Output "ZIP V1.1 contrôlé : trois fichiers attendus, empreinte exécutable identique."
    Write-Output "Livraison Windows préparée dans $publish"
} finally {
    Pop-Location
}
