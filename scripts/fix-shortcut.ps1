# fix-shortcut.ps1 — Creates desktop shortcut using IShellLinkW (Windows native API).
# Called from Inno Setup post-install [Code] to fix the shortcut on systems where
# Inno's [Icons] + WScript.Shell fail on Arabic/OneDrive/Unicode desktop paths.
# IShellLinkW (the "W" = Wide/Unicode variant) handles all Unicode paths natively.

param(
    [string]$AppDir = $PSScriptRoot
)

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
namespace Win32 {
    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IShellLinkW {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszFile, int cchMaxPath, IntPtr pfd, uint fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszName, int cchMaxName);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszDir, int cchMaxPath);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszArgs, int cchMaxPath);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszIconPath, int cchIconPath, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
        void Resolve(IntPtr hwnd, uint fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")] public class ShellLink {}
    public class Shortcut {
        public static void Create(string target, string shortcutPath, string workDir, string iconPath) {
            IShellLinkW link = (IShellLinkW)new ShellLink();
            link.SetPath(target);
            link.SetWorkingDirectory(workDir);
            if (!string.IsNullOrEmpty(iconPath) && System.IO.File.Exists(iconPath)) {
                link.SetIconLocation(iconPath, 0);
            }
            IPersistFile file = (IPersistFile)link;
            file.Save(shortcutPath, true);
        }
    }
}
'@

Add-Type -TypeDefinition $code

$targetExe = Join-Path $AppDir "VS Code Egypt.exe"
$workDir    = $AppDir
$iconPath   = Join-Path $AppDir "kliopatra.ico"
$desktop    = [Environment]::GetFolderPath("Desktop")
$lnkPath    = Join-Path $desktop "VS Code Egypt.lnk"

# Verify the target exe exists
if (-not (Test-Path $targetExe)) {
    Write-Host "WARNING: Target exe not found at $targetExe"
    # Try to find it in the app directory
    $foundExe = Get-ChildItem $AppDir -Filter "VS Code Egypt.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($foundExe) {
        $targetExe = $foundExe.FullName
        Write-Host "Found exe at: $targetExe"
    } else {
        Write-Host "ERROR: Cannot find VS Code Egypt.exe"
        exit 1
    }
}

# Verify icon exists
if (-not (Test-Path $iconPath)) {
    Write-Host "WARNING: kliopatra.ico not found at $iconPath"
    # Try alternative locations
    $altIconPaths = @(
        (Join-Path $AppDir "resources\win32\kliopatra.ico"),
        (Join-Path $AppDir "kliopatra.ico")
    )
    foreach ($alt in $altIconPaths) {
        if (Test-Path $alt) {
            $iconPath = $alt
            Write-Host "Found icon at: $iconPath"
            break
        }
    }
    if (-not (Test-Path $iconPath)) {
        Write-Host "WARNING: No icon found — shortcut will use default EXE icon"
        $iconPath = ""
    }
}

try {
    [Win32.Shortcut]::Create($targetExe, $lnkPath, $workDir, $iconPath)
    Write-Host "Desktop shortcut created: $lnkPath"
    Write-Host "  Target: $targetExe"
    Write-Host "  Icon: $iconPath"
} catch {
    Write-Host "ERROR creating shortcut: $_"
    exit 1
}
