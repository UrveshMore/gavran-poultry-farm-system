# Registers a Windows sign-in task named Gavran. It runs scripts\start-gavran.ps1.
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'start-gavran.ps1'
$command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
schtasks.exe /Create /F /TN "Gavran" /SC ONLOGON /RL LIMITED /TR $command
Write-Output "Gavran will start when you sign in to Windows. Remove it with: schtasks /Delete /TN Gavran /F"
