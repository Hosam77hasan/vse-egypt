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
            if (!string.IsNullOrEmpty(iconPath)) link.SetIconLocation(iconPath, 0);
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

try {
    [Win32.Shortcut]::Create($targetExe, $lnkPath, $workDir, $iconPath)
    Write-Host "Desktop shortcut created: $lnkPath"
} catch {
    Write-Host "ERROR creating shortcut: $_"
    exit 1
}
