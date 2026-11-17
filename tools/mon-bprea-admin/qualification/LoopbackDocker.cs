using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

internal static class LoopbackDocker
{
    private static string Docker { get { return Environment.GetEnvironmentVariable("BPREA_V2_DOCKER_EXE") ?? ""; } }

    private static string Quote(string text)
    {
        var quoted = new StringBuilder().Append('"');
        int slashes = 0;
        foreach (char character in text)
        {
            if (character == '\\') { slashes++; continue; }
            if (character == '"') quoted.Append('\\', slashes * 2 + 1);
            else quoted.Append('\\', slashes);
            quoted.Append(character);
            slashes = 0;
        }
        return quoted.Append('\\', slashes * 2).Append('"').ToString();
    }

    private static int Main(string[] args)
    {
        string network = Environment.GetEnvironmentVariable("BPREA_660C_DOCKER_NETWORK") ?? "";
        string networkId = Environment.GetEnvironmentVariable("BPREA_660C_DOCKER_NETWORK_ID") ?? "";
        if (!Path.IsPathRooted(Docker) || !File.Exists(Docker) || !Regex.IsMatch(network, @"^bprea-admin-v2-local$") ||
            Environment.GetEnvironmentVariable("DOCKER_CONTEXT") != "desktop-linux")
            return 51;

        int command = args.Length > 0 && args[0] == "container" ? 1 : 0;
        if (command < args.Length && (args[command] == "create" || args[command] == "run"))
        {
            int networkFlag = Array.IndexOf(args, "--network");
            for (int index = command + 1; index < args.Length; index++)
            {
                if (args[index] == "--publish-all" || args[index] == "-P") return 52;
                if (args[index] != "-p" && args[index] != "--publish") continue;
                if (networkFlag < 0 || networkFlag + 1 >= args.Length ||
                    (args[networkFlag + 1] != network && args[networkFlag + 1] != networkId) ||
                    index + 1 >= args.Length || !Regex.IsMatch(args[index + 1], @"^(5432|4532)[0-9]:[0-9]{2,5}(/(tcp|udp))?$"))
                    return 53;
                index++;
                args[index] = "127.0.0.1:" + args[index];
            }
        }
        using (var process = Process.Start(new ProcessStartInfo(Docker, "--context desktop-linux " + string.Join(" ", args.Select(Quote)))
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        }))
        {
            var stdout = process.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
            var stderr = process.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());
            var stdin = new Thread(() =>
            {
                try { Console.OpenStandardInput().CopyTo(process.StandardInput.BaseStream); }
                catch (IOException) { }
                catch (ObjectDisposedException) { }
                finally
                {
                    try { process.StandardInput.Close(); }
                    catch (IOException) { }
                    catch (ObjectDisposedException) { }
                }
            }) { IsBackground = true };
            stdin.Start();
            process.WaitForExit();
            Task.WaitAll(stdout, stderr);
            return process.ExitCode;
        }
    }
}
