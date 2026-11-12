param([Parameter(Mandatory = $true)][string]$Executable)
$ErrorActionPreference = 'Stop'
$path = (Resolve-Path -LiteralPath $Executable).Path
if ([System.IO.Path]::GetFileName($path) -cne 'MonBPREAAdmin.exe') { throw 'Exécutable inattendu.' }
# This is the requested test of the actual visible WinForms application,
# not a background helper. A hidden window has no Process.MainWindowHandle.
$process = Start-Process -FilePath $path -PassThru -WindowStyle Normal
try {
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    do {
        Start-Sleep -Milliseconds 100
        $process.Refresh()
        if ($process.HasExited) { throw "L’exécutable autonome s’est fermé avant d’afficher la fenêtre." }
    } while ($process.MainWindowHandle -eq 0 -and [DateTime]::UtcNow -lt $deadline)
    if ($process.MainWindowHandle -eq 0 -or $process.MainWindowTitle -notlike '*Mon BPREA Admin*') {
        throw "La fenêtre administrative attendue n’a pas été observée."
    }
    if (-not $process.CloseMainWindow() -or -not $process.WaitForExit(5000)) {
        throw "La fermeture normale de l’exécutable autonome a échoué."
    }
    if ($process.ExitCode -ne 0) { throw "Le lancement autonome a rendu un code d’échec." }
    Write-Output "Lancement de l’exécutable autonome : fenêtre attendue observée et fermeture normale réussie, sans déverrouillage ni réseau PROD."
} finally {
    # Only the process created by this script can be stopped here.
    if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
    $process.Dispose()
}
