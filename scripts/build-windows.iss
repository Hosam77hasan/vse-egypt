; build-windows.iss — Inno Setup script for VS Code Egypt
; Invoked by build-windows.ps1 via ISCC.exe.

#ifndef AppPath
  #define AppPath "..\VSCode-win32-x64"
#endif

[Setup]
AppId={{VSCODEEGYPT-INSTALLER-GUID-REPLACE-ME}}
AppName=VS Code Egypt
AppVersion=1.1.0
AppPublisher=Emperor Software Development
DefaultDirName={autopf}\VS Code Egypt
DefaultGroupName=VS Code Egypt
OutputDir=dist
OutputBaseFilename=VSCodeEgyptSetup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
; Use kliopatra.ico for the installer itself
SetupIconFile={#AppPath}\kliopatra.ico

; Permission: lowest avoids 0x80070005 on desktop icon
PrivilegesRequired=lowest

; Allow any partition (C, D, E…)
DisableDirPage=no
DirExistsWarning=yes

; Uninstall registration in Windows Apps & Features
Uninstallable=yes
CreateUninstallRegKey=yes
UninstallDisplayName=VS Code Egypt
UninstallDisplayIcon={app}\kliopatra.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"
Name: "addtopath"; Description: "Add to PATH (adds a 'vscode-egypt' command)"; GroupDescription: "Additional icons:"

[Files]
; Main executable first
Source: "{#AppPath}\VS Code Egypt.exe"; DestDir: "{app}"; Flags: ignoreversion
; Icon file — CRITICAL for shortcuts
Source: "{#AppPath}\kliopatra.ico"; DestDir: "{app}"; Flags: ignoreversion
; Everything else recursively
Source: "{#AppPath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Desktop shortcut — {userdesktop} avoids 0x80070005 Access Denied
Name: "{userdesktop}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; IconFilename: "{app}\kliopatra.ico"; WorkingDir: "{app}"; Tasks: desktopicon
; Start Menu shortcut
Name: "{group}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; IconFilename: "{app}\kliopatra.ico"; WorkingDir: "{app}"
; Uninstall shortcut in Start Menu
Name: "{group}\Uninstall VS Code Egypt"; Filename: "{uninstallexe}"

[Registry]
; Register vscode-egypt:// URL protocol
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: ""; ValueData: "URL:VS Code Egypt Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "vscode-egypt\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\VS Code Egypt.exe"" ""%1"""

[Run]
; Launch after install — nowait so Finish dialog doesn't hang
Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"; Description: "Launch VS Code Egypt"; Flags: postinstall nowait skipifsilent

; ═══════════════════════════════════════════════════════════════════════
; SmartScreen & MOTW mitigation — executed silently post-install
; ═══════════════════════════════════════════════════════════════════════

[Code]

{ Run fix-shortcut.ps1 — uses IShellLinkW for Unicode paths }
procedure FixDesktopShortcut();
var
  PsPath, PsArgs: String;
  ResultCode: Integer;
begin
  PsPath := ExpandConstant('{app}\fix_shortcut.ps1');
  if FileExists(PsPath) then
  begin
    PsArgs := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + PsPath + '" -AppDir "' + ExpandConstant('{app}') + '"';
    Exec('powershell.exe', PsArgs, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

{ Strip Zone.Identifier ADS from ALL installed files (recursive, best-effort) }
procedure UnblockInstalledFiles();
var
  ResultCode: Integer;
begin
  Exec('powershell.exe',
    '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command ' +
    '"Get-ChildItem -Path ''''' + ExpandConstant('{app}') + ''''' -Recurse | Unblock-File -ErrorAction SilentlyContinue"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

{ Inject self-signed .cer into TrustedPublisher (best-effort, may need admin) }
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

{ Remove .cer after use }
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
    FixDesktopShortcut();
    UnblockInstalledFiles();
    InstallTrustedPublisherCert();
    CleanupCertFile();
  end;
end;
