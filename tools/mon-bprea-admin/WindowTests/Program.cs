using MonBprea.Admin.App;
using MonBprea.Admin.Core;

internal static class Program
{
    private static int passed;
    [STAThread]
    private static int Main(string[] args)
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var fake = new FakeWorkflow();
        using var form = new MainForm(_ => fake, () => true);
        form.Text = "Mon BPREA Admin — TEST SYNTHÉTIQUE SANS RÉSEAU";
        if (args.Length == 1 && args[0] == "--interactive") { Application.Run(form); return 0; }
        Exception? failure = null;
        form.Shown += async (_, _) => {
            try { await Exercise(form, fake); }
            catch (Exception error) { failure = error; }
            finally { form.Close(); }
        };
        Application.Run(form);
        if (failure is not null) { Console.Error.WriteLine("FAIL Windows UI: " + failure.Message); return 1; }
        Console.WriteLine($"PASS {passed} Windows UI checks; real form/message loop, synthetic workflow, zero network.");
        return 0;
    }

    private static async Task Exercise(MainForm form, FakeWorkflow fake)
    {
        Check(form.Visible && form.IsHandleCreated, "real Windows form shown");
        var key = Find<TextBox>(form, "AdminKey");
        Check(key.UseSystemPasswordChar && key.ShortcutsEnabled, "key masked, manual paste allowed");
        foreach (var name in Checks) Check(!Find<CheckBox>(form, name).Checked, "unchecked prerequisite " + name);
        Find<TextBox>(form, "OperatorEmail").Text = "operator@example.test";
        key.Text = "synthetic-session-input";
        Find<Button>(form, "Unlock").PerformClick(); await Pump();
        Check(key.Text == "", "key control cleared after unlock");
        Check(Find<DataGridView>(form, "Accounts").Rows.Count == 2, "confirmed and pending accounts displayed");
        Check(Find<DataGridView>(form, "Accounts").Rows[1].Cells[1].Value?.ToString() == "Invitation en attente", "pending from Auth timestamp");
        Find<TabControl>(form, "Sections").SelectedIndex = 1;
        Find<TextBox>(form, "RecipientEmail").Text = "recipient@example.test";
        foreach (var name in Checks) Find<CheckBox>(form, name).Checked = true;
        Find<TextBox>(form, "RecipientEmail").Text = "other@example.test";
        foreach (var name in Checks) Check(!Find<CheckBox>(form, name).Checked, "recipient change resets " + name);
        Find<TextBox>(form, "RecipientEmail").Text = "recipient@example.test";
        foreach (var name in Checks) Find<CheckBox>(form, name).Checked = true;
        Find<Button>(form, "Prepare").PerformClick(); await Pump();
        Check(fake.Posts == 0 && Find<Button>(form, "Generate").Enabled, "preparation never generates");
        Find<Button>(form, "CancelPreparation").PerformClick(); await Pump();
        Check(fake.Posts == 0 && !Find<Button>(form, "Generate").Enabled, "cancel never generates");
        foreach (var name in Checks) Check(!Find<CheckBox>(form, name).Checked, "cancel resets " + name);
        foreach (var name in Checks) Find<CheckBox>(form, name).Checked = true;
        Find<Button>(form, "Prepare").PerformClick(); await Pump();
        Find<TextBox>(form, "ExactConfirmation").Text = "CONFIRMER PROD invite recipient@example.test";
        fake.HoldGeneration = new TaskCompletionSource();
        Find<Button>(form, "Generate").PerformClick();
        Find<Button>(form, "Generate").PerformClick();
        Check(fake.Posts == 1 && !Find<Button>(form, "Lock").Enabled, "double click and lock blocked during generation");
        fake.HoldGeneration.SetResult(); await Pump();
        Check(fake.Posts == 1 && Find<Button>(form, "OpenPrivateFolder").Enabled, "one generation, private folder accessible");
        foreach (var name in Checks) Check(!Find<CheckBox>(form, name).Checked, "success resets " + name);
        Check(Find<TextBox>(form, "RecipientEmail").Text == "", "recipient reset");
        Check(Find<Label>(form, "OperationStatus").Text.Contains("Aucun email envoyé"), "manual delivery result");
        Find<Button>(form, "Handover").PerformClick(); await Pump();
        Check(fake.Handovers == 1, "invitation handover separately acknowledged through button");
        var grid = Find<DataGridView>(form, "Accounts");
        Find<TabControl>(form, "Sections").SelectedIndex = 0;
        grid.ClearSelection(); grid.Rows[1].Selected = true; await Pump();
        Check(!Find<Button>(form, "RecoverAccess").Enabled, "pending account cannot recover");
        grid.Rows[0].Selected = true; await Pump();
        Check(Find<Button>(form, "RecoverAccess").Enabled, "confirmed selected account can recover");
        var before = fake.Posts;
        Find<Button>(form, "RecoverAccess").PerformClick(); await Pump();
        Check(Find<TabControl>(form, "Sections").SelectedIndex == 2, "recovery preparation form shown");
        Check(Find<TextBox>(form, "RecoveryEmail").ReadOnly && Find<TextBox>(form, "RecoveryEmail").Text == "operator@example.test", "address comes from selected verified row");
        foreach (var name in RecoveryChecks) Check(!Find<CheckBox>(form, name).Checked, "fresh recovery unchecked " + name);
        Find<Button>(form, "PrepareRecovery").PerformClick(); await Pump();
        Check(fake.Posts == before && !Find<Button>(form, "GenerateRecovery").Enabled, "missing attestations never generate");
        foreach (var name in RecoveryChecks) Find<CheckBox>(form, name).Checked = true;
        Find<Button>(form, "PrepareRecovery").PerformClick(); await Pump();
        Check(Find<Button>(form, "GenerateRecovery").Enabled && fake.Posts == before, "recovery preflight no generation");
        Find<CheckBox>(form, "RecoveryIdentity").Checked = false; await Pump();
        Check(!Find<Button>(form, "GenerateRecovery").Enabled, "revoked identity invalidates preparation");
        Find<CheckBox>(form, "RecoveryIdentity").Checked = true;
        Find<Button>(form, "PrepareRecovery").PerformClick(); await Pump();
        Find<Button>(form, "CancelRecovery").PerformClick(); await Pump();
        foreach (var name in RecoveryChecks) Check(!Find<CheckBox>(form, name).Checked, "cancel resets recovery " + name);
        // A cancelled target must be selected again; no arbitrary address input.
        Find<TabControl>(form, "Sections").SelectedIndex = 0;
        Find<Button>(form, "RecoverAccess").PerformClick(); await Pump();
        foreach (var name in RecoveryChecks) Find<CheckBox>(form, name).Checked = true;
        Find<Button>(form, "PrepareRecovery").PerformClick(); await Pump();
        Find<TextBox>(form, "RecoveryConfirmation").Text = "OK";
        Find<Button>(form, "GenerateRecovery").PerformClick(); await Pump();
        Check(fake.Posts == before && !Find<Button>(form, "GenerateRecovery").Enabled, "generic OK refused");
        Find<Button>(form, "PrepareRecovery").PerformClick(); await Pump();
        Find<TextBox>(form, "RecoveryConfirmation").Text = "CONFIRMER PROD recovery operator@example.test";
        fake.HoldGeneration = new TaskCompletionSource();
        Find<Button>(form, "GenerateRecovery").PerformClick(); Find<Button>(form, "GenerateRecovery").PerformClick();
        form.Close(); // A real close request is refused while generation is in flight.
        Check(form.Visible && fake.Posts == before + 1 && !Find<Button>(form, "Lock").Enabled, "one recovery, close and lock blocked during operation");
        fake.HoldGeneration.SetResult(); await Pump();
        Check(Find<Label>(form, "RecoveryResult").Text.Contains("Lien de récupération généré et enregistré") && Find<Button>(form, "RecoveryOpenFolder").Enabled, "recovery result without secret link");
        foreach (var name in RecoveryChecks) Check(!Find<CheckBox>(form, name).Checked, "success resets recovery " + name);
        Find<TabControl>(form, "Sections").SelectedIndex = 0;
        Find<Button>(form, "Refresh").PerformClick(); await Pump();
        Check(Find<Button>(form, "RecoveryHandover").Enabled, "refresh preserves recovery handover receipt");
        Find<TabControl>(form, "Sections").SelectedIndex = 2;
        Find<Button>(form, "RecoveryHandover").PerformClick(); await Pump();
        Check(fake.Handovers == 2 && !Find<Button>(form, "RecoveryHandover").Enabled, "recovery handover recorded separately");
        Find<TabControl>(form, "Sections").SelectedIndex = 0; grid.Rows[0].Selected = true; await Pump();
        Find<Button>(form, "RecoverAccess").PerformClick(); await Pump();
        foreach (var name in RecoveryChecks) Check(!Find<CheckBox>(form, name).Checked, "new request never inherits identity " + name);
        foreach (var name in RecoveryChecks) Find<CheckBox>(form, name).Checked = true;
        Find<Button>(form, "PrepareRecovery").PerformClick(); await Pump();
        Find<TextBox>(form, "RecoveryConfirmation").Text = "CONFIRMER PROD recovery operator@example.test";
        fake.FailRecovery = true;
        Find<Button>(form, "GenerateRecovery").PerformClick(); await Pump();
        Check(Find<Label>(form, "OperationStatus").Text.Contains("Résultat incertain") && !Find<Button>(form, "PrepareRecovery").Enabled, "uncertain recovery blocks retries");
        form.Size = new Size(800, 700); await Pump();
        Check(form.ClientSize.Width >= 760, "normal window resize supported");
        Find<TabControl>(form, "Sections").SelectedIndex = 0;
        fake.FailRefresh = true;
        Find<Button>(form, "Refresh").PerformClick(); await Pump();
        Check(Find<DataGridView>(form, "Accounts").Rows.Count == 0 && !Find<Button>(form, "RecoverAccess").Enabled && !Find<Button>(form, "Prepare").Enabled, "failed refresh blocks every generation");
        fake.FailRefresh = false;
        Find<Button>(form, "Lock").PerformClick(); await Pump();
        Check(fake.Disposed && Find<TextBox>(form, "AdminKey").Visible, "lock disposes session and returns unlock");
    }

    private static readonly string[] RecoveryChecks = ["RecoveryRequested", "RecoveryIdentity", "RecoveryAddress", "RecoveryChannel", "RecoveryPassword", "RecoveryWorkstation", "RecoveryExclusive", "RecoveryStorage", "RecoveryAuthorized", "RecoveryPreflight", "RecoveryExpiry"];
    private static readonly string[] Checks = ["Notice", "Voluntary", "PrivateChannel", "PrivateWorkstation", "ExclusiveAdministration", "NoSharedStorage", "OpeningAuthorized", "PreflightChecked", "ExpiryChecked"];
    private static T Find<T>(Control root, string name) where T : Control => (T)root.Controls.Find(name, true).Single();
    private static async Task Pump() { await Task.Delay(50); }
    private static void Check(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); passed++; }

    private sealed class FakeWorkflow : IAdminWorkflow
    {
        public int Posts, Handovers;
        public bool Disposed, FailRefresh, FailRecovery;
        public TaskCompletionSource? HoldGeneration;
        private readonly AccountInventory inventory = new([
            new AuthAccount("11111111-1111-4111-8111-111111111111", "operator@example.test", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, null),
            new AuthAccount("22222222-2222-4222-8222-222222222222", "pending@example.test", DateTimeOffset.UtcNow, null, DateTimeOffset.UtcNow)
        ], DateTimeOffset.UtcNow, "synthetic", true);
        public Task<AccountInventory> RefreshAsync() => FailRefresh ? Task.FromException<AccountInventory>(new AdminException("lookup")) : Task.FromResult(inventory);
        public Task<PreparedInvitation> PrepareAsync(string email, HumanAttestations human, WorkstationAttestations workstation)
            => human.Complete && workstation.Complete ? Task.FromResult(new PreparedInvitation(Guid.NewGuid(), email, inventory, human, workstation, DateTimeOffset.UtcNow))
                : Task.FromException<PreparedInvitation>(new AdminException("attestations"));
        public async Task<InvitationReceipt> GenerateAsync(PreparedInvitation prepared, string confirmation)
        {
            if (confirmation != prepared.ConfirmationText) throw new AdminException("confirmation");
            Posts++; if (HoldGeneration is not null) await HoldGeneration.Task;
            return new InvitationReceipt(Guid.NewGuid(), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), DateTimeOffset.UtcNow);
        }
        public Task<PreparedRecovery> PrepareRecoveryAsync(AuthAccount selected, RecoveryAttestations human, WorkstationAttestations workstation)
            => human.Complete && workstation.Complete && selected.ConfirmedAt.HasValue ? Task.FromResult(new PreparedRecovery(Guid.NewGuid(), selected, inventory, human, workstation, DateTimeOffset.UtcNow))
                : Task.FromException<PreparedRecovery>(new AdminException("attestations"));
        public async Task<RecoveryReceipt> GenerateRecoveryAsync(PreparedRecovery prepared, string confirmation)
        {
            if (confirmation != prepared.ConfirmationText) throw new AdminException("confirmation");
            Posts++; if (HoldGeneration is not null) await HoldGeneration.Task;
            if (FailRecovery) throw new AdminException("recovery_uncertain");
            return new(Guid.NewGuid(), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), DateTimeOffset.UtcNow);
        }
        public Task MarkHandedOverAsync(Guid operationId) { Handovers++; return Task.CompletedTask; }
        public void OpenPrivateFolder() { }
        public void Dispose() => Disposed = true;
    }
}
