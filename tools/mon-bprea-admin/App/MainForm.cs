using MonBprea.Admin.Core;

namespace MonBprea.Admin.App;

public sealed class MainForm : Form
{
    private readonly Func<UnlockInput, IAdminWorkflow> createWorkflow;
    private IAdminWorkflow? workflow;
    private PreparedInvitation? prepared;
    private PreparedRecovery? preparedRecovery;
    private RecoveryReceipt? recoveryReceipt;
    private bool recoveryReceiptHandedOver;
    private string? recoveryReceiptEmail;
    private bool HasUnhandedReceipt => receipt is not null && !receiptHandedOver || recoveryReceipt is not null && !recoveryReceiptHandedOver;
    private AuthAccount? recoveryTarget;
    private bool inventoryReady;
    private readonly Func<bool> confirmHandover;
    private InvitationReceipt? receipt;
    private bool receiptHandedOver;
    private bool busy;
    private bool uncertainGeneration;
    private readonly Label connection = TextLabel("PROD · Session verrouillée");
    private readonly Label inventoryStatus = TextLabel("Inventaire non lu · Capacité maximale : 7 comptes");
    private readonly Label message = TextLabel("Déverrouillez la session pour consulter Supabase Auth.");
    private readonly TextBox key = Input("AdminKey");
    private readonly TextBox operatorEmail = Input("OperatorEmail");
    private readonly TextBox privateDirectory = Input("PrivateDirectory");
    private readonly TextBox operatorFile = Input("OperatorFile");
    private readonly Button unlock = Button("Déverrouiller", "Unlock");
    private readonly Button lockSession = Button("Verrouiller", "Lock");
    private readonly Button refresh = Button("Actualiser", "Refresh");
    private readonly Button prepare = Button("Préparer l’invitation", "Prepare");
    private readonly Button generate = Button("Générer cette invitation", "Generate");
    private readonly Button cancel = Button("Annuler la préparation", "CancelPreparation");
    private readonly Button openFolder = Button("Ouvrir le dossier privé", "OpenPrivateFolder");
    private readonly Button handover = Button("Noter la remise au participant", "Handover");
    private readonly Button recoverAccess = Button("Récupérer l’accès", "RecoverAccess");
    private readonly Button prepareRecovery = Button("Préparer la récupération", "PrepareRecovery");
    private readonly Button generateRecovery = Button("Générer ce lien de récupération", "GenerateRecovery");
    private readonly Button cancelRecovery = Button("Annuler la préparation", "CancelRecovery");
    private readonly Button recoveryOpenFolder = Button("Ouvrir le dossier privé", "RecoveryOpenFolder");
    private readonly Button recoveryHandover = Button("Noter la remise au titulaire", "RecoveryHandover");
    private readonly TextBox recoveryEmail = Input("RecoveryEmail");
    private readonly TextBox recoveryConfirmation = Input("RecoveryConfirmation");
    private readonly Label recoveryResult = TextLabel("");
    private readonly Label recoverySummary = TextLabel("");
    private readonly Label selectionHint = TextLabel("Sélectionnez un compte confirmé pour récupérer son accès.");
    private readonly GroupBox recoveryReview = new() { Text = "Confirmation individuelle", AutoSize = true, Dock = DockStyle.Top, Visible = false };
    private readonly CheckBox[] recoveryChecks = [
        Check("Le titulaire a réellement demandé la récupération de son compte.", "RecoveryRequested"),
        Check("Son identité a été raisonnablement vérifiée par un canal de confiance déjà connu.", "RecoveryIdentity"),
        Check("L’adresse concernée est bien celle du compte sélectionné.", "RecoveryAddress"),
        Check("Le canal privé de remise du lien est confirmé.", "RecoveryChannel"),
        Check("Le titulaire sait qu’il devra choisir lui-même son nouveau mot de passe.", "RecoveryPassword")
    ];
    private readonly CheckBox[] recoveryWorkstation = [
        Check("Poste et compte Windows protégés ; aucune capture, transcription ni partage d’écran.", "RecoveryWorkstation"),
        Check("Autres administrations suspendues ; même dossier privé que Node et même version des outils.", "RecoveryExclusive"),
        Check("Dossier privé exclu des synchronisations et sauvegardes partagées non autorisées.", "RecoveryStorage"),
        Check("Cette demande individuelle de récupération est autorisée.", "RecoveryAuthorized"),
        Check("Préflight opérateur, habilitations et état des opérations précédentes réellement vérifiés.", "RecoveryPreflight"),
        Check("Dashboard PROD vérifié : projet, URL, callback exacts et durée du lien de 3 600 secondes.", "RecoveryExpiry")
    ];
    private readonly TextBox email = Input("RecipientEmail");
    private readonly TextBox confirmation = Input("ExactConfirmation");
    private readonly CheckBox notice = Check("La notice V1.1 a été remise avant la collecte ou la confirmation de l’adresse.", "Notice");
    private readonly CheckBox voluntary = Check("Le destinataire a personnellement demandé ou accepté de participer et confirmé son adresse.", "Voluntary");
    private readonly CheckBox channel = Check("Un canal privé de transmission du lien est convenu.", "PrivateChannel");
    private readonly CheckBox privatePost = Check("Poste et compte Windows protégés ; aucune capture, transcription ni partage d’écran.", "PrivateWorkstation");
    private readonly CheckBox exclusive = Check("Les autres administrations sont suspendues ; le même dossier privé est utilisé par l’outil Node.", "ExclusiveAdministration");
    private readonly CheckBox noCloud = Check("Le dossier privé est exclu des synchronisations et sauvegardes partagées non autorisées.", "NoSharedStorage");
    private readonly CheckBox opening = Check("La décision humaine d’ouverture autorise cette invitation individuelle.", "OpeningAuthorized");
    private readonly CheckBox prerequisites = Check("Préflight opérateur, identité, habilitations et portes de préouverture réellement vérifiés.", "PreflightChecked");
    private readonly CheckBox expiry = Check("Dashboard PROD vérifié : projet, Site URL et callback exacts ; durée des liens : 3 600 secondes.", "ExpiryChecked");
    private readonly DataGridView accounts = new();
    private readonly Panel unlockPanel = new() { Dock = DockStyle.Fill, AutoScroll = true, Padding = new Padding(20) };
    private readonly TabControl tabs = new() { Dock = DockStyle.Fill, Name = "Sections" };
    private readonly GroupBox review = new() { Text = "Confirmation individuelle", AutoSize = true, Dock = DockStyle.Top, Padding = new Padding(12), Visible = false };
    private readonly Label summary = TextLabel("");
    private readonly ProgressBar activity = new() { Dock = DockStyle.Bottom, Height = 4, Style = ProgressBarStyle.Marquee, Visible = false };

