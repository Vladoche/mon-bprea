param([Parameter(Mandatory = $true)][string]$Directory)
$ErrorActionPreference = 'Stop'
$release = (Resolve-Path -LiteralPath $Directory).Path
$files = @(Get-ChildItem -LiteralPath $release -File)
if ($files.Count -ne 1 -or $files[0].Name -cne 'MonBPREAAdmin.exe') {
    throw 'La publication doit contenir exclusivement MonBPREAAdmin.exe.'
}
$bytes = [System.IO.File]::ReadAllBytes($files[0].FullName)
$texts = @([System.Text.Encoding]::UTF8.GetString($bytes), [System.Text.Encoding]::Unicode.GetString($bytes))
foreach ($text in $texts) {
    if ($text -match 'sb_secret_[A-Za-z0-9_-]{16,256}' -or
        $text -match 'eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}' -or
        $text -match '[?&#](?:token_hash|access_token|refresh_token)=[A-Za-z0-9_.-]{20,}' -or
        $text -match 'synthetic_token_without_any_auth_capability|participant@example\.test') {
        throw 'Contenu sensible ou fixture de test interdit dans la publication.'
    }
}
$signature = Get-AuthenticodeSignature -LiteralPath $files[0].FullName
Write-Output ('Publication contrôlée : un exécutable, {0:N0} octets, signature : {1}.' -f $bytes.Length, $signature.Status)
# This is a bounded check of known patterns, not a claim to detect every secret.
