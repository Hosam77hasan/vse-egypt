#!/usr/bin/env python3
"""Generate Inno Setup ISS file for VS Code Egypt build."""
import sys
import os

app_dir = sys.argv[1].replace('\\', '/')
icon_file = app_dir + '/kliopatra.ico'

lines = [
    '[Setup]',
    'AppId={{VSCODEEGYPT-INSTALLER-GUID-REPLACE-ME}}',
    'AppName=VS Code Egypt',
    'AppVersion=1.1.0',
    'AppPublisher=Emperor Software Development',
    'DefaultDirName={autopf}\\VS Code Egypt',
    'DefaultGroupName=VS Code Egypt',
    'OutputDir=Output',
    'OutputBaseFilename=VS-Code-Egypt-Setup',
    'Compression=lzma2',
    'SolidCompression=yes',
    'ArchitecturesAllowed=x64',
    'ArchitecturesInstallIn64BitMode=x64',
    f'SetupIconFile={icon_file}',
    'PrivilegesRequired=lowest',
    'DisableDirPage=no',
    'DirExistsWarning=yes',
    'Uninstallable=yes',
    'CreateUninstallRegKey=yes',
    'UninstallDisplayName=VS Code Egypt',
    'UninstallDisplayIcon={app}\\kliopatra.ico',
    '',
    '[Languages]',
    'Name: "english"; MessagesFile: "compiler:Default.isl"',
    '',
    '[Tasks]',
    'Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"',
    '',
    '[Files]',
    f'Source: "{app_dir}\\*"; DestDir: "{{app}}"; Flags: ignoreversion recursesubdirs createallsubdirs',
    '',
    '[Icons]',
    'Name: "{userdesktop}\\VS Code Egypt"; Filename: "{app}\\VS Code Egypt.exe"; IconFilename: "{app}\\kliopatra.ico"; WorkingDir: "{app}"; Tasks: desktopicon',
    'Name: "{group}\\VS Code Egypt"; Filename: "{app}\\VS Code Egypt.exe"; IconFilename: "{app}\\kliopatra.ico"; WorkingDir: "{app}"',
    'Name: "{group}\\Uninstall VS Code Egypt"; Filename: "{uninstallexe}"',
    '',
    '[Registry]',
    'Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: ""; ValueData: "URL:VS Code Egypt Protocol"; Flags: uninsdeletekey',
    'Root: HKCR; Subkey: "vscode-egypt"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""',
    '',
    '[Run]',
    'Filename: "{app}\\VS Code Egypt.exe"; WorkingDir: "{app}"; Description: "Launch VS Code Egypt"; Flags: postinstall nowait skipifsilent',
    '',
]

with open('setup.iss', 'w', encoding='ascii', newline='\r\n') as f:
    f.write('\r\n'.join(lines))

print(f'ISS file generated: setup.iss ({os.path.getsize("setup.iss")} bytes)')
