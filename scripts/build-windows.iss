; build-windows.iss — Inno Setup script for VS Code Egypt
; Invoked by build-windows.ps1 via ISCC.exe. Not run in this session — see the
; NOT RUN notice in build-windows.ps1.

#ifndef AppPath
  #define AppPath "..\VSCode-win32-x64"
#endif

[Setup]
AppId={{VSCODEEGYPT-INSTALLER-GUID-REPLACE-ME}}
AppName=VS Code Egypt
AppVersion=1.0.0
AppPublisher=Emperor Software Development
DefaultDirName={autopf}\VS Code Egypt
DefaultGroupName=VS Code Egypt
OutputDir=dist
OutputBaseFilename=VSCodeEgyptSetup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=..\resources\win32\code.ico
UninstallDisplayIcon={app}\VS Code Egypt.exe

; ── Permission fix: lowest privilege mode avoids 0x80070005 (Access Denied)
; by not requiring admin elevation for desktop-icon creation. The installer
; still prompts for elevation only when writing under {autopf} (Program Files),
; and {userdesktop} (used in [Icons]) doesn't need elevation at all. ──
PrivilegesRequired=lowest

; Allow installation on any drive/partition (C, D, E, …) — the directory
; page is always shown so the user can pick any path they want.
DisableDirPage=no
DirExistsWarning=yes

; ── Code signing (optional — set in build-windows.ps1 via /DSignTool=...)
; Real production builds should set SignTool= here to sign the installer itself,
; in addition to signing the individual binaries in build-windows.ps1 — Windows
; checks both.

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"
Name: "addtopath"; Description: "Add to PATH (adds a 'vscode-egypt' command)"; GroupDescription: "Additional icons:"

[Files]
Source: "{#AppPath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── Bundle Kliopatra icon into the install directory so the desktop shortcut
; always has an icon to point at, regardless of which partition the user picks.
Source: "..\resources\win32\kliopatra.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Start Menu shortcut — uses {group} (resolved to user's Start Menu, not all-users)
Name: "{group}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; IconFilename: "{app}\kliopatra.ico"
; Desktop shortcut — {userdesktop} instead of {commondesktop} avoids 0x80070005
Name: "{userdesktop}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; IconFilename: "{app}\kliopatra.ico"; Tasks: desktopicon

[Registry]
; Registers the custom vscode-egypt:// protocol used by the payment portal's
; "Open in VS Code Egypt" activation link (see vse-payment-portal/public/script.js).
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: ""; ValueData: "URL:VS Code Egypt Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "vscode-egypt\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\VS Code Egypt.exe"" ""%1"""

[Run]
Filename: "{app}\VS Code Egypt.exe"; Description: "Launch VS Code Egypt"; Flags: nowait postinstall skipifsilent

; ═══════════════════════════════════════════════════════════════════════
; SmartScreen & MOTW mitigation — executed silently during install
; ═══════════════════════════════════════════════════════════════════════

[Code]

{ ── Unblock-File equivalent: strip the Zone.Identifier ADS from every
   .exe/.dll in the install tree so Windows doesn't show SmartScreen
   "this file came from the internet" warnings on first launch. ── }
procedure UnblockInstalledFiles();
var
  ResultCode: Integer;
begin
  Exec('powershell.exe',
    '-NoProfile -NonInteractive -WindowStyle Hidden -Command ' +
    '"Get-ChildItem -Path ''''' + ExpandConstant('{app}') + ''''' -Recurse -Include *.exe,*.dll | Unblock-File -ErrorAction SilentlyContinue"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

{ ── Self-signed cert injection: if build-windows.ps1 bundled a self-signed
   .cer alongside kliopatra.ico (see the build script's step 3b), install it
   into the machine's TrustedPublisher store so the signed .exe doesn't
   trigger SmartScreen "Unknown Publisher" after the MOTW strip above. ── }
procedure InstallTrustedPublisherCert();
var
  CertPath: String;
  ResultCode: Integer;
begin
  CertPath := ExpandConstant('{app}\vse-code-signing.cer');
  if FileExists(CertPath) then
  begin
    Exec('certutil.exe',
      '-addstore -f "TrustedPublisher" "' + CertPath + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

{ ── Clean up the .cer after it's been added to the store — it has no
   purpose sitting on disk post-install. ── }
procedure CleanupCertFile();
var
  CertPath: String;
begin
  CertPath := ExpandConstant('{app}\vse-code-signing.cer');
  if FileExists(CertPath) then
    DeleteFile(CertPath);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    UnblockInstalledFiles();
    InstallTrustedPublisherCert();
    CleanupCertFile();
  end;
end;
