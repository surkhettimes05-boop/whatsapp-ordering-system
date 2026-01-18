# Setup Backend Structure
Write-Host "Creating backend structure..." -ForegroundColor Green

# Create directories
$folders = @(
    "src\config",
    "src\controllers", 
    "src\middleware",
    "src\routes",
    "src\services",
    "src\utils",
    "src\validators",
    "prisma",
    "tests"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    Write-Host "Created: $folder" -ForegroundColor Cyan
}

# Create files
$files = @(
    "src\app.js",
    "src\config\database.js",
    "src\config\constants.js",
    "src\controllers\auth.controller.js",
    "src\middleware\auth.middleware.js",
    "src\routes\auth.routes.js",
    "src\services\auth.service.js",
    "src\validators\auth.validator.js",
    ".env",
    ".env.example",
    ".gitignore"
)

foreach ($file in $files) {
    New-Item -ItemType File -Force -Path $file | Out-Null
    Write-Host "Created: $file" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Backend structure created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Directory structure:" -ForegroundColor Cyan
tree /F src