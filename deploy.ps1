# ============================================================================
# WHATSAPP ORDERING SYSTEM - AUTOMATED DEPLOYMENT SCRIPT
# ============================================================================
# This script automates the deployment process for various platforms
# Supports: Railway, Render, Docker, and manual deployment
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("railway", "render", "docker", "manual", "local")]
    [string]$Platform,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"
$Blue = "Blue"

function Write-Step {
    param([string]$Message)
    Write-Host "🔄 $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor $Cyan
}

function Test-Command {
    param([string]$Command)
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

function Test-EnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        Write-Error "Environment file not found: $Path"
        Write-Info "Please copy from .env.example and configure with your values"
        return $false
    }
    return $true
}

function Invoke-PreDeploymentChecks {
    Write-Step "Running pre-deployment checks..."
    
    # Check if we're in the right directory
    if (-not (Test-Path "backend/package.json")) {
        Write-Error "Please run this script from the whatsapp-ordering-system root directory"
        exit 1
    }
    
    # Check required tools
    $requiredTools = @("node", "npm")
    if ($Platform -eq "docker") {
        $requiredTools += "docker"
    }
    if ($Platform -eq "railway") {
        $requiredTools += "railway"
    }
    
    foreach ($tool in $requiredTools) {
        if (-not (Test-Command $tool)) {
            Write-Error "$tool is required but not installed"
            exit 1
        }
    }
    
    # Check environment files
    $envFile = switch ($Environment) {
        "development" { "backend/.env" }
        "staging" { "backend/.env.staging" }
        "production" { "backend/.env.production" }
    }
    
    if (-not (Test-EnvFile $envFile)) {
        exit 1
    }
    
    Write-Success "Pre-deployment checks passed"
}

function Invoke-Tests {
    if ($SkipTests) {
        Write-Warning "Skipping tests (--SkipTests flag provided)"
        return
    }
    
    Write-Step "Running tests..."
    
    # Backend tests
    Set-Location backend
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.test) {
            npm test
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Backend tests failed"
                exit 1
            }
        } else {
            Write-Warning "No test script found in backend package.json"
        }
    }
    Set-Location ..
    
    # Frontend tests
    Set-Location frontend
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.test) {
            npm test -- --run
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Frontend tests failed"
                exit 1
            }
        } else {
            Write-Warning "No test script found in frontend package.json"
        }
    }
    Set-Location ..
    
    Write-Success "All tests passed"
}

function Invoke-Build {
    if ($SkipBuild) {
        Write-Warning "Skipping build (--SkipBuild flag provided)"
        return
    }
    
    Write-Step "Building application..."
    
    # Install dependencies
    Write-Step "Installing backend dependencies..."
    Set-Location backend
    npm ci --production=false
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install backend dependencies"
        exit 1
    }
    Set-Location ..
    
    Write-Step "Installing frontend dependencies..."
    Set-Location frontend
    npm ci --production=false
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install frontend dependencies"
        exit 1
    }
    
    # Build frontend
    Write-Step "Building frontend..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend build failed"
        exit 1
    }
    Set-Location ..
    
    # Generate Prisma client
    Write-Step "Generating Prisma client..."
    Set-Location backend
    npx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Prisma client generation failed"
        exit 1
    }
    Set-Location ..
    
    Write-Success "Build completed successfully"
}

function Deploy-Railway {
    Write-Step "Deploying to Railway..."
    
    # Check if Railway CLI is logged in
    railway whoami 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Please login to Railway first: railway login"
        exit 1
    }
    
    # Check if project exists
    if (-not (Test-Path "railway.toml")) {
        Write-Step "Initializing Railway project..."
        railway init
    }
    
    # Set environment variables
    Write-Step "Setting environment variables..."
    $envFile = "backend/.env.production"
    if (Test-Path $envFile) {
        $envVars = Get-Content $envFile | Where-Object { $_ -match "^[^#].*=" }
        foreach ($line in $envVars) {
            $parts = $line -split "=", 2
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim().Trim('"')
                railway variables set $key="$value"
            }
        }
    }
    
    # Deploy
    Write-Step "Deploying application..."
    railway up
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Railway deployment failed"
        exit 1
    }
    
    # Run database migrations
    Write-Step "Running database migrations..."
    railway run npx prisma migrate deploy
    
    Write-Success "Railway deployment completed"
    Write-Info "Your app should be available at: $(railway domain)"
}

