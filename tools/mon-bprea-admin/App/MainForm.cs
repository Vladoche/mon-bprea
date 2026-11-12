using MonBprea.Admin.Core;

namespace MonBprea.Admin.App;

public sealed class MainForm : Form
{
    private readonly Func<UnlockInput, IAdminWorkflow> createWorkflow;
    private IAdminWorkflow? workflow;
    private PreparedInvitation? prepared;
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

    internal MainForm(Func<UnlockInput, IAdminWorkflow> factory)
    {
        createWorkflow = factory;
        Text = "Mon BPREA Admin";
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
        var title = TextLabel("Mon BPREA Admin"); title.Font = new Font(Font.FontFamily, 19, FontStyle.Bold);
        header.Controls.Add(title, 0, 0); header.Controls.Add(lockSession, 1, 0);
        header.Controls.Add(TextLabel("Gestion privée des utilisateurs"), 0, 1);
        header.Controls.Add(connection, 0, 2); header.SetColumnSpan(connection, 2);
        header.Controls.Add(inventoryStatus, 0, 3); header.SetColumnSpan(inventoryStatus, 2);
        var footer = new Panel { Dock = DockStyle.Bottom, Height = 94, Padding = new Padding(20, 8, 20, 10) };
        message.Dock = DockStyle.Fill; message.AutoSize = false; message.Name = "OperationStatus";
        footer.Controls.Add(message);
        Controls.Add(tabs); Controls.Add(unlockPanel); Controls.Add(footer); Controls.Add(activity); Controls.Add(header);
        BuildUnlock(); BuildAccounts(); BuildInvitation();
        unlock.Click += async (_, _) => await RunAsync(UnlockAsync);
        lockSession.Click += (_, _) => Lock();
        refresh.Click += async (_, _) => await RunAsync(RefreshAsync);
        prepare.Click += async (_, _) => await RunAsync(PrepareAsync);
        generate.Click += async (_, _) => await RunAsync(GenerateAsync);
        cancel.Click += (_, _) => { ResetOperation(); SetMessage("Préparation annulée. Aucun lien généré."); };
        openFolder.Click += (_, _) => OpenPrivateFolder();
        handover.Click += async (_, _) => await RunAsync(async () => {
            if (receipt is null || workflow is null) return;
            if (MessageBox.Show(this, "Le lien a-t-il été effectivement remis au seul destinataire par le canal privé convenu ?",
                "Attestation de remise", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
            await workflow.MarkHandedOverAsync(receipt.OperationId);
            receiptHandedOver = true; SetMessage("Remise déclarée séparément dans le journal privé. L’activation reste à vérifier.");
        });
        email.TextChanged += (_, _) => { if (!busy) ResetOperation(); };
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
        layout.Controls.Add(TextLabel("Le dossier et le préflight ne sont exigés que pour inviter. L’inventaire reste consultable sans eux. Les liens sont conservés sous EFS, hors dépôt. Le guide accompagne l’exécutable."));
        layout.Controls.Add(unlock);
        unlockPanel.Controls.Add(layout);
    }

    private void BuildAccounts()
    {
        var page = new TabPage("Comptes") { Padding = new Padding(14) };
        var bar = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true };
        bar.Controls.Add(refresh);
        accounts.Name = "Accounts"; accounts.Dock = DockStyle.Fill;
        accounts.ReadOnly = true; accounts.AllowUserToAddRows = false; accounts.AllowUserToDeleteRows = false;
        accounts.AutoGenerateColumns = false; accounts.RowHeadersVisible = false;
        accounts.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
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
        accounts.Rows.Clear(); inventoryStatus.Text = "Lecture de l’inventaire… Invitations suspendues.";
        prepared = null; review.Visible = false;
        try {
            var inventory = await workflow.RefreshAsync();
            foreach (var account in inventory.Accounts)
                accounts.Rows.Add(account.Email, account.State, FormatDate(account.CreatedAt), FormatDate(account.ConfirmedAt));
            inventoryStatus.Text = $"{inventory.Count}/7 comptes · {inventory.AvailableParticipantPlaces} place(s) participant disponible(s) · " +
                $"Exploitant : {(inventory.OperatorPresent ? "présent" : "absent, 1 place réservée")} · Lu le {FormatDate(inventory.ObservedAt)}";
            SetMessage("Inventaire complet relu. La confirmation de l’adresse ne prouve pas une connexion actuelle.");
        } catch { inventoryStatus.Text = "Inventaire indisponible ou incomplet · Invitations bloquées"; throw; }
    }

    private async Task PrepareAsync()
    {
        if (workflow is null) return;
        receipt = null; receiptHandedOver = false; confirmation.Clear();
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
        catch (AdminException error) { SetMessage(AdminMessages.For(error.Code)); if (error.Code is "uncertain" or "pending") { uncertainGeneration = true; prepared = null; review.Visible = false; } }
        catch { SetMessage("Opération interrompue. Aucun détail sensible affiché. Vérifiez l’inventaire en lecture seule ; ne répétez pas une génération incertaine."); }
        finally { busy = false; UpdateControls(); }
    }

    private void Lock()
    {
        if (busy) return;
        workflow?.Dispose(); workflow = null; key.Clear();
        uncertainGeneration = false;
        ResetOperation(); accounts.Rows.Clear();
        inventoryStatus.Text = "Inventaire non lu · Capacité maximale : 7 comptes";
        connection.Text = "PROD · Session verrouillée";
        SetMessage("Session verrouillée. La clé n’est pas conservée sur disque. Les réservations privées restent conservées.");
        UpdateControls(); key.Focus();
    }

    private void ResetOperation(bool resetChecks = true)
    {
        prepared = null; receipt = null; receiptHandedOver = false; confirmation.Clear(); review.Visible = false;
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
        prepare.Enabled = connected && !busy && prepared is null && !uncertainGeneration;
        generate.Enabled = connected && !busy && prepared is not null;
        openFolder.Enabled = connected && !busy && receipt is not null;
        handover.Enabled = connected && !busy && receipt is not null && !receiptHandedOver;
    }
    private void OpenPrivateFolder()
    {
        if (receipt is null) return;
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
