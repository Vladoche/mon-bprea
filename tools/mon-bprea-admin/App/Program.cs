using MonBprea.Admin.Core;
using MonBprea.Admin.WindowsSecurity;

namespace MonBprea.Admin.App;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            var target = AdminTarget.Production;
            if (args.Length != 0)
            {
                const string option = "--qualification-locale=";
                if (args.Length > 2 || !args[0].StartsWith(option, StringComparison.Ordinal)
                    || !Guid.TryParseExact(args[0][option.Length..], "D", out var id) || id == Guid.Empty)
                    throw new AdminException("configuration");
                target = AdminTarget.LocalQualification(id);
            }
            if (args.Length == 2 && args[1] != "--qualification-theme=dark") throw new AdminException("configuration");
            Application.SetColorMode(args.Length == 2 ? SystemColorMode.Dark : SystemColorMode.System);
            var vault = target.IsLocal ? AdminCredentialVault.ForQualification(target.Qualification!.Value) : new AdminCredentialVault();
            SimpleBootstrap? bootstrap = null;
            bool? preserveExistingHistory = null;
            Application.ThreadException += (_, _) => MessageBox.Show("L’opération n’a pas pu être vérifiée. Ne répète pas une action incertaine.",
                "Mon BPREA Admin", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            using var form = new SimpleMainForm(target, vault, async (key, configure) => {
                preserveExistingHistory ??= !configure;
                bootstrap ??= new SimpleBootstrap(target, vault, new AutomaticPrivateStore(target, requireExisting: preserveExistingHistory.Value));
                return configure ? await bootstrap.ConfigureAsync(key) : bootstrap.OpenSaved(key);
            });
            Application.Run(form);
        }
        catch (Exception error)
        {
            MessageBox.Show(error is AdminException a ? a.Message : "L’application ne peut pas démarrer. Les données existantes sont conservées.",
                "Mon BPREA Admin", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }
}
