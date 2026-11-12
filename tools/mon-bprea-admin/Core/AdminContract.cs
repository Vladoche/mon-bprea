using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MonBprea.Admin.Core;

public static partial class AdminContract
{
    public const string Project = "oqoqrxwfbkhtpksqimgd";
    public const string Api = "https://oqoqrxwfbkhtpksqimgd.supabase.co";
    public const string Site = "https://vladoche.github.io/mon-bprea/";
    public const string Callback = Site + "authentification.html";
    public const int MaximumAccounts = 7;
    public static readonly TimeSpan MaximumInventoryAge = TimeSpan.FromMinutes(5);

    [GeneratedRegex("^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9.-]+\\z", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();
    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\z", RegexOptions.CultureInvariant)]
    private static partial Regex LabelPattern();
    [GeneratedRegex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex UuidPattern();
    [GeneratedRegex("^[A-Za-z0-9_-]{20,512}\\z", RegexOptions.CultureInvariant)]
    private static partial Regex TokenPattern();
    [GeneratedRegex("^sb_secret_[A-Za-z0-9_-]{16,256}\\z", RegexOptions.CultureInvariant)]
    private static partial Regex KeyPattern();

    public static string NormalizeEmail(string? email)
    {
        if (email is null) throw new AdminException("input");
        var value = email.Trim().ToLowerInvariant();
        var parts = value.Split('@');
        if (parts.Length != 2 || value.Length > 254 || parts[0].Length > 64 || !EmailPattern().IsMatch(value)
            || parts[0].StartsWith('.') || parts[0].EndsWith('.') || parts[0].Contains("..", StringComparison.Ordinal)
            || !parts[1].Contains('.') || parts[1].Split('.').Any(x => !LabelPattern().IsMatch(x))) throw new AdminException("input");
        return value;
    }

    public static void ValidateSecret(string? value)
    {
        if (value is null || !KeyPattern().IsMatch(value)) throw new AdminException("key");
    }

    public static void ValidateSettings(JsonElement settings)
    {
        try
        {
            if (settings.GetProperty("disable_signup").ValueKind != JsonValueKind.True
                || settings.GetProperty("mailer_autoconfirm").ValueKind != JsonValueKind.False) throw new AdminException("configuration");
            var external = settings.GetProperty("external");
            if (external.ValueKind != JsonValueKind.Object || external.GetProperty("email").ValueKind != JsonValueKind.True
                || external.GetProperty("anonymous_users").ValueKind != JsonValueKind.False
                || external.EnumerateObject().Any(p => p.Name != "email" && p.Value.ValueKind != JsonValueKind.False)
                || (settings.TryGetProperty("anonymous_users_enabled", out var anonymous) && anonymous.ValueKind != JsonValueKind.False))
                throw new AdminException("configuration");
        }
        catch { throw new AdminException("configuration"); }
    }

    internal static string RequiredString(JsonElement value, string name) => value.GetProperty(name).GetString() ?? throw new FormatException();

    private static DateTimeOffset? OptionalDate(JsonElement user, string name)
    {
        if (!user.TryGetProperty(name, out var property) || property.ValueKind == JsonValueKind.Null) return null;
        if (property.ValueKind != JsonValueKind.String || !DateTimeOffset.TryParse(property.GetString(),
            System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var result)) throw new FormatException();
        return result;
    }

    public static AccountInventory ParseInventory(JsonElement response, string operatorEmail, DateTimeOffset observedAt)
    {
        try
        {
            var users = response.GetProperty("users");
            if (users.ValueKind != JsonValueKind.Array) throw new FormatException();
            if (users.GetArrayLength() > MaximumAccounts) throw new AdminException("capacity");
            foreach (var name in new[] { "total", "total_count" })
                if (response.TryGetProperty(name, out var total) && (!total.TryGetInt32(out var count) || count != users.GetArrayLength())) throw new FormatException();
            if (response.TryGetProperty("next_page", out var next) && next.ValueKind != JsonValueKind.Null && !(next.TryGetInt32(out var page) && page == 0)) throw new FormatException();
            var accounts = new List<AuthAccount>();
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var emails = new HashSet<string>(StringComparer.Ordinal);
            var snapshotRows = new List<(string Id, string Email, string? Confirmed)>();
            foreach (var user in users.EnumerateArray())
            {
                var id = RequiredString(user, "id");
                var rawEmail = RequiredString(user, "email");
                var email = NormalizeEmail(rawEmail);
                if (!UuidPattern().IsMatch(id) || rawEmail.ToLowerInvariant() != email || !ids.Add(id) || !emails.Add(email)) throw new FormatException();
                if (user.TryGetProperty("role", out var role) && role.GetString() != "authenticated") throw new FormatException();
                var confirmed = OptionalDate(user, "email_confirmed_at");
                var invited = OptionalDate(user, "invited_at");
                accounts.Add(new(id, email, OptionalDate(user, "created_at"), confirmed, invited));
                snapshotRows.Add((id, email, confirmed.HasValue ? RequiredString(user, "email_confirmed_at") : null));
            }
            // Same [id,email,email_confirmed_at|null] projection as the Node executor.
            var json = JsonSerializer.Serialize(snapshotRows.OrderBy(x => x.Id, StringComparer.Ordinal).Select(x => new object?[] { x.Id, x.Email, x.Confirmed }),
                new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
            var snapshot = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
            return new(accounts.AsReadOnly(), observedAt, snapshot, emails.Contains(NormalizeEmail(operatorEmail)));
        }
        catch (AdminException error) when (error.Code == "capacity") { throw; }
        catch { throw new AdminException("lookup"); }
    }

    // Accepts the SDK-shaped object for parity tests. The REST adapter maps the
    // flattened GoTrue response to this shape without exposing its contents.
    public static string BuildManualLink(JsonElement data, string email)
    {
        try { return BuildLink(data.GetProperty("user"), data.GetProperty("properties"), email); }
        catch { throw new AdminException("uncertain"); }
    }

    internal static string BuildRestManualLink(JsonElement data, string email) => BuildLink(data, data, email);

    private static string BuildLink(JsonElement user, JsonElement properties, string email)
    {
        try
        {
            var target = NormalizeEmail(email);
            if (!UuidPattern().IsMatch(RequiredString(user, "id")) || RequiredString(user, "email").ToLowerInvariant() != target
                || RequiredString(properties, "verification_type") != "invite"
                || RequiredString(properties, "redirect_to") != Callback) throw new FormatException();
            var token = RequiredString(properties, "hashed_token");
            var raw = RequiredString(properties, "action_link");
            if (!TokenPattern().IsMatch(token) || raw.Contains('#') || !Uri.TryCreate(raw, UriKind.Absolute, out var action)
                || action.GetLeftPart(UriPartial.Path) != Api + "/auth/v1/verify" || !string.IsNullOrEmpty(action.UserInfo)
                || action.AbsoluteUri != raw || action.Fragment != "") throw new FormatException();
            var query = ParseQuery(action.Query);
            if (query.Count != 3 || query["type"] != "invite" || query["token"] != token || query["redirect_to"] != Callback) throw new FormatException();
            return Callback + "?token_hash=" + token + "&type=invite";
        }
        catch { throw new AdminException("uncertain"); }
    }

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var pair in query.TrimStart('?').Split('&'))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length != 2 || !result.TryAdd(Uri.UnescapeDataString(parts[0].Replace('+', ' ')), Uri.UnescapeDataString(parts[1].Replace('+', ' ')))) throw new FormatException();
        }
        return result;
    }
}
