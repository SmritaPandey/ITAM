Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
SCRIPT_DIR = FSO.GetParentFolderName(WScript.ScriptPosition)
WshShell.CurrentDirectory = SCRIPT_DIR
WshShell.Run "cmd.exe /c run-agent.bat", 0, False
