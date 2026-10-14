# One Node process for an always-on laptop.
# Uses the MySQL already installed on this PC. Do not start Docker, and do not start the Vite dev server.
# On a laptop with little memory, set innodb_buffer_pool_size=128M in MySQL. That is a computer setting, not a farm rule.
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
npm run laptop
