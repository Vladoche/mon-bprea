using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.App;

public sealed partial class MainForm
{
    private readonly IAdminCredentialVault vault;
    private readonly CheckBox rememberKey = Check("Autoriser l’enregistrement de cette clé dans le Gestionnaire d’identifiants Windows (facultatif).", "RememberKey");
    private readonly Button saveKey = Button("Enregistrer / remplacer la clé", "SaveCredential");
    private readonly Button readKey = Button("Relire la clé mémorisée", "ReadCredential");
    private readonly Button deleteKey = Button("Supprimer la clé mémorisée", "DeleteCredential");
    private void BuildCredentialControls(TableLayoutPanel layout)
    {
        layout.Controls.Add(rememberKey);
        layout.Controls.Add(TextLabel("Par défaut, aucune mémorisation. L’entrée Windows est liée à ce compte Windows, ce PC et au projet PROD exact. Relire remplit uniquement le champ masqué ; aucune opération sensible n’est confirmée automatiquement."));
        var bar = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true };
        bar.Controls.Add(saveKey); bar.Controls.Add(readKey); bar.Controls.Add(deleteKey); layout.Controls.Add(bar);
        saveKey.Enabled = false;
        rememberKey.CheckedChanged += (_, _) => saveKey.Enabled = rememberKey.Checked;
        saveKey.Click += async (_, _) => await RunAsync(() => {
            if (!rememberKey.Checked) return Task.CompletedTask;
            vault.Save(key.Text); key.Clear(); rememberKey.Checked = false;
            SetMessage("Clé enregistrée ou remplacée dans le Gestionnaire d’identifiants Windows pour ce compte et ce projet PROD. Relisez-la pour déverrouiller.");
            return Task.CompletedTask;
        });
        readKey.Click += async (_, _) => await RunAsync(() => {
            key.Clear();
            key.Text = vault.Read() ?? "";
            SetMessage(key.Text.Length == 0 ? "Aucune clé mémorisée pour ce compte Windows et ce projet PROD." : "Clé relue dans le champ masqué. Déverrouillage et confirmations individuelles restent nécessaires.");
            return Task.CompletedTask;
        });
        deleteKey.Click += async (_, _) => await RunAsync(() => {
            vault.Delete(); key.Clear(); rememberKey.Checked = false;
            SetMessage("Entrée du Gestionnaire d’identifiants supprimée pour ce projet. Cela ne révoque pas la clé chez Supabase.");
            return Task.CompletedTask;
        });
    }

    private readonly Button closeAccount = Button("Clôturer un compte", "CloseAccount");
    private readonly TextBox closureEmail = Input("ClosureEmail");
    private readonly TextBox closureReference = Input("ClosureReference");
    private readonly DateTimePicker closureDate = new() { Name = "ClosureDate", Format = DateTimePickerFormat.Custom, CustomFormat = "dd/MM/yyyy HH:mm", Dock = DockStyle.Top };
    private readonly Button prepareClosure = Button("Vérifier la préparation", "PrepareClosure");
    private readonly Button reviewClosure = Button("Examiner la confirmation définitive…", "ReviewClosure");
    private readonly Button cancelClosure = Button("Annuler la préparation", "CancelClosure");
    private readonly Button inspectClosure = Button("Inspection Auth en lecture seule", "InspectClosure");
    private readonly Button closureFolder = Button("Consulter le dossier privé", "ClosureFolder");
    private readonly Label closureSummary = TextLabel("");
    private readonly Label closureSelection = TextLabel("");
    private readonly Label closureResult = TextLabel("");
    private readonly CheckBox[] closureChecks = [
        Check("Une demande réelle de clôture ou une décision justifiée a été reçue.", "ClosureRequested"),
        Check("L’identité du titulaire a été raisonnablement vérifiée par un canal connu.", "ClosureIdentity"),
        Check("Le compte sélectionné correspond exactement à cette demande.", "ClosureTarget"),
        Check("Le droit exercé a été qualifié.", "ClosureRight"),
        Check("Les exceptions légitimes de conservation ont été examinées.", "ClosureExceptions"),
        Check("Une possibilité d’export a été proposée.", "ClosureExport"),
        Check("Aucun export demandé ne reste à traiter ou remettre ; s’il a été demandé, traitement et remise vérifiés.", "ClosureExportDelivered"),
        Check("Le titulaire a été informé des conséquences irréversibles.", "ClosureConsequences"),
        Check("Je suis habilité et j’autorise cette seule clôture individuelle.", "ClosureAuthorized")
    ];
    private AuthAccount? closureTarget;
    private ClosurePreparation? closurePreparation;
    private bool closureAttempted;

    private void BuildClosure()
    {
        var page = new TabPage("Clôture de compte") { AutoScroll = true, Padding = new Padding(14) };
        var layout = Vertical(); closureEmail.ReadOnly = true;
        layout.Controls.Add(TextLabel("Préparation → Vérification → Confirmation → Exécution → Postcontrôle"));
        layout.Controls.Add(TextLabel("Suppression définitive d’une seule identité Auth et de ses données actives par cascades. Le compte exploitant doit être exclu par UUID vérifié. Cette V1.2 bloque la suppression PROD : canal PostgreSQL de confiance et preuves de sauvegarde à qualifier."));
        AddField(layout, "Participant sélectionné", closureEmail);
        closureSelection.Name = "ClosureSelection"; layout.Controls.Add(closureSelection);
        AddField(layout, "Référence interne de la demande (sans nom, email ni contenu personnel)", closureReference);
        layout.Controls.Add(TextLabel("Date de réception de la demande")); layout.Controls.Add(closureDate);
        layout.Controls.Add(TextLabel("Attestations humaines neuves, distinctes des preuves techniques. Pas de pièce d’identité systématique ; ne demander ni mot de passe, JWT ou code MFA."));
        foreach (var c in closureChecks) layout.Controls.Add(c);
        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Top };
        actions.Controls.Add(prepareClosure); actions.Controls.Add(cancelClosure); layout.Controls.Add(actions);
        closureSummary.Name = "ClosureSummary"; closureResult.Name = "ClosureResult";
        layout.Controls.Add(closureSummary); layout.Controls.Add(reviewClosure); layout.Controls.Add(closureResult);
        layout.Controls.Add(TextLabel(ClosureContract.ResidualReminder));
        var followup = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Top };
        followup.Controls.Add(inspectClosure); followup.Controls.Add(closureFolder); layout.Controls.Add(followup);
        page.Controls.Add(layout); tabs.TabPages.Add(page);
        closeAccount.Click += (_, _) => {
            var selected = SelectedAccount();
            if (busy || selected is null || uncertainGeneration || HasUnhandedReceipt) return;
            ResetOperation(); closureTarget = selected; closureEmail.Text = selected.Email;
            closureSelection.Text = $"État Auth observé : {selected.State} · PROD {AdminContract.Project}\nDernier inventaire : {FormatDate(displayedInventory?.ObservedAt)} · Sauvegarde/journal : non vérifiés";
            tabs.SelectedIndex = 3; UpdateControls(); closureReference.Focus();
            SetMessage("Préparée : vérifier la demande et sa qualification. Aucune suppression autorisée par cette préparation.");
        };
        prepareClosure.Click += async (_, _) => await RunAsync(PrepareClosureAsync);
        reviewClosure.Click += (_, _) => {
            var plan = closurePreparation?.AuthorizedPlan;
            if (busy || plan is null || closureAttempted) return;
            using var dialog = new ClosureConfirmationDialog(plan, closurePreparation!.BackupSummary);
            if (dialog.ShowDialog(this) != DialogResult.OK) { ResetClosure(); UpdateControls(); return; }
            // RunAsync sets busy synchronously before first await, preventing
            // double click, close or lock while execution is in flight.
            _ = RunAsync(async () => {
                closureAttempted = true; closurePreparation = null;
                closureResult.Text = "Autorisée → Suppression en cours → Postcontrôle. Une seule tentative, aucun retry.";
                try {
                    var result = await workflow!.ExecuteClosureAsync(plan, dialog.ExactConfirmation);
                    closureResult.Text = result.Description + "\n" + ClosureContract.HolderResponse(result);
                    SetMessage(result.Description + ". Journal privé conservé ; revue des résidus et des sauvegardes nécessaire.");
                }
                catch { uncertainGeneration = true; closureResult.Text = "Résultat incertain ou exécution interrompue. Consulter le journal ; aucune répétition."; throw new AdminException("closure_uncertain"); }
                finally { inventoryReady = false; uncertainGeneration = true; foreach (var c in closureChecks) c.Checked = false; }
            });
        };
        cancelClosure.Click += (_, _) => { ResetClosure(); UpdateControls(); SetMessage("Préparation annulée. Aucun appel de suppression."); };
        inspectClosure.Click += async (_, _) => await RunAsync(RefreshAsync);
        closureFolder.Click += (_, _) => { try { workflow?.OpenPrivateFolder(); } catch { SetMessage(AdminMessages.For("private")); } };
        foreach (var c in closureChecks) c.CheckedChanged += (_, _) => InvalidateClosurePreparation();
        closureReference.TextChanged += (_, _) => InvalidateClosurePreparation();
        closureDate.ValueChanged += (_, _) => InvalidateClosurePreparation();
    }
    private async Task PrepareClosureAsync()
    {
        if (workflow is null || closureTarget is null) return;
        var h = closureChecks.Select(c => c.Checked).ToArray();
        closurePreparation = await workflow.PrepareClosureAsync(closureTarget, new(closureReference.Text,
            new DateTimeOffset(closureDate.Value), new(h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],h[8])));
        var p = closurePreparation;
        closureSummary.Text = $"PROD · {AdminContract.Project}\nAdresse : {p.Account.Email} · {p.Account.State}\nInventaire : {FormatDate(p.Inventory.ObservedAt)}\n" +
            string.Join("\n", ClosureContract.Tables.Select(t => $"{t} : {(p.Counts.TryGetValue(t, out var n) ? n.ToString() : "non collecté")}")) +
            "\nSauvegarde : " + p.BackupSummary + "\n" + (p.CanConfirm ? "Vérification réussie. Confirmation finale requise." : "SUPPRESSION BLOQUÉE\n" + string.Join("\n", p.Blockers));
        SetMessage(p.CanConfirm ? "Vérification achevée. Aucun appel destructif avant confirmation distincte." : "Préparée, contrôles incomplets. Aucune suppression PROD possible ; dossier privé enregistré.");
    }
    private void InvalidateClosurePreparation()
    {
        if (busy) return;
        closurePreparation = null; closureSummary.Text = ""; UpdateControls();
    }
    private void ResetClosure()
    {
        closurePreparation = null; closureTarget = null; closureEmail.Clear(); closureReference.Clear();
        closureSummary.Text = ""; closureSelection.Text = ""; foreach (var c in closureChecks) c.Checked = false;
    }
    private void UpdateClosureControls(bool connected, AuthAccount? selected)
    {
        closeAccount.Enabled = connected && !busy && !uncertainGeneration && !HasUnhandedReceipt && !closureAttempted && selected is not null;
        prepareClosure.Enabled = connected && !busy && !uncertainGeneration && !closureAttempted && closureTarget is not null && inventoryReady;
        reviewClosure.Enabled = connected && !busy && !uncertainGeneration && !closureAttempted && closurePreparation?.CanConfirm == true;
        inspectClosure.Enabled = connected && !busy;
        closureFolder.Enabled = connected && !busy;
    }
}

