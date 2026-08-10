# gen-iss.ps1 - Generate Inno Setup ISS file for VS Code Egypt
param(
    [Parameter(Mandatory=$true)]
    [string]$AppDir
)

$iconFile = Join-Path $AppDir "kliopatra.ico"

$iss = @"
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
SetupIconFile=$iconFile
PrivilegesRequired=lowest
DisableDirPage=no
DirExistsWarning=yes
Uninstallable=yes
CreateUninstallRegKey=yes
UninstallDisplayName=VS Code Egypt
UninstallDisplayIcon={app}\kliopatra.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"

[Files]
Source: "$AppDir\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userdesktop}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; IconFilename: "{app}\kliopatra.ico"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{group}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; IconFilename: "{app}\kliopatra.ico"; WorkingDir: "{app}"
Name: "{group}\Uninstall VS Code Egypt"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"; Description: "Launch VS Code Egypt"; Flags: postinstall nowait skipifsilent
"@

Set-Content -Path "setup.iss" -Value $iss -Encoding UTF8
Write-Host "ISS file generated: setup.iss"
