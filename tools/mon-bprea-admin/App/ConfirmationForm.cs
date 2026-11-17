namespace MonBprea.Admin.App;

internal sealed class ConfirmationForm : Form
{
    public ConfirmationForm(string text, string title, string action)
    {
        Text = title; Name = "SimpleConfirmation"; AccessibleName = title;
        Font = new Font("Segoe UI", 11); AutoScaleMode = AutoScaleMode.Dpi;
        FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false;
        StartPosition = FormStartPosition.CenterParent; ShowInTaskbar = false;
        ClientSize = new Size(560, 320);
        var label = new Label { Text = text, AutoSize = true, MaximumSize = new Size(500, 0), Location = new Point(24, 24) };
        Controls.Add(label);
        ClientSize = new Size(560, Math.Max(220, label.GetPreferredSize(new Size(500, 0)).Height + 120));
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(18) };
        var cancel = new Button { Name = "CancelConfirmation", Text = "Annuler", AutoSize = true, Padding = new Padding(12, 7, 12, 7), DialogResult = DialogResult.Cancel };
        var approve = new Button { Name = "ApproveConfirmation", Text = action, AutoSize = true, Padding = new Padding(12, 7, 12, 7), DialogResult = DialogResult.OK };
        buttons.Controls.Add(cancel); buttons.Controls.Add(approve); Controls.Add(buttons);
        CancelButton = cancel; AcceptButton = null; Shown += (_, _) => cancel.Select();
    }
    public static bool Ask(IWin32Window owner, string text, string title, string action)
    { using var form = new ConfirmationForm(text, title, action); return form.ShowDialog(owner) == DialogResult.OK; }
}
