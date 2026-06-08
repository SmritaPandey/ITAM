Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
SCRIPT_DIR = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = SCRIPT_DIR
WshShell.Run "cmd.exe /c run-agent.bat --silent", 0, False

