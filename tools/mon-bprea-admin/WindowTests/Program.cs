using MonBprea.Admin.App;
using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

internal static class Program
{
    private static int passed;
    private static string copied = "";
    [STAThread]
    private static int Main()
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var vault = new FakeVault(); var fake = new FakeWorkflow(); var configured = 0; var reopened = 0;
        SimpleMainForm Form() => new(AdminTarget.LocalQualification(Guid.Parse("11111111-1111-4111-8111-111111111111")), vault,
            (key, configure) => {
                if (configure) { configured++; vault.Save(key); } else reopened++;
                return Task.FromResult<ISimpleWorkflow>(fake);
            }, (_, _) => true, text => copied = text);
        using var form = Form(); Exception? failure = null;
        form.Shown += async (_, _) => {
            try { await Exercise(form, fake); }
            catch (Exception e) { failure = e; }
            finally { form.Close(); }
        };
        Application.Run(form);
        if (failure is null)
        {
            using var second = Form();
            second.Shown += async (_, _) => {
                try { await Pump(); Check(FindAll<TextBox>(second).Count == 0, "reopen directly on home without key"); Check(reopened == 1 && configured == 1, "one entry, automatic vault reload"); }
                catch (Exception e) { failure = e; }
                finally { second.Close(); }
            };
            Application.Run(second);
        }
        if (failure is null)
        {
            foreach (var code in new[] { "legacy_conflict", "private", "credential" })
            {
                using var refused = new SimpleMainForm(AdminTarget.LocalQualification(Guid.NewGuid()), vault,
                    (_, _) => Task.FromException<ISimpleWorkflow>(new AdminException(code)));
                refused.Shown += async (_, _) => {
                    try {
                        await Pump();
                        Check(Find<TextBox>(refused, "AdminKey").Visible, "recovery screen after saved-key startup failure " + code);
                        var status = Find<Label>(refused, "Status");
                        Check(status.Visible && status.Text == AdminMessages.For(code), "startup failure has visible explanation " + code);
                    }
                    catch (Exception e) { failure = e; }
                    finally { refused.Close(); }
                };
                Application.Run(refused);
                if (failure is not null) break;
            }
        }
        if (failure is not null) { Console.Error.WriteLine("FAIL Windows V2: " + failure.Message); return 1; }
        Console.WriteLine($"PASS {passed} Windows V2 checks, real message loop, synthetic workflow only."); return 0;
    }
    private static async Task Exercise(SimpleMainForm form, FakeWorkflow fake)
    {
        await Pump(); Check(form.Visible && form.IsHandleCreated, "real window");
        Check(FindAll<CheckBox>(form).Count == 0, "zero checkboxes first use");
        Check(FindAll<TextBox>(form).Count == 1, "single setup field");
        var key = Find<TextBox>(form, "AdminKey"); Check(key.UseSystemPasswordChar, "masked key");
        key.Text = "synthetic-key-without-network"; Click(form, "Configure"); await Pump();
        Check(FindAll<TextBox>(form).Count == 0, "no key on home");
        foreach (var name in new[] { "CreateAccount", "RecoverAccount", "DeleteAccount" }) Check(Find<Button>(form, name).Visible, "home action " + name);
        Click(form, "CreateAccount"); await Pump(); Check(FindAll<TextBox>(form).Count == 1, "invitation only email");
        Check(Find<Label>(form, "AvailableParticipantPlaces").Text.Contains(": 7 ("), "remaining places supported by a fresh inventory");
        Check(Find<TextBox>(form, "RecipientEmail").Focused, "invitation remains keyboard-ready");
        Find<TextBox>(form, "RecipientEmail").Text = "participant@example.test"; fake.Hold = new TaskCompletionSource();
        Click(form, "GenerateInvite"); Click(form, "GenerateInvite"); form.Close();
        Check(form.Visible && fake.Invites == 1, "double click and close blocked");
        fake.Hold.SetResult(); await Pump(); Check(copied == "", "no automatic clipboard copy");
        Check(FindAll<TextBox>(form).Count == 0 && Find<Button>(form, "CopyLink").Visible, "invitation available only by deliberate checked copy");
        Click(form, "CopyLink"); Check(copied == "synthetic-personal-link", "voluntary copy");
        Click(form, "Done"); Click(form, "RecoverAccount"); await Pump();
        Check(Find<ListBox>(form, "Accounts").SelectedIndex == -1, "explicit account selection");
        Find<ListBox>(form, "Accounts").SelectedIndex = 1; Click(form, "SelectAccount"); Click(form, "ResetPassword"); await Pump();
        Check(fake.Recoveries == 1, "password operation");
        Click(form, "Done"); Click(form, "RecoverAccount"); await Pump();
        Find<ListBox>(form, "Accounts").SelectedIndex = 1; Click(form, "SelectAccount"); Click(form, "ChangeEmail");
        Check(FindAll<TextBox>(form).Count == 1, "email operation only new address");
        Find<TextBox>(form, "NewEmail").Text = "new@example.test"; Click(form, "ConfirmEmailChange"); await Pump();
        Check(fake.EmailChanges == 1 && fake.Decision is not null, "known channel decision bound to account and new address");
        Click(form, "Done"); Click(form, "RecoverAccount"); await Pump();
        Find<ListBox>(form, "Accounts").SelectedIndex = 1; Click(form, "SelectAccount"); Click(form, "ChangeBoth");
        Find<TextBox>(form, "NewEmail").Text = "combined@example.test"; Click(form, "ConfirmEmailChange"); await Pump();
        Check(fake.Combinations == 1, "combined workflow explicitly selected");
        Click(form, "Done"); Click(form, "DeleteAccount"); await Pump();
        Find<ListBox>(form, "Accounts").SelectedIndex = 1; Click(form, "SelectAccount"); await Pump();
        Check(fake.Deletes == 1 && FindAll<CheckBox>(form).Count == 0, "one deletion confirmation, no attestations");
        Click(form, "Done"); Click(form, "RecoverAccount"); await Pump();
        Find<ListBox>(form, "Accounts").SelectedIndex = 2; Click(form, "SelectAccount"); await Pump();
        Check(Find<Label>(form, "InvitationState").Text == "Invitation expirée", "expired invitation has explicit state");
        Check(FindAll<Button>(form).All(b => b.Name != "CopyLink" && b.Name != "ResetPassword"), "expired invitation cannot be copied or recovered as password");
        Check(Find<Button>(form, "RenewInvitation").TabStop, "renewal is focusable by keyboard");
        Click(form, "RenewInvitation"); await Pump();
        Check(fake.Renewals == 1 && Find<Label>(form, "LinkExpiry").Text == "Lien d’activation valable 24 heures", "renewal duration is shown exactly");
        Click(form, "Done"); Click(form, "Settings"); Click(form, "CheckConnection"); await Pump();
        Check(Find<Label>(form, "Status").Text.Contains("fonctionne"), "plain connection message"); Click(form, "Home");
        foreach (var button in FindAll<Button>(form)) Check(!string.IsNullOrWhiteSpace(button.AccessibleName) && button.TabStop, "keyboard named action");
    }
    private static void Click(Control form, string name) => Find<Button>(form, name).PerformClick();
    private static T Find<T>(Control form, string name) where T : Control => FindAll<T>(form).Single(c => c.Name == name);
    private static List<T> FindAll<T>(Control parent) where T : Control => parent.Controls.Cast<Control>()
        .SelectMany(c => (c is T t ? new[] { t } : Array.Empty<T>()).Concat(FindAll<T>(c))).ToList();
    private static async Task Pump() { await Task.Delay(80); Application.DoEvents(); }
    private static void Check(bool value, string label) { if (!value) throw new InvalidOperationException(label); passed++; }
    private sealed class FakeVault : IAdminCredentialVault
    {
        private string? value; public void Save(string secret) => value = secret;
        public string? Read() => value; public void Delete() => value = null;
    }
    private sealed class FakeWorkflow : ISimpleWorkflow
    {
        public int Invites, Recoveries, EmailChanges, Combinations, Deletes, Renewals;
        public KnownChannelDecision? Decision; public TaskCompletionSource? Hold;
        private readonly AuthAccount[] accounts = [new("11111111-1111-4111-8111-111111111111", "operator@example.test", null, DateTimeOffset.UtcNow, null),
            new("22222222-2222-4222-8222-222222222222", "participant@example.test", null, DateTimeOffset.UtcNow, null),
            new("33333333-3333-4333-8333-333333333333", "invited@example.test", null, null, DateTimeOffset.UtcNow.AddDays(-2))];
        public Task<AccountInventory> RefreshAsync() => Task.FromResult(new AccountInventory(accounts, DateTimeOffset.UtcNow, "synthetic", true));
        private static SimpleResult Result() => new(Guid.NewGuid(), "Lien créé", "Compte fictif", [new("participant@example.test", "synthetic-personal-link")], DateTimeOffset.UtcNow, 60);
        public async Task<SimpleResult> CreateAsync(string email) { Invites++; if (Hold is not null) { await Hold.Task; Hold = null; } return Result(); }
        public Task<InvitationReview> ReviewInvitationAsync(AuthAccount selected) => Task.FromResult(new InvitationReview(selected, Guid.NewGuid(), Guid.NewGuid(), InvitationState.Expired));
        public Task<SimpleResult> RenewInvitationAsync(InvitationReview selected)
        { Renewals++; return Task.FromResult(Result() with { ExpirySeconds = 86400 }); }
        public Task<PersonalLink> ReadInvitationLinkAsync(AuthAccount selected, Guid operation) => Task.FromResult(Result().Links[0]);
        public Task<int> CheckInvitationDurationAsync(string token) => Task.FromResult(86400);
        public Task RequireProductionInvitationDurationAsync() => Task.CompletedTask;
        public Task ReconcileInvitationAsync() => Task.CompletedTask;
        public Task<SimpleResult> RecoverAsync(AuthAccount selected, SimpleOperationKind kind, string? next, KnownChannelDecision? decision, bool newLink = false)
        { if (kind == SimpleOperationKind.Password) Recoveries++; else if (kind == SimpleOperationKind.Email) EmailChanges++; else Combinations++; Decision = decision; return Task.FromResult(Result()); }
        public Task<SimpleResult> DeleteAsync(AuthAccount selected) { Deletes++; return Task.FromResult(Result()); }
        public void Dispose() { }
    }
}
