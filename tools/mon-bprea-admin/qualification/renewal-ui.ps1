param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][ValidateSet(45,60,86400)][int]$OtpSeconds,
    [switch]$RecoveryOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing, System.Windows.Forms
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class InvitationQualificationWindow {
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr dc, uint flags);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, string text);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
    public static void Fill(IntPtr hwnd, string text) { SendMessage(hwnd, 0x000C, IntPtr.Zero, text); }
    public static bool Click(IntPtr hwnd) { return PostMessage(hwnd, 0x00F5, IntPtr.Zero, IntPtr.Zero); }
    public static void Capture(IntPtr hwnd, string path) {
        Rect rect;
        if (!GetWindowRect(hwnd, out rect)) throw new InvalidOperationException("Capture bounds");
        using (Bitmap img = new Bitmap(rect.Right - rect.Left, rect.Bottom - rect.Top))
        using (Graphics g = Graphics.FromImage(img)) {
            IntPtr dc = g.GetHdc();
            try { if (!PrintWindow(hwnd, dc, 2)) throw new InvalidOperationException("Capture unavailable"); }
            finally { g.ReleaseHdc(dc); }
            img.Save(path, ImageFormat.Png);
        }
    }
}
'@
$campaign = Join-Path (Get-Location).Path ".tmp/admin-22/otp-$OtpSeconds"
$capture = Join-Path $campaign 'captures'
New-Item -ItemType Directory -Path $capture -Force | Out-Null
$state = Get-Content -Raw -LiteralPath (Join-Path $campaign 'private/session.private.json') | ConvertFrom-Json
if ($state.api -cne 'http://127.0.0.1:54321' -or $state.participant.email -notmatch '@example\.test$') { throw 'Only synthetic qualification data is allowed' }
$stateId = [Guid]$state.id
$exe = (Resolve-Path -LiteralPath $Executable).Path
$option = "--qualification-locale=$($stateId.ToString('D'))"
$node = (Get-Command node.exe).Source
$script:app=$null

function Start-Ui([string[]]$Options) {
    $launch = @{FilePath=$exe; WorkingDirectory=(Split-Path -Parent $exe); WindowStyle='Normal'; PassThru=$true}
    if ($Options.Count -gt 0) { $launch.ArgumentList=$Options }
    $script:app = Start-Process @launch
    if (!$script:app.WaitForInputIdle(10000)) { throw 'Window did not initialize' }
}
function Root {
    $script:app.Refresh()
    if ($script:app.HasExited -or $script:app.MainWindowHandle -eq [IntPtr]::Zero) { return $null }
    return [Windows.Automation.AutomationElement]::FromHandle($script:app.MainWindowHandle)
}
function Wait-Ui([string]$Name, [switch]$Edit, [switch]$Button) {
    $condition = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, $Name)
    if ($Edit -or $Button) {
        $type = if ($Edit) { [Windows.Automation.ControlType]::Edit } else { [Windows.Automation.ControlType]::Button }
        $control = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,
            $type)
        $condition = [Windows.Automation.AndCondition]::new($condition, $control)
    }
    $tries = 120
    for ($i=0; $i -lt $tries; $i++) {
        $r = Root
        if ($r) {
            if ($r.Current.Name -eq $Name) { return $r }
            $item = $r.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
            if ($item -and !$item.Current.IsOffscreen -and $item.Current.IsEnabled) { return $item }
            $byPid = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty, $script:app.Id)
            foreach ($owned in [Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Children,$byPid)) {
                $item = $owned.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
                if ($item -and !$item.Current.IsOffscreen -and $item.Current.IsEnabled) { return $item }
            }
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Missing control: $Name"
}
function Click-Ui([string]$Name, [switch]$Async) {
    $item = Wait-Ui $Name -Button
    if ($Async -and $item.Current.NativeWindowHandle -ne 0) {
        if (![InvitationQualificationWindow]::Click([IntPtr]$item.Current.NativeWindowHandle)) { throw 'Unable to post click' }
    } else {
        $pattern=$item.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
        $pattern.Invoke()
    }
}
function Fill-Ui([string]$Name, [string]$Text) {
    $item = Wait-Ui $Name -Edit
    try { ($item.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)).SetValue($Text) }
    catch { [InvitationQualificationWindow]::Fill([IntPtr]$item.Current.NativeWindowHandle, $Text) }
}
function Screen([string]$Name, [IntPtr]$Handle = [IntPtr]::Zero) {
    $script:app.Refresh()
    if ($Handle -eq [IntPtr]::Zero) { $Handle = $script:app.MainWindowHandle }
    [InvitationQualificationWindow]::Capture($Handle, (Join-Path $capture $Name))
}
function Close-Ui {
    if (!$script:app -or $script:app.HasExited) { return }
    [void]$script:app.CloseMainWindow()
    if (!$script:app.WaitForExit(10000)) { throw 'Application still in operation' }
}

