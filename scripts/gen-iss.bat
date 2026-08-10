@echo off
set APPDIR=%1
if "%APPDIR%"=="" set APPDIR=..\vscode-egypt

(
echo [Setup]
echo AppId={{VSCODEEGYPT-INSTALLER-GUID-REPLACE-ME}}
echo AppName=VS Code Egypt
echo AppVersion=1.1.0
echo AppPublisher=Emperor Software Development
echo DefaultDirName={autopf}\VS Code Egypt
echo DefaultGroupName=VS Code Egypt
echo OutputDir=Output
echo OutputBaseFilename=VS-Code-Egypt-Setup
echo Compression=lzma2
echo SolidCompression=yes
echo ArchitecturesAllowed=x64
echo ArchitecturesInstallIn64BitMode=x64
echo SetupIconFile=%APPDIR%\kliopatra.ico
echo PrivilegesRequired=lowest
echo DisableDirPage=no
echo DirExistsWarning=yes
echo Uninstallable=yes
echo CreateUninstallRegKey=yes
echo UninstallDisplayName=VS Code Egypt
echo.
echo [Languages]
echo Name: "english"; MessagesFile: "compiler:Default.isl"
echo.
echo [Tasks]
echo Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"
echo.
echo [Files]
echo Source: "%APPDIR%\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
echo.
echo [Icons]
echo Name: "{userdesktop}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"; Tasks: desktopicon
echo Name: "{group}\VS Code Egypt"; Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"
echo Name: "{group}\Uninstall VS Code Egypt"; Filename: "{uninstallexe}"
echo.
echo [Run]
echo Filename: "{app}\VS Code Egypt.exe"; WorkingDir: "{app}"; Description: "Launch VS Code Egypt"; Flags: postinstall nowait skipifsilent
) > setup.iss

echo ISS file generated: setup.iss
