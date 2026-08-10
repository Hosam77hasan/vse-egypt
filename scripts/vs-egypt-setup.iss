; vs-egypt-setup.iss — Static Inno Setup script for VS Code Egypt
; This file is used directly by the GitHub Actions build workflow.
; All paths are relative to the working directory where ISCC.exe is run.

[Setup]
AppId={{VSCODEEGYPT-INSTALLER-GUID-REPLACE-ME}}
AppName=VS Code Egypt
AppVersion=1.1.0
AppPublisher=Emperor Software Development
DefaultDirName={autopf}\VS Code Egypt
DefaultGroupName=VS Code Egypt
OutputDir=Output
OutputBaseFilename=VS-Code-Egypt-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
DisableDirPage=no
DirExistsWarning=yes
Uninstallable=yes
CreateUninstallRegKey=yes
UninstallDisplayName=VS Code Egypt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"

[Files]
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userdesktop}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{group}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"
Name: "{group}\Uninstall VS Code Egypt"; Filename: "{uninstallexe}"

[Registry]
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: ""; ValueData: "URL:VS Code Egypt Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""

[Run]
Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"; Description: "Launch VS Code Egypt"; Flags: postinstall nowait skipifsilent
