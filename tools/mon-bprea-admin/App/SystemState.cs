using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.App;

internal sealed partial class SimpleMainForm
{
    private readonly Func<AutomaticPrivateStore>? productionHistory;
    private readonly Func<ProductionBackup>? productionBackup;
    private System.Windows.Forms.Timer? maintenanceTimer;
    private SystemHealth? lastSystem;
    private DateTimeOffset? automaticAttempt;
    private string? lastRenewalFailure;

    private sealed record SystemHealth(HistoryStatus? History, string? HistoryProblem, BackupStatus? Backup, string? BackupFailure,
        int? Accounts, string? ConnectionProblem, string? InvitationProblem);

    private void StartMaintenanceTimer()
    {
        if (productionBackup is null) return;
        maintenanceTimer = new() { Interval = (int)TimeSpan.FromMinutes(30).TotalMilliseconds };
        maintenanceTimer.Tick += async (_, _) => { if (!busy && workflow is not null) await MaintainOnOpen(); };
        maintenanceTimer.Start();
    }

    private Task MaintainOnOpen(bool inOperation = false)
    {
        if (productionBackup is null) return Task.CompletedTask;
        async Task Read()
        {
            var state = lastSystem = await ReadSystem(renew: true, automatic: true);
            var problem = state.HistoryProblem ?? state.BackupFailure ?? state.InvitationProblem;
            SetMessage(problem is not (null or "key") ? AdminMessages.For(problem)
                : state.Backup is { Ready: true, Approaching: true } ? "La sauvegarde approche de son renouvellement." : "");
        }
        return inOperation ? Read() : Run(Read);
    }

    private async Task<SystemHealth> ReadSystem(bool renew, bool automatic = false, string? password = null)
    {
        HistoryStatus? history = null;
        BackupStatus? backup = null;
        string? historyProblem = null, connectionProblem = null, invitationProblem = null;
        int? accounts = null;
        try
        {
            history = await Task.Run(() => {
                var store = productionHistory!();
                store.Initialize();
                return store.InspectHistory();
            });
        }
        catch (AdminException error) { historyProblem = error.Code; }

        if (history is not null)
            backup = await Task.Run(() => productionBackup!().AttachConfiguration());

        if (workflow is null) connectionProblem = "key";
        else
        {
            try
            {
                var inventory = await workflow.RefreshAsync();
                accounts = inventory.Count;
                if (historyProblem is null)
                {
                    var maintenance = productionBackup!();
                    var runAutomatic = automatic && backup!.Due && (automaticAttempt is null
                        || DateTimeOffset.UtcNow - automaticAttempt >= TimeSpan.FromHours(6));
                    if (renew && (!automatic || runAutomatic))
                    {
                        if (automatic) automaticAttempt = DateTimeOffset.UtcNow;
                        try
                        {
                            backup = await Task.Run(() => maintenance.RenewAsync(inventory, password, automatic));
                            lastRenewalFailure = null;
                            inventory = await workflow.RefreshAsync();
                            accounts = inventory.Count;
                        }
                        catch (AdminException error) { lastRenewalFailure = error.Code; }
                    }
                    try
                    {
                        if (inventory.Count >= AdminContract.MaximumAccounts) throw new AdminException("capacity");
                        if (inventory.Accounts.Any(a => a.RecoveryRestricted || !a.ConfirmedAt.HasValue && !a.InvitedAt.HasValue))
                            throw new AdminException("lookup");
                        await Task.Run(async () => {
                            using var lease = productionHistory!().AcquireInspection();
                            if (productionHistory!().HasUncertainOperation()) throw new AdminException("pending");
                            await maintenance.RequireReadyAsync(inventory);
                        });
                    }
                    catch (AdminException error) { invitationProblem = error.Code; }
                }
            }
            catch (AdminException error) { connectionProblem = error.Code; }
        }
        return new(history, historyProblem, backup, lastRenewalFailure, accounts, connectionProblem,
            historyProblem ?? connectionProblem ?? invitationProblem);
    }

    private Task OpenSystem(bool renew = false, string? password = null) => Run(async () =>
        ShowSystem(lastSystem = await ReadSystem(renew, password: password)));

