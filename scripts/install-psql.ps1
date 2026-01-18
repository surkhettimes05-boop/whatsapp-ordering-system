# install-psql.ps1
# Elevates to admin if needed, installs PostgreSQL via Chocolatey, and verifies psql.
param()

function Test-Admin {
  $current = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $current.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

if (-not (Test-Admin)) {
  Write-Host "Script requires elevation. Relaunching as Administrator..."
  Start-Process -FilePath pwsh -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File \"$PSCommandPath\"" -Verb RunAs
  exit
}

# Ensure Chocolatey exists
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
  Write-Host "Chocolatey not found. Installing Chocolatey..."
  Set-ExecutionPolicy Bypass -Scope Process -Force
  iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Install PostgreSQL (provides psql). You may choose a specific package like postgresql14/postgresql15/postgresql18.
Write-Host "Installing PostgreSQL (psql) via Chocolatey..."
choco install postgresql --yes

if ($LASTEXITCODE -ne 0) {
  Write-Error "Chocolatey install failed. Check C:\ProgramData\chocolatey\logs\chocolatey.log"
  exit 1
}

Write-Host "Verifying psql availability..."
$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
  & psql --version
  Write-Host "psql installed successfully. You can now run the migration commands."
  Write-Host "Example (PowerShell):"
  Write-Host "$env:DATABASE_URL = \"postgresql://testuser:testpassword@localhost:5432/testdb\""
  Write-Host "psql $env:DATABASE_URL -f backend/prisma/migrations/20260117_production_safety/migration.sql"
  Write-Host "psql $env:DATABASE_URL -f backend/prisma/migrations/20260117_production_safety/validation_tests.sql"
} else {
  Write-Error "psql not found after install. You may need to open a new shell or add PostgreSQL bin folder to PATH."
}