function Browser([string]$Mode) {
    & $node tools/mon-bprea-admin/qualification/browser.mjs $Mode "--renewal-otp=$OtpSeconds"
    if ($LASTEXITCODE -ne 0) { throw "Participant browser check failed: $Mode" }
}
function Proof([string]$Phase) {
    $response = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:54329/renewal-proof' -Headers @{'X-Qualification-ID'=$state.id} -ContentType 'application/json' -Body (@{phase=$Phase} | ConvertTo-Json)
    if ($response.ok -ne $true) { throw "Invalid proof: $Phase" }
}
function ChooseParticipant([string]$Address = $state.participant.email) {
    Click-Ui 'Récupérer un compte'
    (Wait-Ui $Address).GetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern).Select()
    Click-Ui 'Continuer'
}
function CopyInvitation {
    Click-Ui 'Copier le lien'
    [void](Wait-Ui 'Lien copié. Transmets-le uniquement à ton camarade.')
}
$previousClipboard = [Windows.Forms.Clipboard]::GetDataObject()
try {
    Start-Ui @($option)
    if ($RecoveryOnly) {
        [void](Wait-Ui 'Récupérer un compte')
        ChooseParticipant
        Click-Ui 'Réinitialiser le mot de passe'
        CopyInvitation
        Browser 'password'
        Click-Ui 'Terminer'
        ChooseParticipant
        Click-Ui "Modifier l’adresse e-mail"
        Fill-Ui 'Nouvelle adresse e-mail' 'alice-new-v2@example.test'
        Click-Ui 'Continuer' -Async
        Click-Ui 'Confirmer cette action'
        [void](Wait-Ui 'Adresse modifiée')
        Browser 'email'
        Click-Ui 'Terminer'
        ChooseParticipant 'alice-new-v2@example.test'
        Click-Ui "Modifier l’adresse e-mail et le mot de passe"
        Fill-Ui 'Nouvelle adresse e-mail' 'alice-both-v2@example.test'
        Click-Ui 'Continuer' -Async
        Click-Ui 'Confirmer cette action'
        CopyInvitation
        Browser 'combined'
        Write-Output 'PASS Windows: password reset, email change and combined recovery on the account activated after renewal.'
        return
    }
    Fill-Ui 'Clé secrète' $state.key
    Click-Ui 'Continuer'
    Click-Ui 'Créer un compte'
    Fill-Ui 'Adresse e-mail du camarade' $state.participant.email
    Click-Ui "Créer le lien d’activation"
    $duration = if ($OtpSeconds -eq 86400) { "Lien d’activation valable 24 heures" } else { "Lien d’activation valable $OtpSeconds secondes" }
    [void](Wait-Ui $duration)
    Proof 'before'
    CopyInvitation
    Close-Ui
    if ($OtpSeconds -lt 86400) {
        Start-Sleep -Seconds ($OtpSeconds + 1)
        Browser 'expired-invitation'
        Start-Ui @($option,'--qualification-theme=dark')
    } else {
        Start-Ui @($option,'--qualification-theme=light')
    }
    [void](Wait-Ui 'Créer un compte')
    [void](Wait-Ui 'Récupérer un compte')
    [void](Wait-Ui 'Supprimer un compte')
    Screen 'reouverture.png'
    ChooseParticipant
    if ($OtpSeconds -lt 86400) {
        [void](Wait-Ui 'Invitation expirée')
        Screen 'invitation-expiree.png'
    } else {
        [void](Wait-Ui "Invitation en attente d’activation")
    }
    Click-Ui "Créer un nouveau lien d’activation" -Async
    $dialog = Wait-Ui 'Confirmer le renouvellement'
    Screen 'confirmer-renouvellement.png' ([IntPtr]$dialog.Current.NativeWindowHandle)
    Click-Ui 'Confirmer cette action'
    [void](Wait-Ui "Nouveau lien d’activation généré")
    [void](Wait-Ui $duration)
    Screen 'nouveau-lien.png'
    if ($OtpSeconds -eq 86400) { Browser 'expired-invitation' } # Superseded while still inside the 24 h window.
    CopyInvitation
    Proof 'renewed'
    Browser 'activate'
    Proof 'activated'
    Click-Ui 'Terminer'
    ChooseParticipant
    [void](Wait-Ui 'Réinitialiser le mot de passe' -Button)
    $privateStore = Join-Path $env:LOCALAPPDATA "MonBPREAAdmin/Qualification/$($state.id)/Private"
    $entries = @(Get-ChildItem -LiteralPath $privateStore -Filter 'admin-v2-*-reserved.json' | ForEach-Object {
        (Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json).Data
    })
    $original = @($entries | Where-Object Kind -eq 0)
    $renewed = @($entries | Where-Object Kind -eq 5)
    if ($entries.Count -ne 2 -or $original.Count -ne 1 -or $renewed.Count -ne 1 -or $renewed[0].InitialInvitation -ne $original[0].Id) { throw 'Append-only invitation ledger invalid' }
    if ($renewed[0].AccountId -ne (Get-Content -Raw -LiteralPath (Join-Path $campaign 'private/session.private.json') | ConvertFrom-Json).participant.userId) { throw 'Unexpected journal UUID' }
    if (@(Get-ChildItem -LiteralPath $privateStore -Filter 'admin-v2-*-complete.json').Count -ne 2) { throw 'Missing completion receipts' }
    foreach ($entry in Get-ChildItem -LiteralPath $privateStore -File) {
        $bytes = [IO.File]::ReadAllBytes($entry.FullName)
        if ([Text.Encoding]::UTF8.GetString($bytes) -match 'token_hash=|alice-v2@example\.test') { throw 'Private value found in plaintext' }
    }
    Write-Output 'PASS Windows: invitation renewal, same UUID and profiles, protected append-only receipts, normal recovery after activation.'
} finally {
    Close-Ui
    if ($null -ne $previousClipboard) { [Windows.Forms.Clipboard]::SetDataObject($previousClipboard, $true) }
    else { [Windows.Forms.Clipboard]::Clear() }
}