internal sealed class ClosureConfirmationDialog : Form
{
    private readonly TextBox phrase = new() { Name = "ClosureExactConfirmation", Dock = DockStyle.Top };
    internal string ExactConfirmation => phrase.Text;
    internal ClosureConfirmationDialog(PreparedClosure plan, string backup)
    {
        Name = "ClosureConfirmationDialog"; Text = "Confirmer la suppression définitive";
        MinimumSize = new Size(680, 570); Size = new Size(800, 700); StartPosition = FormStartPosition.CenterParent;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, Padding = new Padding(20), ColumnCount = 1 };
        var label = new Label { AutoSize = true, MaximumSize = new Size(700, 0), Text =
            $"PROD · {AdminContract.Project}\nAdresse : {plan.Account.Email}\nUUID vérifié : {plan.Account.Id}\n" +
            $"Portée : identité Auth et dix tables actives.\nDemande : {plan.Request.Reference}, reçue le {plan.Request.ReceivedAt:u}\n" +
            "Export proposé ; tout export demandé a été traité et remis.\nSauvegarde : " + backup + "\n\n" + ClosureContract.ResidualReminder + "\n\n" + plan.ConfirmationText };
        layout.Controls.Add(label); layout.Controls.Add(phrase);
        var execute = new Button { Name = "ExecuteClosure", Text = "Supprimer définitivement ce compte", AutoSize = true, Enabled = false };
        var cancel = new Button { Name = "CancelClosureConfirmation", Text = "Annuler", DialogResult = DialogResult.Cancel, AutoSize = true };
        layout.Controls.Add(cancel); layout.Controls.Add(execute); Controls.Add(layout);
        AcceptButton = null; CancelButton = cancel; ActiveControl = cancel;
        phrase.TextChanged += (_, _) => execute.Enabled = phrase.Text == plan.ConfirmationText && DateTimeOffset.UtcNow - plan.Inventory.ObservedAt < AdminContract.MaximumInventoryAge;
        execute.Click += (_, _) => { if (!execute.Enabled) return; execute.Enabled = false; DialogResult = DialogResult.OK; Close(); };
        var expiry = new System.Windows.Forms.Timer { Interval = 500 };
        expiry.Tick += (_, _) => { if (DateTimeOffset.UtcNow - plan.Inventory.ObservedAt >= AdminContract.MaximumInventoryAge) { execute.Enabled = false; phrase.Enabled = false; } };
        Shown += (_, _) => expiry.Start(); FormClosed += (_, _) => expiry.Dispose();
    }
}