    private void ShowSystem(SystemHealth state)
    {
        var page = Page("État du système");
        AcceptButton = null;
        var history = state.History is null ? "bloqué" : $"prêt · {state.History.Operations} opération(s)";
        var backup = state.Backup is not { Ready: true } ? "bloquée" : state.Backup.Approaching ? "à renouveler" : "à jour";
        var connection = state.ConnectionProblem is null ? $"prête · {state.Accounts} compte(s) sur 7" : "indisponible";
        var invitation = state.InvitationProblem is null ? "disponible" : "bloquée";
        var diagnostic = $"Sauvegarde — {backup}\nHistorique administratif — {history}\nConnexion PROD — {connection}\nInvitation — {invitation}";
        if (state.Backup is { Snapshot: { } point, Deadline: { } deadline })
            diagnostic += $"\nDernier point restauré le {point.ToLocalTime():g} · échéance le {deadline.ToLocalTime():g}";
        var explanation = state.HistoryProblem ?? state.BackupFailure ?? state.Backup?.Problem ?? state.InvitationProblem;
        page.Controls.Add(Label(diagnostic, "SystemSummary"));
        if (state.InvitationProblem is null)
            page.Controls.Add(Label("Configuration terminée. Mon BPREA Admin est prêt."));
        if (explanation is not null && explanation != "key")
            page.Controls.Add(Label(AdminMessages.For(explanation), "SystemExplanation"));
        if (state.HistoryProblem is not null)
        {
            page.Controls.Add(Label("Si l’historique est sur un support retiré, reconnecte-le. Ferme les anciens outils d’administration et réessaie. Si deux dossiers contiennent des opérations, conserve-les pour vérification."));
            page.Controls.Add(Button("Vérifier à nouveau", "CheckHistory", () => _ = OpenSystem(), false));
        }
        else if (state.ConnectionProblem is "key" or "key_revoked")
            page.Controls.Add(Button("Finaliser la configuration", "FinalizeAuth", () => Setup(workflow is not null), false));
        else if (state.BackupFailure == "backup_access" || state.InvitationProblem == "backup_access")
            page.Controls.Add(Button("Finaliser la configuration", "FinalizeBackup", PostgresAccess, false));
        else if (explanation is "backup_storage" or "backup_ledger")
        {
            page.Controls.Add(Label("Reconnecte le support de sauvegarde s’il est débranché. Si la vérification échoue à nouveau, transmets le diagnostic pour retrouver le dossier protégé."));
            page.Controls.Add(Button("Vérifier à nouveau", "CheckBackupStorage", () => _ = OpenSystem(), false));
        }
        else if (state.ConnectionProblem is null)
            page.Controls.Add(Button("Renouveler et vérifier maintenant", "RenewBackup", () => _ = OpenSystem(renew: true), false));
        else page.Controls.Add(Button("Vérifier à nouveau", "CheckConnectionAgain", () => _ = OpenSystem(), false));
        if (state.Backup is { Ready: true })
            page.Controls.Add(Label("Sauvegarde applicative PROD restaurée et vérifiée. Reprise Auth, sessions, secrets, Storage et délai de reprise non démontrés."));
        page.Controls.Add(Button("Copier le diagnostic", "CopySystemDiagnostic", () => {
            copy($"Mon BPREA Admin {Application.ProductVersion}\nWindows {Environment.OSVersion.Version}\n"
                + $"Contrôle du {DateTimeOffset.Now:g}\n{diagnostic}"
                + (explanation is null ? "" : "\n" + AdminMessages.For(explanation)));
            SetMessage("Diagnostic copié.");
        }, false));
        AttachMessage(page);
    }

    private void PostgresAccess()
    {
        var page = Page("Accès aux sauvegardes");
        page.Controls.Add(Label("Saisis le mot de passe PostgreSQL de Mon BPREA PROD. Windows mémorise cet accès chiffré séparément de la clé administrative. La sauvegarde lit la base puis restaure la copie sur ce poste."));
        var password = Input("PostgresPassword");
        password.MaxLength = 266;
        password.UseSystemPasswordChar = true;
        password.AccessibleName = "Mot de passe PostgreSQL";
        page.Controls.Add(password);
        var submit = Button("Vérifier et renouveler", "VerifyBackupAccess", () => {
            var value = password.Text;
            password.Clear();
            _ = OpenSystem(renew: true, password: value);
        }, false);
        page.Controls.Add(submit);
        AttachMessage(page);
        AcceptButton = submit;
        password.Select();
    }
}
