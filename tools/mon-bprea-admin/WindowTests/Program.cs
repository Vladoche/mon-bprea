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
        using var form = new MainForm(_ => fake);
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
        form.Size = new Size(800, 700); await Pump();
        Check(form.ClientSize.Width >= 760, "normal window resize supported");
        Find<TabControl>(form, "Sections").SelectedIndex = 0;
        fake.FailRefresh = true;
        Find<Button>(form, "Refresh").PerformClick(); await Pump();
        Check(Find<DataGridView>(form, "Accounts").Rows.Count == 0, "failed refresh clears stale list");
        fake.FailRefresh = false;
        Find<Button>(form, "Lock").PerformClick(); await Pump();
        Check(fake.Disposed && Find<TextBox>(form, "AdminKey").Visible, "lock disposes session and returns unlock");
    }

    private static readonly string[] Checks = ["Notice", "Voluntary", "PrivateChannel", "PrivateWorkstation", "ExclusiveAdministration", "NoSharedStorage", "OpeningAuthorized", "PreflightChecked", "ExpiryChecked"];
    private static T Find<T>(Control root, string name) where T : Control => (T)root.Controls.Find(name, true).Single();
    private static async Task Pump() { await Task.Delay(50); }
    private static void Check(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); passed++; }

    private sealed class FakeWorkflow : IAdminWorkflow
    {
        public int Posts;
        public bool Disposed, FailRefresh;
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
        public Task MarkHandedOverAsync(Guid operationId) => Task.CompletedTask;
        public void OpenPrivateFolder() { }
        public void Dispose() => Disposed = true;
    }
}