function Deploy-Render {
    Write-Step "Deploying to Render..."
    
    # Create render.yaml if it doesn't exist
    if (-not (Test-Path "render.yaml")) {
        Write-Step "Creating render.yaml configuration..."
        $renderConfig = @"
services:
  - type: web
    name: whatsapp-ordering-backend
    env: node
    buildCommand: cd backend && npm ci && npx prisma generate
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: whatsapp-ordering-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: whatsapp-ordering-redis
          property: connectionString
    
  - type: web
    name: whatsapp-ordering-frontend
    env: static
    buildCommand: cd frontend && npm ci && npm run build
    staticPublishPath: frontend/dist
    
databases:
  - name: whatsapp-ordering-db
    databaseName: whatsapp_ordering
    user: postgres
    
services:
  - type: redis
    name: whatsapp-ordering-redis
    maxmemoryPolicy: allkeys-lru
"@
        Set-Content "render.yaml" $renderConfig
    }
    
    Write-Info "Render deployment requires manual setup:"
    Write-Info "1. Connect your GitHub repository to Render"
    Write-Info "2. Create services based on render.yaml"
    Write-Info "3. Set environment variables in Render dashboard"
    Write-Info "4. Deploy from Render dashboard"
    
    Write-Success "Render configuration created"
}

function Deploy-Docker {
    Write-Step "Deploying with Docker..."
    
    # Build Docker images
    Write-Step "Building Docker images..."
    docker-compose -f docker-compose.prod.yml build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed"
        exit 1
    }
    
    # Start services
    Write-Step "Starting Docker services..."
    docker-compose -f docker-compose.prod.yml up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker deployment failed"
        exit 1
    }
    
    # Wait for database to be ready
    Write-Step "Waiting for database to be ready..."
    Start-Sleep -Seconds 10
    
    # Run database migrations
    Write-Step "Running database migrations..."
    docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
    
    Write-Success "Docker deployment completed"
    Write-Info "Backend: http://localhost:5000"
    Write-Info "Frontend: http://localhost:3000"
}

function Deploy-Manual {
    Write-Step "Preparing for manual deployment..."
    
    # Create deployment package
    $deploymentDir = "deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Step "Creating deployment package: $deploymentDir"
    
    New-Item -ItemType Directory -Path $deploymentDir
    
    # Copy backend files
    Write-Step "Copying backend files..."
    Copy-Item -Path "backend" -Destination "$deploymentDir/backend" -Recurse -Exclude @("node_modules", ".env", "logs", "*.log")
    
    # Copy frontend build
    Write-Step "Copying frontend build..."
    if (Test-Path "frontend/dist") {
        Copy-Item -Path "frontend/dist" -Destination "$deploymentDir/frontend" -Recurse
    } else {
        Write-Warning "Frontend build not found. Run 'npm run build' in frontend directory first."
    }
    
    # Copy configuration files
    Copy-Item -Path "docker-compose.prod.yml" -Destination "$deploymentDir/"
    Copy-Item -Path "nginx" -Destination "$deploymentDir/nginx" -Recurse
    
    # Create deployment script
    $deployScript = @"
#!/bin/bash
# Deployment script for WhatsApp Ordering System

echo "🚀 Starting deployment..."

# Install backend dependencies
cd backend
npm ci --production
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start application
npm start
"@
    Set-Content "$deploymentDir/deploy.sh" $deployScript
    
    # Create README
    $readme = @"
# WhatsApp Ordering System - Manual Deployment

## Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+

## Deployment Steps

1. Set up environment variables:
   - Copy backend/.env.example to backend/.env
   - Configure with your production values

2. Set up database:
   - Create PostgreSQL database
   - Update DATABASE_URL in .env

3. Set up Redis:
   - Install and start Redis
   - Update REDIS_URL in .env

4. Deploy application:
   - Run: chmod +x deploy.sh && ./deploy.sh

5. Configure reverse proxy (nginx):
   - Copy nginx configuration
   - Update domain names
   - Enable SSL certificates

## Environment Variables Required
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_FROM

## Health Check
- Backend: http://your-domain:5000/health
- Frontend: http://your-domain/

For detailed configuration, see backend/.env.production.complete
"@
    Set-Content "$deploymentDir/README.md" $readme
    
    Write-Success "Manual deployment package created: $deploymentDir"
    Write-Info "Upload this directory to your server and follow README.md"
}

function Deploy-Local {
    Write-Step "Setting up local development environment..."
    
    # Start Docker services
    Write-Step "Starting local Docker services..."
    docker-compose up -d postgres redis
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Docker services failed to start. Continuing with manual setup..."
    } else {
        Start-Sleep -Seconds 5
    }
    
    # Install dependencies
    Write-Step "Installing dependencies..."
    Set-Location backend
    npm install
    Set-Location ../frontend
    npm install
    Set-Location ..
    
    # Generate Prisma client
    Write-Step "Generating Prisma client..."
    Set-Location backend
    npx prisma generate
    
    # Run migrations
    Write-Step "Running database migrations..."
    npx prisma migrate dev
    
    # Seed database
    Write-Step "Seeding database..."
    node seed-complete-data.js
    Set-Location ..
    
    Write-Success "Local development environment ready"
    Write-Info "Run './start-demo.ps1' to start all services"
}

