using MonBprea.Admin.Core;
using MonBprea.Admin.App;
using MonBprea.Admin.WindowsSecurity;

internal static partial class Program
{
    private sealed class FakeVault : IAdminCredentialVault
    {
        private string? secret;
        public int Writes, Reads, Deletions;
        public void Save(string value) { Writes++; secret = value; }
        public string? Read() { Reads++; return secret; }
        public void Delete() { Deletions++; secret = null; }
    }
    private static async Task ExerciseCredentials(MainForm form, FakeVault vault)
    {
        var key = Find<TextBox>(form, "AdminKey");
        Check(!Find<CheckBox>(form, "RememberKey").Checked && !Find<Button>(form, "SaveCredential").Enabled, "credential persistence opt-in disabled by default");
        key.Text = "sb_secret_FICTITIOUS_WINDOW_TEST_0000000001";
        Find<Button>(form, "SaveCredential").PerformClick(); await Pump(); Check(vault.Writes == 0, "unchecked persistence does not save");
        Find<CheckBox>(form, "RememberKey").Checked = true;
        Find<Button>(form, "SaveCredential").PerformClick(); await Pump();
        Check(vault.Writes == 1 && key.Text == "" && !Find<CheckBox>(form, "RememberKey").Checked, "explicit save clears field and opt-in");
        Find<Button>(form, "ReadCredential").PerformClick(); await Pump();
        Check(vault.Reads == 1 && key.UseSystemPasswordChar && key.Text == "sb_secret_FICTITIOUS_WINDOW_TEST_0000000001", "credential read remains masked without unlocking");
        key.Text = "sb_secret_FICTITIOUS_WINDOW_TEST_0000000002";
        Find<CheckBox>(form, "RememberKey").Checked = true;
        Find<Button>(form, "SaveCredential").PerformClick(); await Pump();
        Find<Button>(form, "ReadCredential").PerformClick(); await Pump();
        Check(vault.Writes == 2 && key.Text.EndsWith("2"), "explicit credential replacement");
        Find<Button>(form, "DeleteCredential").PerformClick(); await Pump();
        Find<Button>(form, "ReadCredential").PerformClick(); await Pump();
        Check(vault.Deletions == 1 && key.Text == "", "explicit removal clears only credential and masked field");
    }
    private static readonly string[] ClosureChecks = ["ClosureRequested","ClosureIdentity","ClosureTarget","ClosureRight","ClosureExceptions","ClosureExport","ClosureExportDelivered","ClosureConsequences","ClosureAuthorized"];
    private static async Task ExerciseClosure(MainForm form, FakeWorkflow fake)
    {
        var grid = Find<DataGridView>(form, "Accounts");
        var sections = Find<TabControl>(form, "Sections"); sections.SelectedIndex = 0; grid.ClearSelection(); grid.Rows[0].Selected = true; await Pump();
        Find<Button>(form, "CloseAccount").PerformClick(); await Pump();
        Check(sections.SelectedIndex == 3 && Find<TextBox>(form, "ClosureEmail").ReadOnly, "dedicated closure page uses selected identity");
        foreach (var name in ClosureChecks) Check(!Find<CheckBox>(form,name).Checked, "new closure human attestation unchecked " + name);
        Find<TextBox>(form,"ClosureReference").Text = "REQ-UI-SYNTHETIC";
        foreach (var name in ClosureChecks) Find<CheckBox>(form,name).Checked = true;
        Find<Button>(form,"PrepareClosure").PerformClick(); await Pump();
        Check(!Find<Button>(form,"ReviewClosure").Enabled && fake.ClosureDeletes == 0, "operator cannot be authorized");
        sections.SelectedIndex = 0; grid.ClearSelection(); grid.Rows[1].Selected = true; await Pump();
        Find<Button>(form,"CloseAccount").PerformClick(); await Pump();
        Find<Button>(form,"PrepareClosure").PerformClick(); await Pump();
        Check(!Find<Button>(form,"ReviewClosure").Enabled && fake.ClosureDeletes == 0, "missing human attestations block closure");
        Find<TextBox>(form,"ClosureReference").Text = "REQ-UI-SYNTHETIC";
        foreach (var name in ClosureChecks) Find<CheckBox>(form,name).Checked = true;
        Find<Button>(form,"PrepareClosure").PerformClick(); await Pump();
        Check(Find<Label>(form,"ClosureSummary").Text.Contains("SUPPRESSION BLOQUÉE") && !Find<Button>(form,"ReviewClosure").Enabled, "missing technical evidence cannot be replaced by checked attestations");
        fake.AllowClosure = true;
        Find<Button>(form,"PrepareClosure").PerformClick(); await Pump();
        Check(Find<Label>(form,"ClosureSummary").Text.Contains("profiles : 1") && Find<Button>(form,"ReviewClosure").Enabled, "synthetic counts only and final review available");
        Find<CheckBox>(form,"ClosureIdentity").Checked = false; await Pump();
        Check(!Find<Button>(form,"ReviewClosure").Enabled, "changed human evidence invalidates final confirmation");
        Find<CheckBox>(form,"ClosureIdentity").Checked = true;
        Find<Button>(form,"PrepareClosure").PerformClick(); await Pump();
        using (var timer = new System.Windows.Forms.Timer { Interval = 30 }) {
            timer.Tick += (_,_) => {
                var dialog = Application.OpenForms.OfType<Form>().SingleOrDefault(f => f.Name == "ClosureConfirmationDialog");
                if (dialog is null) return;
                timer.Stop();
                Check(dialog.Visible && dialog.Text == "Confirmer la suppression définitive" && dialog.AcceptButton is null, "separate irreversible dialog without Enter default");
                Check(!Find<Button>(dialog,"ExecuteClosure").Enabled, "delete button initially disabled");
                Find<Button>(dialog,"CancelClosureConfirmation").PerformClick();
            };
            timer.Start(); Find<Button>(form,"ReviewClosure").PerformClick(); await Pump();
        }
        Check(fake.ClosureDeletes == 0, "final-dialog cancellation never deletes");
        sections.SelectedIndex = 0; grid.Rows[1].Selected = true; Find<Button>(form,"CloseAccount").PerformClick(); await Pump();
        Find<TextBox>(form,"ClosureReference").Text = "REQ-UI-SYNTHETIC";
        foreach (var name in ClosureChecks) Find<CheckBox>(form,name).Checked = true;
        Find<Button>(form,"PrepareClosure").PerformClick(); await Pump();
        fake.HoldGeneration = new TaskCompletionSource();
        using (var timer = new System.Windows.Forms.Timer { Interval = 30 }) {
            timer.Tick += (_,_) => {
                var dialog = Application.OpenForms.OfType<Form>().SingleOrDefault(f => f.Name == "ClosureConfirmationDialog");
                if (dialog is null) return; timer.Stop();
                Find<TextBox>(dialog,"ClosureExactConfirmation").Text = "OK";
                Check(!Find<Button>(dialog,"ExecuteClosure").Enabled, "generic OK cannot authorize deletion");
                Find<TextBox>(dialog,"ClosureExactConfirmation").Text = "SUPPRIMER DEFINITIVEMENT pending@example.test";
                Check(Find<Button>(dialog,"ExecuteClosure").Enabled, "exact target confirmation enables single execution");
                Find<Button>(dialog,"ExecuteClosure").PerformClick();
            };
            timer.Start(); Find<Button>(form,"ReviewClosure").PerformClick(); await Pump();
        }
        Find<Button>(form,"ReviewClosure").PerformClick(); form.Close();
        Check(fake.ClosureDeletes == 1 && form.Visible && !Find<Button>(form,"Lock").Enabled, "one closure attempt, close/double-click/lock blocked, message loop alive");
        fake.HoldGeneration.SetResult(); await Pump();
        Check(Find<Label>(form,"ClosureResult").Text.Contains("contrôles incomplets") && !Find<Button>(form,"ReviewClosure").Enabled, "absence Auth never presented as complete erasure");
        foreach (var name in ClosureChecks) Check(!Find<CheckBox>(form,name).Checked, "closure completion resets " + name);
        // Recreate the administrative session before the remaining V1.1 checks.
        Find<Button>(form,"Lock").PerformClick(); await Pump();
        Find<TextBox>(form,"AdminKey").Text = "synthetic-session-input";
        Find<Button>(form,"Unlock").PerformClick(); await Pump();
        fake.ClosureOutcome = ClosureStatus.Uncertain;
        sections.SelectedIndex = 0; grid.ClearSelection(); grid.Rows[1].Selected = true; await Pump();
        Find<Button>(form,"CloseAccount").PerformClick(); await Pump();
        Find<TextBox>(form,"ClosureReference").Text = "REQ-UI-UNCERTAIN";
        foreach (var name in ClosureChecks) Find<CheckBox>(form,name).Checked = true;
        Find<Button>(form,"PrepareClosure").PerformClick(); await Pump();
        using (var timer = new System.Windows.Forms.Timer { Interval = 30 }) {
            timer.Tick += (_,_) => {
                var dialog = Application.OpenForms.OfType<Form>().SingleOrDefault(f => f.Name == "ClosureConfirmationDialog");
                if (dialog is null) return; timer.Stop();
                Find<TextBox>(dialog,"ClosureExactConfirmation").Text = "SUPPRIMER DEFINITIVEMENT pending@example.test";
                Find<Button>(dialog,"ExecuteClosure").PerformClick();
            };
            timer.Start(); Find<Button>(form,"ReviewClosure").PerformClick(); await Pump();
        }
        Check(fake.ClosureDeletes == 2 && Find<Label>(form,"ClosureResult").Text.Contains("Résultat incertain"), "uncertain closure result explicitly displayed");
        Find<Button>(form,"InspectClosure").PerformClick(); await Pump();
        Check(!Find<Button>(form,"Prepare").Enabled && !Find<Button>(form,"CloseAccount").Enabled, "read-only inspection never clears uncertain closure suspension");
        Find<Button>(form,"Lock").PerformClick(); await Pump();
        Find<TextBox>(form,"AdminKey").Text = "synthetic-session-input";
        Find<Button>(form,"Unlock").PerformClick(); await Pump();
    }
}
