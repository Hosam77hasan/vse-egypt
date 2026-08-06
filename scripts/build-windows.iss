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
AppPublisher=VS Code Egypt
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

[Icons]
Name: "{group}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"
Name: "{autodesktop}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; Tasks: desktopicon

[Registry]
; Registers the custom vscode-egypt:// protocol used by the payment portal's
; "Open in VS Code Egypt" activation link (see vse-payment-portal/public/script.js).
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: ""; ValueData: "URL:VS Code Egypt Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "vscode-egypt\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\VS Code Egypt.exe"" ""%1"""

[Run]
Filename: "{app}\VS Code Egypt.exe"; Description: "Launch VS Code Egypt"; Flags: nowait postinstall skipifsilent
