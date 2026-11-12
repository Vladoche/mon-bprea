namespace MonBprea.Admin.App;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, _) => MessageBox.Show(
            "Opération interrompue. Vérifiez l’inventaire en lecture seule ; ne répétez pas une génération incertaine.",
            "Mon BPREA Admin", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        Application.Run(new MainForm());
    }
}
