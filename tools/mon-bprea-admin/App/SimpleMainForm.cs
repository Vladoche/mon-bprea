using System.Diagnostics;
using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.App;

internal sealed partial class SimpleMainForm : Form
{
    private readonly AdminTarget target;
    private readonly IAdminCredentialVault vault;
    private readonly Func<string, bool, Task<ISimpleWorkflow>> open;
    private readonly Func<string, string, bool> confirm;
    private readonly Action<string> copy;
    private readonly Panel content = new() { Dock = DockStyle.Fill, AutoScroll = true, Padding = new Padding(38, 22, 38, 28) };
    private readonly StatusLabel message = new() { Name = "Status", AutoSize = true, MaximumSize = new Size(620, 0), AccessibleRole = AccessibleRole.Alert };
    private ISimpleWorkflow? workflow;
    private bool busy;
    private bool startup;

    public SimpleMainForm(AdminTarget target, IAdminCredentialVault vault, Func<string, bool, Task<ISimpleWorkflow>> open,
        Func<string, string, bool>? confirmation = null, Action<string>? clipboard = null,
        Func<AutomaticPrivateStore>? productionHistory = null, Func<ProductionBackup>? productionBackup = null)
    {
        this.target = target; this.vault = vault; this.open = open;
        this.productionHistory = productionHistory; this.productionBackup = productionBackup;
        confirm = confirmation ?? ((text, title) => ConfirmationForm.Ask(this, text, title,
            title == "Confirmer la suppression" ? "Confirmer la suppression" : "Confirmer cette action"));
        copy = clipboard ?? (text => Clipboard.SetText(text));
        Text = $"Mon BPREA Admin {Application.ProductVersion.Split('+')[0]}" + (target.IsLocal ? " — QUALIFICATION LOCALE · COMPTES FICTIFS" : "");
        Name = "MonBpreaAdminV2"; AccessibleName = Text;
        ClientSize = new Size(760, 650); MinimumSize = new Size(620, 560);
        AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Segoe UI", 11);
        var header = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 65, Padding = new Padding(24, 10, 24, 8), AutoSize = false, WrapContents = false };
        header.Controls.Add(new Label { Text = "Mon BPREA Admin", AutoSize = true, Font = new Font(Font, FontStyle.Bold), Margin = new Padding(12, 10, 80, 0) });
        header.Controls.Add(Button("Paramètres", "Settings", () => Settings(), large: false));
        header.Controls.Add(Button("Aide", "Help", () => Help(), large: false));
        Controls.Add(content); Controls.Add(header);
        Shown += async (_, _) => { if (!startup) { startup = true; await Start(); } };
        StartMaintenanceTimer();
        FormClosing += (_, e) => {
            if (busy) { e.Cancel = true; return; }
            maintenanceTimer?.Dispose(); workflow?.Dispose(); workflow = null;
        };
    }

    private async Task Start()
    {
        try
        {
            var saved = vault.Read();
            if (saved is null)
            {
                Setup();
                await MaintainOnOpen();
                if (lastSystem?.HistoryProblem is not null) ShowSystem(lastSystem);
                return;
            }
            await Run(async () => {
                try { workflow = await open(saved, false); Home(); await MaintainOnOpen(inOperation: true); }
                catch
                {
                    if (productionBackup is null) Setup();
                    else ShowSystem(lastSystem = await ReadSystem(renew: false));
                    throw; // Attach the explanation before Run handles the error.
                }
            });
        }
        catch (Exception error) { Setup(); Error(error); }
    }

    private FlowLayoutPanel Page(string title, bool back = true)
    {
        // Dispose old controls so a hidden textbox cannot retain a key or link.
        message.Parent?.Controls.Remove(message);
        foreach (Control control in content.Controls.Cast<Control>().ToArray()) control.Dispose();
        content.Controls.Clear();
        var layout = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, FlowDirection = FlowDirection.TopDown,
            WrapContents = false, Padding = new Padding(0), Name = "CurrentPage" };
        content.Controls.Add(layout);
        layout.ControlAdded += (_, _) => ResizeFields();
        if (back && workflow is not null) layout.Controls.Add(Button("← Accueil", "Home", Home, false));
        layout.Controls.Add(Label(title, heading: true));
        if (target.IsLocal) layout.Controls.Add(Label("Qualification locale — uniquement des comptes fictifs", "LocalMode"));
        return layout;
    }

    private void Home()
    {
        AcceptButton = null;
        var page = Page("Que souhaites-tu faire ?", false);
        page.Controls.Add(Button("Créer un compte", "CreateAccount", () => _ = Run(Create)));
        page.Controls.Add(Button("Récupérer un compte", "RecoverAccount", () => _ = Accounts(false)));
        page.Controls.Add(Button("Supprimer un compte", "DeleteAccount", () => _ = Accounts(true)));
        AttachMessage(page);
    }

    private void Setup(bool replacing = false)
    {
        var page = Page(replacing ? "Remplacer la clé" : "Bienvenue", replacing);
        page.Controls.Add(Label("Saisis la clé une seule fois. Windows la mémorisera de façon chiffrée pour ton compte sur cet ordinateur."));
        page.Controls.Add(Label("Clé secrète", "KeyLabel"));
        var key = Input("AdminKey"); key.UseSystemPasswordChar = true; key.AccessibleName = "Clé secrète";
        page.Controls.Add(key);
        var validate = Button("Continuer", "Configure", () => _ = Run(async () => {
            var value = key.Text; key.Clear();
            var next = await open(value, true);
            workflow?.Dispose(); workflow = next; Home();
            await MaintainOnOpen(inOperation: true);
            if (lastSystem is not null) ShowSystem(lastSystem);
        }));
        page.Controls.Add(validate); AttachMessage(page); AcceptButton = validate; key.Select();
    }

    private async Task Create()
    {
        var inventory = await workflow!.RefreshAsync();
        AcceptButton = null;
        var page = Page("Créer un compte");
        page.Controls.Add(Label($"Places restantes pour les participants : {inventory.AvailableParticipantPlaces} (place exploitant réservée).",
            "AvailableParticipantPlaces"));
        page.Controls.Add(Label("Adresse e-mail du camarade"));
        var email = Input("RecipientEmail"); email.AccessibleName = "Adresse e-mail du camarade"; page.Controls.Add(email);
        var create = Button("Créer le lien d’activation", "GenerateInvite", () => _ = Run(async () => {
            try { ShowInvitationResult(await workflow!.CreateAsync(email.Text)); }
            catch (AdminException error) when (error.Code == "invitation_existing")
            {
                var address = AdminContract.NormalizeEmail(email.Text);
                var accounts = await workflow!.RefreshAsync();
                var existing = accounts.Accounts.SingleOrDefault(a => a.Email == address) ?? throw new AdminException("invitation_changed");
                await Recovery(existing, fromCreate: true);
            }
            catch (AdminException error) when (error.Code == "exists")
            {
                SetMessage("Ce compte existe déjà. Utilise la récupération de compte.");
            }
            catch (AdminException error) when (error.Code is "otp_unverified" or "otp_duration")
            {
                InvitationSettings(error.Message);
            }
            catch (AdminException error) when (productionBackup is not null && error.Code.StartsWith("backup_", StringComparison.Ordinal))
            {
                ShowSystem(lastSystem = await ReadSystem(renew: false));
            }
        }));
        page.Controls.Add(create); AttachMessage(page); AcceptButton = create; email.Select();
    }

    private async Task Accounts(bool deleting)
    {
        await Run(async () => {
            var accounts = await workflow!.RefreshAsync();
            var page = Page(deleting ? "Supprimer un compte" : "Récupérer un compte");
            page.Controls.Add(Label("Choisis la personne concernée."));
            var list = new ListBox { Name = "Accounts", Width = 620, Height = 190, IntegralHeight = false, AccessibleName = "Comptes existants",
                DisplayMember = nameof(AuthAccount.Email) };
            foreach (var account in accounts.Accounts) list.Items.Add(account);
            list.SelectedIndex = -1; page.Controls.Add(list);
            var next = Button(deleting ? "Supprimer ce compte" : "Continuer", "SelectAccount", () => {
                if (list.SelectedItem is not AuthAccount selected) { SetMessage("Choisis d’abord un compte."); return; }
                if (deleting)
                {
                    if (confirm($"Confirmer la suppression du compte de {selected.Email} et le traitement de ses données associées ?", "Confirmer la suppression"))
                        _ = Run(async () => ShowResult(await workflow!.DeleteAsync(selected)));
                }
                else _ = Run(() => Recovery(selected));
            });
            page.Controls.Add(next); AttachMessage(page); AcceptButton = next; list.Select();
        });
    }

    private async Task Recovery(AuthAccount selected, bool fromCreate = false)
    {
        if (!selected.ConfirmedAt.HasValue)
        {
            try { ShowInvitation(await workflow!.ReviewInvitationAsync(selected), fromCreate); }
            catch (AdminException error) when (error.Code == "invitation_activated")
            {
                var inventory = await workflow!.RefreshAsync();
                var current = inventory.Accounts.Single(a => a.Id == selected.Id && a.Email == selected.Email);
                ShowRecovery(current);
                SetMessage(error.Message);
            }
            return;
        }
        ShowRecovery(selected);
    }

    private void ShowRecovery(AuthAccount selected)
    {
        var page = Page("Récupérer un compte");
        page.Controls.Add(Label(selected.Email, "SelectedEmail"));
        page.Controls.Add(Label("Échange avec ton camarade par son canal habituel avant toute récupération. Ne demande jamais son mot de passe."));
        page.Controls.Add(Button("Réinitialiser le mot de passe", "ResetPassword", () => _ = Run(async () =>
            ShowResult(await workflow!.RecoverAsync(selected, SimpleOperationKind.Password, null, null), async () => {
                var current = await workflow.RefreshAsync();
                var verified = current.Accounts.SingleOrDefault(a => a.Id == selected.Id && a.Email == selected.Email) ?? throw new AdminException("missing");
                return await workflow.RecoverAsync(verified, SimpleOperationKind.Password, null, null, newLink: true);
            }))));
        page.Controls.Add(Button("Modifier l’adresse e-mail", "ChangeEmail", () => ChangeEmail(selected, false)));
        page.Controls.Add(Button("Modifier l’adresse e-mail et le mot de passe", "ChangeBoth", () => ChangeEmail(selected, true)));
        AttachMessage(page); AcceptButton = null;
    }

    private void ShowInvitation(InvitationReview review, bool fromCreate)
    {
        var page = Page(fromCreate ? "Compte déjà invité" : "Récupérer un compte");
        page.Controls.Add(Label(review.Account.Email, "SelectedEmail"));
        if (fromCreate) page.Controls.Add(Label("Ce camarade possède déjà une invitation en attente."));
        page.Controls.Add(Label(review.State == InvitationState.Expired ? "Invitation expirée" : "Invitation en attente d’activation", "InvitationState"));
        if (review.State == InvitationState.DurationUnknown) page.Controls.Add(Label("Durée du lien non vérifiée"));
        if (review.State == InvitationState.Expired)
            page.Controls.Add(Label("Le lien précédent a expiré. Tu peux en créer un nouveau sans supprimer le compte."));
        if (review.State == InvitationState.Pending)
            AddInvitationCopy(page, review.Account, review.LatestOperation);
        var renew = Button("Créer un nouveau lien d’activation", "RenewInvitation", () => {
            if (!confirm($"Créer un nouveau lien pour {review.Account.Email} ? Le lien précédent sera remplacé. Le compte et ses données sont conservés.",
                "Confirmer le renouvellement")) return;
            _ = Run(async () => {
                try { ShowInvitationResult(await workflow!.RenewInvitationAsync(review)); }
                catch (AdminException error) when (error.Code is "otp_unverified" or "otp_duration") { InvitationSettings(error.Message); }
                catch (AdminException error) when (error.Code == "invitation_activated") { await Recovery(review.Account); }
                catch (AdminException error) when (productionBackup is not null && error.Code.StartsWith("backup_", StringComparison.Ordinal))
                { ShowSystem(lastSystem = await ReadSystem(renew: false)); }
            });
        });
        page.Controls.Add(renew);
        AttachMessage(page); AcceptButton = null;
        renew.Select();
    }

    private void ShowInvitationResult(SimpleResult result)
    {
        var page = Page(result.Title);
        var link = result.Links.Single();
        var account = new AuthAccount(result.AccountId!, link.Address, null, null, null);
        page.Controls.Add(Label(result.Detail, "ResultDetail"));
        page.Controls.Add(Label(link.Address, "LinkRecipient"));
        page.Controls.Add(Label(result.ExpirySeconds switch {
            AdminContract.InvitationExpirySeconds => "Lien d’activation valable 24 heures",
            int seconds => $"Lien d’activation valable {seconds} secondes",
            _ => "Durée du lien non vérifiée"
        }, "LinkExpiry"));
        if (result.ExpirySeconds is not null) AddInvitationCopy(page, account, result.Operation);
        page.Controls.Add(Button("Terminer", "Done", Home, false)); AttachMessage(page); AcceptButton = null;
    }

    private void AddInvitationCopy(Control page, AuthAccount account, Guid operation)
    {
        page.Controls.Add(Button("Copier le lien", "CopyLink", () => _ = Run(async () => {
            PersonalLink link;
            try { link = await workflow!.ReadInvitationLinkAsync(account, operation); }
            catch (AdminException error) when (error.Code is "invitation_unusable" or "invitation_changed" or "invitation_activated")
            {
                await Recovery(account);
                SetMessage(error.Message);
                return;
            }
            try { copy(link.Value); SetMessage("Lien copié. Transmets-le uniquement à ton camarade."); }
            catch { SetMessage("La copie a échoué. Réessaie avec le bouton Copier le lien."); }
        }), false));
    }

    private void ChangeEmail(AuthAccount selected, bool password)
    {
        var page = Page(password ? "Modifier l’adresse et le mot de passe" : "Modifier l’adresse e-mail");
        page.Controls.Add(Label(selected.Email, "SelectedEmail"));
        page.Controls.Add(Label("Nouvelle adresse e-mail")); var next = Input("NewEmail"); next.AccessibleName = "Nouvelle adresse e-mail";
        page.Controls.Add(next);
        var change = Button("Continuer", "ConfirmEmailChange", () => {
            string address;
            try { address = AdminContract.NormalizeEmail(next.Text); } catch (Exception e) { Error(e); return; }
            if (!confirm($"Après avoir joint ton camarade par son canal habituel, confirme sa nouvelle adresse :\n\n{address}\n\nContinuer valide cette adresse sans demander de message à l’ancienne boîte. Si son identité reste douteuse, annule.", "Vérifier le titulaire et l’adresse")) return;
            var decision = new KnownChannelDecision(selected.Id, address, DateTimeOffset.UtcNow);
            _ = Run(async () => ShowResult(await workflow!.RecoverAsync(selected,
                password ? SimpleOperationKind.EmailAndPassword : SimpleOperationKind.Email, address, decision)));
        });
        page.Controls.Add(change); AttachMessage(page); AcceptButton = change; next.Select();
    }

    private void ShowResult(SimpleResult result, Func<Task<SimpleResult>>? regenerate = null)
    {
        var page = Page(result.Title);
        page.Controls.Add(Label(result.Detail, "ResultDetail"));
        foreach (var link in result.Links)
        {
            page.Controls.Add(Label(link.Address, "LinkRecipient"));
            var field = Input("PersonalLink"); field.ReadOnly = true; field.Text = link.Value; field.AccessibleName = "Lien personnel";
            page.Controls.Add(field);
            page.Controls.Add(Button("Copier le lien", "CopyLink", () => {
                try { copy(link.Value); SetMessage("Lien copié. Transmets-le uniquement à ton camarade."); }
                catch { SetMessage("La copie n’a pas réussi. Sélectionne le lien et copie-le au clavier."); }
            }, false));
        }
        if (result.Links.Count > 0)
            page.Controls.Add(Label(result.ExpirySeconds is int seconds ? $"Validité vérifiée : {seconds} secondes à compter de la création ({result.CreatedAt.ToLocalTime():HH:mm})."
                : "Durée de validité non communiquée par le service. La connexion actuelle ne permet pas de la vérifier.", "LinkExpiry"));
        if (result.Reused && regenerate is not null)
        {
            page.Controls.Add(Label("Le lien précédent est retrouvé sans en générer un autre. S’il a déjà été utilisé ou a expiré, crée un nouveau lien à la demande du titulaire."));
            page.Controls.Add(Button("Créer un nouveau lien", "RegenerateRecovery", () => {
                if (confirm("Le lien précédent sera remplacé. Continuer uniquement pour une nouvelle demande du titulaire vérifié par le canal habituel.", "Créer un nouveau lien"))
                    _ = Run(async () => ShowResult(await regenerate()));
            }, false));
        }
        page.Controls.Add(Button("Terminer", "Done", Home, false)); AttachMessage(page); AcceptButton = null;
    }

    private void Settings()
    {
        if (busy) return;
        var page = Page("Paramètres");
        page.Controls.Add(Button("Remplacer la clé", "ReplaceKey", () => Setup(true)));
        page.Controls.Add(Button("Supprimer la clé enregistrée", "RemoveKey", () => {
            try { vault.Delete(); if (vault.Read() is not null) throw new AdminException("credential"); workflow?.Dispose(); workflow = null; Setup(); }
            catch (Exception e) { Error(e); }
        }));
        page.Controls.Add(Button("Vérifier la connexion", "CheckConnection", () => _ = Run(async () => {
            if (workflow is null) throw new AdminException("key");
            await workflow.RefreshAsync(); SetMessage("La connexion fonctionne. Les protections d’accès ont été vérifiées.");
        })));
        if (productionBackup is not null)
            page.Controls.Add(Button("État du système", "SystemState", () => _ = OpenSystem(), false));
        else page.Controls.Add(Button("Diagnostic", "Diagnostics", () => {
            var diagnostic = Page("Diagnostic");
            diagnostic.Controls.Add(Label(target.IsLocal ? "Cible : stack locale isolée. Coffre et historique séparés du service réel."
                : "Cible : Mon BPREA, projet fixe. Aucune cible alternative. La suppression du service réel reste bloquée tant que les contrôles de données et sauvegardes ne sont pas qualifiés."));
            diagnostic.Controls.Add(Label("Le stockage utilise les protections Windows du compte courant. Les opérations sans résultat certain restent conservées et bloquent les nouveaux essais. Aucun secret n’est inclus dans ce diagnostic."));
        }, false));
        if (!target.IsLocal && workflow is not null)
            page.Controls.Add(Button("Durée des liens d’activation", "InvitationSettings", () => InvitationSettings(), false));
        if (workflow is not null)
            page.Controls.Add(Button("Vérifier un renouvellement interrompu", "ReconcileInvitation", () => _ = Run(async () => {
                await workflow.ReconcileInvitationAsync();
                SetMessage("Le résultat enregistré correspond à l’invitation du compte. Tu peux retourner dans Récupérer un compte.");
            }), false));
        AttachMessage(page); AcceptButton = null;
    }

    private void InvitationSettings(string? status = null)
    {
        var page = Page("Durée des liens d’activation");
        page.Controls.Add(Label("Durée requise : 86 400 secondes (24 heures). Ce réglage affecte aussi les confirmations, récupérations, changements d’adresse et connexions par e-mail."));
        page.Controls.Add(Button("Ouvrir les réglages Auth de Mon BPREA", "OpenAuthSettings", () => {
            try { Process.Start(new ProcessStartInfo(AdminContract.AuthSettingsDashboard) { UseShellExecute = true }); }
            catch { SetMessage("L’ouverture du tableau de bord Supabase a échoué."); }
        }, false));
        page.Controls.Add(Label("Après autorisation, ouvre le fournisseur Email, règle Email OTP Expiration à 86400 et enregistre. Pour vérifier le réglage, utilise un jeton de gestion limité à la lecture de la configuration Auth. Il reste en mémoire jusqu’à la fermeture."));
        var token = Input("AuthConfigToken"); token.UseSystemPasswordChar = true; token.AccessibleName = "Jeton de lecture de la configuration Auth";
        page.Controls.Add(token);
        var verify = Button("Vérifier la durée", "VerifyOtpDuration", () => _ = Run(async () => {
            var value = token.Text.Trim(); token.Clear();
            var seconds = await workflow!.CheckInvitationDurationAsync(value);
            SetMessage(seconds == AdminContract.InvitationExpirySeconds
                ? "Durée vérifiée sur Supabase : 24 heures. Tu peux reprendre ton opération."
                : $"Durée lue sur Supabase : {seconds} secondes. Règle-la à 86 400 secondes avant de reprendre.");
        }), false);
        page.Controls.Add(verify); AttachMessage(page); AcceptButton = verify; token.Select();
        if (status is not null) SetMessage(status);
    }

    private void Help()
    {
        if (busy) return;
        var page = Page("Aide");
        page.Controls.Add(Label("Créer : entre l’adresse, crée le lien, copie-le et transmets-le.\n\nRécupérer : choisis la personne puis l’opération. Vérifie son identité par un canal déjà connu. Elle définit elle-même son mot de passe.\n\nSupprimer : choisis la personne puis confirme une seule fois. Un blocage signifie qu’aucune suppression vérifiée ne peut encore être réalisée.\n\nUne opération incertaine ne doit pas être répétée. Les historiques et sauvegardes sont conservés."));
        page.Controls.Add(Button("Notice de confidentialité", "PrivacyNotice", () => {
            try { Process.Start(new ProcessStartInfo(AdminContract.Site + "confidentialite.html") { UseShellExecute = true }); }
            catch { SetMessage("La notice est accessible depuis le pied de page du site Mon BPREA."); }
        }, false)); AttachMessage(page); AcceptButton = null;
    }

    private async Task Run(Func<Task> operation)
    {
        if (busy) return;
        busy = true; UseWaitCursor = true; SetMessage("Vérification en cours…"); SetEnabled(false);
        try { await operation(); }
        catch (Exception error) { Error(error); }
        finally { busy = false; UseWaitCursor = false; SetEnabled(true); }
    }
    private void SetEnabled(bool enabled)
    {
        foreach (var button in Descendants(this).OfType<Button>()) button.Enabled = enabled;
    }
    protected override void OnResize(EventArgs e) { base.OnResize(e); if (content is not null) ResizeFields(); }
    private void ResizeFields()
    {
        var width = Math.Max(240, content.ClientSize.Width - content.Padding.Horizontal - SystemInformation.VerticalScrollBarWidth - 8);
        foreach (var control in Descendants(content))
        {
            if (control is Label label) label.MaximumSize = new Size(width, 0);
            else if (control is TextBox or ListBox || control is Button { Tag: "wide" }) control.Width = width;
        }
    }
    private static IEnumerable<Control> Descendants(Control root)
    { foreach (Control c in root.Controls) { yield return c; foreach (var child in Descendants(c)) yield return child; } }
    private void Error(Exception error) => SetMessage(error is AdminException a ? a.Message : "L’opération n’a pas pu être vérifiée. L’historique est conservé ; ne répète pas une action incertaine.");
    private void SetMessage(string value) { message.Text = value; message.Notify(); }
    private void AttachMessage(Control page) { message.Text = ""; page.Controls.Add(message); }
    private static Label Label(string text, string? name = null, bool heading = false) => new() {
        Text = text, Name = name ?? "", AutoSize = true, MaximumSize = new Size(620, 0), Margin = new Padding(0, 8, 0, 14),
        Font = heading ? new Font("Segoe UI", 21, FontStyle.Bold) : new Font("Segoe UI", 11) };
    private static TextBox Input(string name) => new() { Name = name, Width = 620, MaxLength = 512, Margin = new Padding(0, 0, 0, 16) };
    private Button Button(string text, string name, Action action, bool large = true)
    {
        var button = new Button { Text = text, Name = name, AccessibleName = text, AutoSize = !large, Width = large ? 620 : 115,
            Tag = large ? "wide" : null,
            Height = large ? 62 : 34, MinimumSize = new Size(0, 34), TextAlign = large ? ContentAlignment.MiddleLeft : ContentAlignment.MiddleCenter,
            Padding = new Padding(large ? 18 : 6, 4, 6, 4), Margin = new Padding(0, 5, large ? 0 : 12, 12), UseVisualStyleBackColor = true };
        button.Click += (_, _) => { if (!busy) action(); }; return button;
    }
    private sealed class StatusLabel : Label
    {
        public void Notify() { AccessibleName = Text; AccessibilityNotifyClients(AccessibleEvents.NameChange, -1); }
    }
}
