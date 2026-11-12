using System.Text.Json;
using MonBprea.Admin.Core;

namespace MonBprea.Admin.WindowsSecurity;

// Reuses the exact offline operator.json schema; no timestamps or attestations are rewritten.
public static class OperatorPreflight
{
    private static readonly string[] ApprovalNames = ["legalFramework", "legalBases", "impactAssessment", "terminal", "notice", "residualRetention", "recoveryLimits"];
    private static readonly string[] ContactFlags = ["publicationApproved", "owned", "protected", "recoveryChecked", "monitoringConfirmed", "withoutAccountChecked"];

    public static void Validate(string path, DateTimeOffset now)
    {
        try
        {
            WindowsPrivateStore.VerifyProtectedFile(path);
            if (!Path.GetFileName(path).Equals("operator.json", StringComparison.OrdinalIgnoreCase)
                || new FileInfo(path).Length is <= 0 or > 1_000_000) throw new AdminException("attestations");
            using var document = JsonDocument.Parse(File.ReadAllBytes(path));
            var config = document.RootElement;
            if (config.GetProperty("version").GetInt32() != 1 || !config.GetProperty("capacityConfirmed").GetBoolean()
                || string.IsNullOrWhiteSpace(config.GetProperty("operatorIdentity").GetString())) throw new AdminException("attestations");
            var approvals = config.GetProperty("approvals");
            if (approvals.EnumerateObject().Count() != ApprovalNames.Length || ApprovalNames.Any(name => !approvals.GetProperty(name).GetBoolean()))
                throw new AdminException("attestations");
            var contact = config.GetProperty("contact");
            if (ContactFlags.Any(name => !contact.GetProperty(name).GetBoolean())) throw new AdminException("attestations");
            // Public contact is a fixed approved policy value, not the operator's Auth identity.
            if (contact.GetProperty("email").GetString() != "vladimir.fouillade@hotmail.fr") throw new AdminException("attestations");
            var received = Instant(contact.GetProperty("receivedAt").GetString());
            var replied = Instant(contact.GetProperty("repliedAt").GetString());
            if (replied < received || now < received || now < replied || now - received > TimeSpan.FromDays(30)
                || now - replied > TimeSpan.FromDays(30)) throw new AdminException("attestations");
        }
        catch (AdminException) { throw; }
        catch { throw new AdminException("attestations"); }
    }

    private static DateTimeOffset Instant(string? value)
    {
        if (value is null || !System.Text.RegularExpressions.Regex.IsMatch(value, @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\z")
            || !DateTimeOffset.TryParse(value, out var result)) throw new AdminException("attestations");
        return result;
    }
}
