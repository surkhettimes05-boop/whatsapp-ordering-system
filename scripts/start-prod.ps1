# Production Docker Startup Script for Windows
# Usage: .\scripts\start-prod.ps1

param(
    [ValidateSet('up', 'down', 'stop', 'restart', 'status', 'logs')]
    [string]$Action = 'up',
    
    [switch]$Detached,
    [switch]$FollowLogs
)

# Configuration
$PROJECT_DIR = (Get-Item $PSScriptRoot).Parent.FullName
$COMPOSE_FILE = "$PROJECT_DIR\docker-compose.prod.yml"
$ENV_FILE = "$PROJECT_DIR\.env.production"

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Warning { Write-Host "[WARNING] $args" -ForegroundColor Yellow }

# ============================================================================
# Validation
# ============================================================================

Write-Info "Checking dependencies..."

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not installed or not in PATH"
    exit 1
}

# Check docker-compose
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Error "docker-compose not installed or not in PATH"
    exit 1
}

# Check environment file
if (-not (Test-Path $ENV_FILE)) {
    Write-Error ".env.production not found"
    Write-Info "Copy .env.production.example to .env.production"
    exit 1
}

Write-Success "Dependencies validated"

# ============================================================================
# Create Required Directories
# ============================================================================

$DIRS = @(
    "$PROJECT_DIR\data\postgres",
    "$PROJECT_DIR\data\redis",
    "$PROJECT_DIR\data\backups",
    "$PROJECT_DIR\logs",
    "$PROJECT_DIR\uploads"
)

foreach ($dir in $DIRS) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Info "Created directory: $dir"
    }
}

Write-Success "Directories ready"

# ============================================================================
# Actions
# ============================================================================

Write-Info "Executing action: $Action"

switch ($Action) {
    'up' {
        Write-Info "Starting production services..."
        
        if ($Detached) {
            & docker compose -f $COMPOSE_FILE up -d
        } else {
            & docker compose -f $COMPOSE_FILE up
        }
        
        Write-Success "Services started"
        
        if ($FollowLogs) {
            Write-Info "Following logs (Ctrl+C to stop)..."
            & docker compose -f $COMPOSE_FILE logs -f app
        }
    }
    
    'down' {
        Write-Info "Stopping and removing services..."
        & docker compose -f $COMPOSE_FILE down
        Write-Success "Services stopped"
    }
    
    'stop' {
        Write-Info "Stopping services (graceful)..."
        & docker compose -f $COMPOSE_FILE stop
        Write-Success "Services stopped"
    }
    
    'restart' {
        Write-Info "Restarting services..."
        & docker compose -f $COMPOSE_FILE restart
        Write-Success "Services restarted"
    }
    
    'status' {
        Write-Info "Service status:"
        & docker compose -f $COMPOSE_FILE ps
    }
    
    'logs' {
        Write-Info "Following logs (Ctrl+C to stop)..."
        & docker compose -f $COMPOSE_FILE logs -f app
    }
    
    default {
        Write-Error "Unknown action: $Action"
        exit 1
    }
}

Write-Success "Action completed"

# ============================================================================
# Health Check (for 'up' action)
# ============================================================================

if ($Action -eq 'up') {
    Write-Info "Waiting for services to be ready..."
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "App is healthy"
                break
            }
        } catch {
            $attempt++
            Start-Sleep -Seconds 1
        }
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Warning "App did not become healthy within timeout"
        Write-Info "Check logs with: docker compose -f docker-compose.prod.yml logs app"
    }
}