    public MainForm() : this(input => new AdminWorkflow(input)) { }

    internal MainForm(Func<UnlockInput, IAdminWorkflow> factory, Func<bool>? confirmHandover = null)
    {
        createWorkflow = factory;
        this.confirmHandover = confirmHandover ?? (() => MessageBox.Show(this,
            "Le lien a-t-il été effectivement remis au seul titulaire vérifié par le canal privé convenu ?",
            "Attestation de remise", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) == DialogResult.Yes);
        Text = "Mon BPREA Admin 1.1";
        Name = "MainForm";
        AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Segoe UI", 10);
        MinimumSize = new Size(780, 680);
        Size = new Size(1060, 880);
        StartPosition = FormStartPosition.CenterScreen;
        key.UseSystemPasswordChar = true;
        // Password edit blocks copying; allow the operator to paste a long key manually.
        key.MaxLength = 266;
        key.AccessibleName = "Clé administrative masquée";
        operatorEmail.Text = Environment.GetEnvironmentVariable("SUPABASE_PROD_OPERATOR_EMAIL") ?? "";
        privateDirectory.Text = Environment.GetEnvironmentVariable("SUPABASE_PROD_PRIVATE_DIR") ?? "";
        operatorFile.PlaceholderText = "Fichier operator.json existant et protégé";
        privateDirectory.PlaceholderText = "Dossier privé existant, hors dépôt et non partagé";
        email.PlaceholderText = "participant@exemple.fr";
        var header = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(20, 14, 20, 12), ColumnCount = 2 };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        var title = TextLabel("Mon BPREA Admin 1.1"); title.Font = new Font(Font.FontFamily, 19, FontStyle.Bold);
        header.Controls.Add(title, 0, 0); header.Controls.Add(lockSession, 1, 0);
        header.Controls.Add(TextLabel("Gestion privée des utilisateurs"), 0, 1);
        header.Controls.Add(connection, 0, 2); header.SetColumnSpan(connection, 2);
        header.Controls.Add(inventoryStatus, 0, 3); header.SetColumnSpan(inventoryStatus, 2);
        var footer = new Panel { Dock = DockStyle.Bottom, Height = 142, Padding = new Padding(20, 8, 20, 10) };
        message.Dock = DockStyle.Fill; message.AutoSize = false; message.Name = "OperationStatus";
        footer.Controls.Add(message);
        Controls.Add(tabs); Controls.Add(unlockPanel); Controls.Add(footer); Controls.Add(activity); Controls.Add(header);
        BuildUnlock(); BuildAccounts(); BuildInvitation(); BuildRecovery();
        unlock.Click += async (_, _) => await RunAsync(UnlockAsync);
        lockSession.Click += (_, _) => Lock();
        refresh.Click += async (_, _) => await RunAsync(RefreshAsync);
        prepare.Click += async (_, _) => await RunAsync(PrepareAsync);
        generate.Click += async (_, _) => await RunAsync(GenerateAsync);
        cancel.Click += (_, _) => { ResetOperation(); SetMessage("Préparation annulée. Aucun lien généré."); };
        openFolder.Click += (_, _) => OpenPrivateFolder();
        handover.Click += async (_, _) => await RunAsync(() => HandoverAsync(false));
        recoveryHandover.Click += async (_, _) => await RunAsync(() => HandoverAsync(true));
        recoveryOpenFolder.Click += (_, _) => OpenPrivateFolder();
        recoverAccess.Click += (_, _) => StartRecovery();
        prepareRecovery.Click += async (_, _) => await RunAsync(PrepareRecoveryAsync);
        generateRecovery.Click += async (_, _) => await RunAsync(GenerateRecoveryAsync);
        cancelRecovery.Click += (_, _) => { ResetRecovery(); SetMessage("Préparation annulée. Aucun lien généré."); };
        accounts.SelectionChanged += (_, _) => {
            if (busy) return;
            ResetRecovery(false);
            var target = SelectedAccount();
            selectionHint.Text = target is null ? "Sélectionnez un compte confirmé." : target.ConfirmedAt.HasValue && !target.RecoveryRestricted
                ? "Compte confirmé sélectionné. La récupération exige une nouvelle vérification d’identité."
                : "Invitation en attente ou état Auth à diagnostiquer : récupération désactivée.";
            UpdateControls();
        };
        foreach (var check in recoveryChecks.Concat(recoveryWorkstation)) check.CheckedChanged += (_, _) => {
            if (!busy && preparedRecovery is not null) { preparedRecovery = null; recoveryConfirmation.Clear(); recoveryReview.Visible = false; UpdateControls(); }
        };
        email.TextChanged += (_, _) => { if (!busy && !HasUnhandedReceipt) ResetOperation(); };
        foreach (var check in HumanChecks().Concat(WorkstationChecks())) check.CheckedChanged += (_, _) => {
            if (!busy && prepared is not null) ResetOperation(false);
        };
        FormClosing += (_, e) => { if (busy) { e.Cancel = true; SetMessage("Opération en cours. Attendez son résultat avant de fermer ou verrouiller."); } else Lock(); };
        UpdateControls();
    }

    private void BuildUnlock()
    {
        var layout = Vertical();
        layout.Controls.Add(TextLabel("Déverrouillage administratif"));
        layout.Controls.Add(TextLabel("La clé moderne sb_secret_ du seul projet PROD reste en mémoire pour cette session. Aucun enregistrement de la clé."));
        AddField(layout, "Clé administrateur", key);
        AddField(layout, "Adresse vérifiée du compte exploitant", operatorEmail);
        AddField(layout, "Dossier privé commun avec l’exécuteur Node", privateDirectory);
        var browseDirectory = Button("Choisir le dossier privé…", "BrowsePrivateDirectory");
        browseDirectory.Click += (_, _) => {
            using var dialog = new FolderBrowserDialog { Description = "Dossier privé existant (même dossier que l’outil Node)", UseDescriptionForTitle = true };
            if (dialog.ShowDialog(this) == DialogResult.OK) privateDirectory.Text = dialog.SelectedPath;
        };
        layout.Controls.Add(browseDirectory);
        AddField(layout, "Préflight opérateur privé (operator.json)", operatorFile);
        var browseFile = Button("Choisir operator.json…", "BrowseOperatorFile");
        browseFile.Click += (_, _) => {
            using var dialog = new OpenFileDialog { Title = "Préflight opérateur privé existant", Filter = "Configuration opérateur (operator.json)|operator.json", CheckFileExists = true };
            if (dialog.ShowDialog(this) == DialogResult.OK) operatorFile.Text = dialog.FileName;
        };
        layout.Controls.Add(browseFile);
        layout.Controls.Add(TextLabel("Le dossier et le préflight sont exigés pour inviter ou récupérer un accès. L’inventaire reste consultable sans eux. Les liens sont conservés sous EFS, hors dépôt. Le guide accompagne l’exécutable."));
        layout.Controls.Add(unlock);
        unlockPanel.Controls.Add(layout);
    }

    private void BuildAccounts()
    {
        var page = new TabPage("Comptes") { Padding = new Padding(14) };
        var bar = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true };
        bar.Controls.Add(refresh); bar.Controls.Add(recoverAccess); bar.Controls.Add(selectionHint);
        accounts.Name = "Accounts"; accounts.Dock = DockStyle.Fill;
        accounts.ReadOnly = true; accounts.AllowUserToAddRows = false; accounts.AllowUserToDeleteRows = false;
        accounts.AutoGenerateColumns = false; accounts.RowHeadersVisible = false;
        accounts.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
        accounts.MultiSelect = false;
        accounts.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        foreach (var (name, caption, weight) in new[] { ("Email", "Adresse email", 36f), ("State", "État", 24f), ("Created", "Création", 20f), ("Confirmed", "Confirmation", 20f) })
            accounts.Columns.Add(new DataGridViewTextBoxColumn { Name = name, HeaderText = caption, FillWeight = weight });
        page.Controls.Add(accounts); page.Controls.Add(bar); tabs.TabPages.Add(page);
    }

    private void BuildInvitation()
    {
        var page = new TabPage("Nouvelle invitation") { Padding = new Padding(14), AutoScroll = true };
        var layout = Vertical();
        layout.Controls.Add(TextLabel("Un participant adulte à la fois · 6 participants + 1 exploitant · Aucun email envoyé automatiquement."));
        AddField(layout, "Adresse du destinataire", email);
        layout.Controls.Add(TextLabel("Attestations de l’opérateur, à renouveler pour chaque invitation :"));
        foreach (var check in HumanChecks()) layout.Controls.Add(check);
        var workstationBox = new GroupBox { Text = "Prérequis d’exploitation et du poste", AutoSize = true, Dock = DockStyle.Top, Padding = new Padding(10) };
        var workstationLayout = Vertical(); foreach (var check in WorkstationChecks()) workstationLayout.Controls.Add(check);
        workstationBox.Controls.Add(workstationLayout); layout.Controls.Add(workstationBox);
        layout.Controls.Add(prepare);
        var reviewLayout = Vertical(); reviewLayout.Controls.Add(summary);
        reviewLayout.Controls.Add(TextLabel("Saisissez la phrase exacte affichée pour autoriser la génération irréversible :"));
        reviewLayout.Controls.Add(confirmation);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true };
        buttons.Controls.Add(cancel); buttons.Controls.Add(generate); reviewLayout.Controls.Add(buttons);
        review.Controls.Add(reviewLayout); layout.Controls.Add(review);
        var resultButtons = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true };
        resultButtons.Controls.Add(openFolder); resultButtons.Controls.Add(handover); layout.Controls.Add(resultButtons);
        page.Controls.Add(layout); tabs.TabPages.Add(page);
    }

    private void BuildRecovery()
    {
        var page = new TabPage("Récupération d’accès") { Padding = new Padding(14), AutoScroll = true };
        var layout = Vertical();
        recoveryEmail.ReadOnly = true;
        AddField(layout, "Compte sélectionné dans l’inventaire vérifié", recoveryEmail);
        layout.Controls.Add(TextLabel("Demande inhabituelle ou nouveau canal : recontactez le titulaire par un canal déjà établi. Aucune pièce d’identité systématique. Ne demandez ni mot de passe, JWT, code MFA ou lien de session."));
        layout.Controls.Add(TextLabel("Ces attestations sont vos contrôles humains ; elles ne constituent pas une vérification d’identité automatique. Renouvelez-les pour chaque demande :"));
        foreach (var check in recoveryChecks.Concat(recoveryWorkstation)) layout.Controls.Add(check);
        layout.Controls.Add(prepareRecovery);
        var reviewLayout = Vertical(); reviewLayout.Controls.Add(recoverySummary);
        reviewLayout.Controls.Add(TextLabel("Saisissez la phrase exacte pour confirmer cette seule génération :"));
        reviewLayout.Controls.Add(recoveryConfirmation);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true };
        buttons.Controls.Add(cancelRecovery); buttons.Controls.Add(generateRecovery); reviewLayout.Controls.Add(buttons);
        recoveryReview.Controls.Add(reviewLayout); layout.Controls.Add(recoveryReview);
        var results = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true };
        recoveryResult.Name = "RecoveryResult"; layout.Controls.Add(recoveryResult);
        results.Controls.Add(recoveryOpenFolder); results.Controls.Add(recoveryHandover); layout.Controls.Add(results);
        page.Controls.Add(layout); tabs.TabPages.Add(page);
    }

    private AuthAccount? SelectedAccount() => inventoryReady && accounts.SelectedRows.Count == 1 ? accounts.SelectedRows[0].Tag as AuthAccount : null;
    private void StartRecovery()
    {
        var target = SelectedAccount();
        if (busy || uncertainGeneration || HasUnhandedReceipt || target is null || !target.ConfirmedAt.HasValue || target.RecoveryRestricted) return;
        ResetOperation(); recoveryTarget = target; recoveryEmail.Text = target.Email;
        tabs.SelectedIndex = 2; UpdateControls(); recoveryChecks[0].Focus();
        SetMessage("Préparation de récupération : vérifiez la demande, l’identité et le canal connu avant toute génération.");
    }

    private async Task PrepareRecoveryAsync()
    {
        if (workflow is null || recoveryTarget is null || !inventoryReady) return;
        receipt = null; recoveryReceipt = null; receiptHandedOver = false; recoveryConfirmation.Clear();
        var h = recoveryChecks.Select(x => x.Checked).ToArray(); var w = recoveryWorkstation.Select(x => x.Checked).ToArray();
        preparedRecovery = await workflow.PrepareRecoveryAsync(recoveryTarget, new(h[0], h[1], h[2], h[3], h[4]), new(w[0], w[1], w[2], w[3], w[4], w[5]));
        recoverySummary.Text = $"Mon BPREA PROD · Opération : récupération de mot de passe\nAdresse : {preparedRecovery.Email}\n" +
            $"Identifiant du compte validé en interne · Même UUID conservé\nContrôle d’identité et canal de remise attestés\nInventaire récent : {FormatDate(preparedRecovery.Inventory.ObservedAt)} · Stockage privé conforme\n\n" + preparedRecovery.ConfirmationText;
        recoveryReview.Visible = true; recoveryConfirmation.Focus(); tabs.TabPages[2].ScrollControlIntoView(recoveryReview);
        SetMessage("Préflight réussi. Aucun lien généré. Confirmation valable moins de cinq minutes ; inventaire et UUID relus sous verrou.");
    }

    private async Task GenerateRecoveryAsync()
    {
        if (workflow is null || preparedRecovery is null) return;
        var operation = preparedRecovery; preparedRecovery = null; recoveryReview.Visible = false;
        recoveryReceipt = await workflow.GenerateRecoveryAsync(operation, recoveryConfirmation.Text);
        recoveryReceiptEmail = operation.Email; recoveryReceiptHandedOver = false;
        recoveryConfirmation.Clear(); foreach (var check in recoveryChecks.Concat(recoveryWorkstation)) check.Checked = false;
        inventoryReady = false; recoveryTarget = null;
        recoveryResult.Text = $"Compte : {operation.Email} · Fichier privé : auth-link-{recoveryReceipt.OperationId:D}.txt\nLien de récupération généré et enregistré dans le dossier privé. Aucun email n’a été envoyé. Remettez-le au titulaire vérifié, qui choisit seul son mot de passe. Validité limitée : réglages PROD à vérifier. Génération ≠ mot de passe changé. Ne l’ouvrez pas sur le poste administrateur.";
        SetMessage("Lien de récupération enregistré dans le dossier privé. Remise au titulaire à acquitter séparément.");
        inventoryStatus.Text = "Lien généré · Remise à acquitter séparément · Actualisation en lecture seule disponible.";
    }

    private async Task HandoverAsync(bool recovery)
    {
        var id = recovery ? recoveryReceipt?.OperationId : receipt?.OperationId;
        if (workflow is null || id is null || !confirmHandover()) return;
        await workflow.MarkHandedOverAsync(id.Value);
        if (recovery) recoveryReceiptHandedOver = true; else receiptHandedOver = true;
        SetMessage("Remise déclarée séparément dans le journal privé. L’activation ou le changement de mot de passe reste à vérifier.");
    }

    private void ResetRecovery(bool clearReceipt = true)
    {
        preparedRecovery = null; recoveryTarget = null;
        if (clearReceipt) { recoveryReceipt = null; recoveryReceiptEmail = null; recoveryReceiptHandedOver = false; recoveryResult.Text = ""; }
        recoveryEmail.Text = recoveryReceiptEmail ?? ""; recoveryConfirmation.Clear(); recoveryReview.Visible = false;
        foreach (var check in recoveryChecks.Concat(recoveryWorkstation)) check.Checked = false;
        UpdateControls();
    }

    private async Task UnlockAsync()
    {
        workflow?.Dispose(); workflow = null;
        // Clear the masked control immediately. Managed strings cannot promise full memory erasure.
        try { workflow = createWorkflow(new UnlockInput(key.Text, operatorEmail.Text, privateDirectory.Text, operatorFile.Text)); }
        finally { key.Clear(); }
        try { await RefreshAsync(); }
        catch { workflow?.Dispose(); workflow = null; throw; }
        connection.Text = "PROD · Session administrative déverrouillée";
    }

    private async Task RefreshAsync()
    {
        if (workflow is null) return;
        inventoryReady = false; ResetRecovery(false); accounts.Rows.Clear(); inventoryStatus.Text = "Lecture de l’inventaire… Générations suspendues.";
        prepared = null; review.Visible = false;
        try {
            var inventory = await workflow.RefreshAsync();
            foreach (var account in inventory.Accounts)
            {
                var row = accounts.Rows.Add(account.Email, account.State, FormatDate(account.CreatedAt), FormatDate(account.ConfirmedAt));
                accounts.Rows[row].Tag = account;
            }
            accounts.ClearSelection(); inventoryReady = true;
            inventoryStatus.Text = $"{inventory.Count}/7 comptes · {inventory.AvailableParticipantPlaces} place(s) participant disponible(s) · " +
                $"Exploitant : {(inventory.OperatorPresent ? "présent" : "absent, 1 place réservée")} · Lu le {FormatDate(inventory.ObservedAt)}";
            SetMessage("Inventaire complet relu. La confirmation de l’adresse ne prouve pas une connexion actuelle.");
        } catch { inventoryStatus.Text = "Inventaire indisponible ou incomplet · Générations bloquées"; throw; }
    }

    private async Task PrepareAsync()
    {
        if (workflow is null) return;
        ResetRecovery(); receipt = null; receiptHandedOver = false; confirmation.Clear();
        prepared = await workflow.PrepareAsync(email.Text,
            new HumanAttestations(notice.Checked, voluntary.Checked, channel.Checked),
            new WorkstationAttestations(privatePost.Checked, exclusive.Checked, noCloud.Checked, opening.Checked, prerequisites.Checked, expiry.Checked));
        summary.Text = $"Mon BPREA PROD · Opération : invitation\nDestinataire : {prepared.Email}\n" +
            $"{prepared.Inventory.Count}/7 comptes · {prepared.Inventory.AvailableParticipantPlaces} place(s) participant avant génération\n" +
            $"Préflight réussi · Inventaire : {FormatDate(prepared.Inventory.ObservedAt)}\n" +
            "Conséquence : création possible et immédiate d’un utilisateur Auth et de son profil.\n\n" + prepared.ConfirmationText;
        review.Visible = true; confirmation.Focus(); tabs.TabPages[1].ScrollControlIntoView(review);
        SetMessage("Préparation seule : aucun compte ni lien créé. Confirmation valable au plus cinq minutes, inventaire revérifié avant génération.");
    }

    private async Task GenerateAsync()
    {
        if (workflow is null || prepared is null) return;
        var operation = prepared;
        prepared = null; review.Visible = false;
        receipt = await workflow.GenerateAsync(operation, confirmation.Text);
        confirmation.Clear(); ResetChecks(); email.Clear();
        SetMessage("Invitation générée et conservée dans le dossier privé. Aucun email envoyé. Remettez le lien manuellement ; durée d’une heure selon votre vérification PROD. Le participant choisit seul son mot de passe. Création Auth ≠ activation.");
        // Refresh is a separate read action, preserving the generation result and its receipt.
        inventoryStatus.Text = "Invitation générée · Actualisez l’inventaire en lecture seule.";
    }

    private async Task RunAsync(Func<Task> action)
    {
        if (busy) return;
        busy = true; UpdateControls();
        try { await action(); }
        catch (AdminException error) { SetMessage(AdminMessages.For(error.Code)); if (error.Code is "uncertain" or "recovery_uncertain" or "pending") { uncertainGeneration = true; prepared = null; preparedRecovery = null; review.Visible = false; recoveryReview.Visible = false; } }
        catch { SetMessage("Opération interrompue. Aucun détail sensible affiché. Vérifiez l’inventaire en lecture seule ; ne répétez pas une génération incertaine."); }
        finally { busy = false; UpdateControls(); }
    }

    private void Lock()
    {
        if (busy) return;
        workflow?.Dispose(); workflow = null; key.Clear();
        uncertainGeneration = false;
        inventoryReady = false; ResetOperation(); accounts.Rows.Clear();
        inventoryStatus.Text = "Inventaire non lu · Capacité maximale : 7 comptes";
        connection.Text = "PROD · Session verrouillée";
        SetMessage("Session verrouillée. La clé n’est pas conservée sur disque. Les réservations privées restent conservées.");
        UpdateControls(); key.Focus();
    }

    private void ResetOperation(bool resetChecks = true)
    {
        ResetRecovery(); prepared = null; receipt = null; receiptHandedOver = false; confirmation.Clear(); review.Visible = false;
        if (resetChecks) ResetChecks();
        UpdateControls();
    }
    private void ResetChecks() { foreach (var check in HumanChecks().Concat(WorkstationChecks())) check.Checked = false; }
    private void UpdateControls()
    {
        var connected = workflow is not null;
        unlockPanel.Visible = !connected; tabs.Visible = connected;
        unlockPanel.Enabled = !busy; tabs.Enabled = !busy;
        lockSession.Enabled = connected && !busy; activity.Visible = busy;
        refresh.Enabled = connected && !busy;
        prepare.Enabled = connected && inventoryReady && !busy && prepared is null && !uncertainGeneration && !HasUnhandedReceipt;
        var selected = SelectedAccount();
        recoverAccess.Enabled = connected && !busy && !uncertainGeneration && !HasUnhandedReceipt && selected?.ConfirmedAt is not null && !selected.RecoveryRestricted;
        prepareRecovery.Enabled = connected && inventoryReady && !busy && !uncertainGeneration && recoveryTarget is not null && preparedRecovery is null;
        generateRecovery.Enabled = connected && !busy && !uncertainGeneration && preparedRecovery is not null;
        recoveryOpenFolder.Enabled = connected && !busy && recoveryReceipt is not null;
        recoveryHandover.Enabled = connected && !busy && recoveryReceipt is not null && !recoveryReceiptHandedOver;
        generate.Enabled = connected && !busy && prepared is not null;
        openFolder.Enabled = connected && !busy && receipt is not null;
        handover.Enabled = connected && !busy && receipt is not null && !receiptHandedOver;
    }
    private void OpenPrivateFolder()
    {
        if (receipt is null && recoveryReceipt is null) return;
        try { workflow?.OpenPrivateFolder(); }
        catch { SetMessage("Ouverture du dossier privé refusée. Vérifiez ses protections avant de le consulter."); }
    }
    private void SetMessage(string text) => message.Text = text;
    private IEnumerable<CheckBox> HumanChecks() => [notice, voluntary, channel];
    private IEnumerable<CheckBox> WorkstationChecks() => [privatePost, exclusive, noCloud, opening, prerequisites, expiry];
    private static string FormatDate(DateTimeOffset? date) => date?.ToLocalTime().ToString("dd/MM/yyyy HH:mm:ss") ?? "—";
    private static TextBox Input(string name) => new() { Name = name, Dock = DockStyle.Top, Width = 650, Margin = new Padding(0, 4, 0, 10) };
    private static Label TextLabel(string text) => new() { Text = text, AutoSize = true, Dock = DockStyle.Top, Margin = new Padding(0, 4, 0, 10), MaximumSize = new Size(940, 0) };
    private static CheckBox Check(string text, string name) => new() { Text = text, Name = name, AutoSize = true, MaximumSize = new Size(900, 0), Dock = DockStyle.Top, Margin = new Padding(0, 5, 0, 5) };
    private static Button Button(string text, string name) => new() { Text = text, Name = name, AutoSize = true, Padding = new Padding(12, 4, 12, 4), Margin = new Padding(0, 5, 10, 8) };
    private static TableLayoutPanel Vertical() => new() { Dock = DockStyle.Top, AutoSize = true, ColumnCount = 1, GrowStyle = TableLayoutPanelGrowStyle.AddRows };
    private static void AddField(TableLayoutPanel panel, string text, TextBox field) { panel.Controls.Add(TextLabel(text)); panel.Controls.Add(field); }
}