function Show-PostDeploymentInfo {
    Write-Success "🎉 Deployment completed successfully!"
    Write-Host ""
    Write-Host "📋 Post-Deployment Checklist:" -ForegroundColor $Cyan
    Write-Host "================================" -ForegroundColor $Cyan
    Write-Host ""
    
    switch ($Platform) {
        "railway" {
            Write-Host "✅ Configure custom domain in Railway dashboard" -ForegroundColor $Green
            Write-Host "✅ Set up SSL certificate" -ForegroundColor $Green
            Write-Host "✅ Configure Twilio webhook URL" -ForegroundColor $Green
            Write-Host "✅ Test WhatsApp integration" -ForegroundColor $Green
        }
        "render" {
            Write-Host "✅ Complete Render dashboard setup" -ForegroundColor $Green
            Write-Host "✅ Configure environment variables" -ForegroundColor $Green
            Write-Host "✅ Set up custom domain" -ForegroundColor $Green
            Write-Host "✅ Configure Twilio webhook URL" -ForegroundColor $Green
        }
        "docker" {
            Write-Host "✅ Configure reverse proxy (nginx)" -ForegroundColor $Green
            Write-Host "✅ Set up SSL certificates" -ForegroundColor $Green
            Write-Host "✅ Configure domain DNS" -ForegroundColor $Green
            Write-Host "✅ Set up monitoring and backups" -ForegroundColor $Green
        }
        "manual" {
            Write-Host "✅ Upload deployment package to server" -ForegroundColor $Green
            Write-Host "✅ Follow deployment README.md" -ForegroundColor $Green
            Write-Host "✅ Configure environment variables" -ForegroundColor $Green
            Write-Host "✅ Set up reverse proxy and SSL" -ForegroundColor $Green
        }
        "local" {
            Write-Host "✅ Start services with './start-demo.ps1'" -ForegroundColor $Green
            Write-Host "✅ Access admin dashboard at http://localhost:3001" -ForegroundColor $Green
            Write-Host "✅ Test API at http://localhost:3002/health" -ForegroundColor $Green
        }
    }
    
    Write-Host ""
    Write-Host "🔧 Important Configuration:" -ForegroundColor $Yellow
    Write-Host "• Update Twilio webhook URL to your domain" -ForegroundColor $Yellow
    Write-Host "• Configure CORS_ORIGIN for your frontend domain" -ForegroundColor $Yellow
    Write-Host "• Set up monitoring and alerting" -ForegroundColor $Yellow
    Write-Host "• Configure automated backups" -ForegroundColor $Yellow
    Write-Host ""
    Write-Host "📚 Documentation:" -ForegroundColor $Cyan
    Write-Host "• API Reference: /api/v1" -ForegroundColor $Cyan
    Write-Host "• Health Check: /health" -ForegroundColor $Cyan
    Write-Host "• Admin Guide: QUICK_START_COMPLETE.md" -ForegroundColor $Cyan
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Host "🚀 WhatsApp Ordering System - Deployment Script" -ForegroundColor $Green
Write-Host "=================================================" -ForegroundColor $Cyan
Write-Host "Platform: $Platform" -ForegroundColor $Blue
Write-Host "Environment: $Environment" -ForegroundColor $Blue
Write-Host ""

try {
    # Pre-deployment checks
    Invoke-PreDeploymentChecks
    
    # Run tests
    Invoke-Tests
    
    # Build application
    Invoke-Build
    
    # Deploy based on platform
    switch ($Platform) {
        "railway" { Deploy-Railway }
        "render" { Deploy-Render }
        "docker" { Deploy-Docker }
        "manual" { Deploy-Manual }
        "local" { Deploy-Local }
    }
    
    # Show post-deployment information
    Show-PostDeploymentInfo
    
} catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "🔍 Troubleshooting:" -ForegroundColor $Yellow
    Write-Host "• Check logs above for specific error details" -ForegroundColor $Yellow
    Write-Host "• Verify all environment variables are set correctly" -ForegroundColor $Yellow
    Write-Host "• Ensure all required services are running" -ForegroundColor $Yellow
    Write-Host "• Check network connectivity and permissions" -ForegroundColor $Yellow
    exit 1
}