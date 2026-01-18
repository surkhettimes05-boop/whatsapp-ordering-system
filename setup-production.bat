@echo off
REM PRODUCTION HARDENING - QUICK SETUP SCRIPT (WINDOWS)

echo ================================
echo 0xA PRODUCTION HARDENING SETUP
echo ================================
echo.

REM Step 1: Check node_modules excluded
echo Checking .gitignore...
findstr /R "^node_modules" .gitignore >nul
if %ERRORLEVEL% EQU 0 (
    echo   [OK] node_modules/ excluded from git
) else (
    echo   [ERROR] node_modules/ NOT in .gitignore
    exit /b 1
)

findstr /R "^\.env$" .gitignore >nul
if %ERRORLEVEL% EQU 0 (
    echo   [OK] .env excluded from git
) else (
    echo   [ERROR] .env NOT in .gitignore
    exit /b 1
)

echo.

REM Step 2: Create .env from template
echo Setting up environment...
if not exist .env (
    copy .env.example .env
    echo   [OK] Created .env from template
    echo   [WARNING] Please edit .env with your actual values
) else (
    echo   [OK] .env already exists
)

echo.

REM Step 3: Check middleware files
echo Checking middleware files...
if exist src\middleware\errorHandler.middleware.js (
    echo   [OK] Error handler middleware found
) else (
    echo   [ERROR] Error handler middleware NOT found
    exit /b 1
)

if exist src\config\logger.js (
    echo   [OK] Logger configuration found
) else (
    echo   [ERROR] Logger configuration NOT found
    exit /b 1
)

echo.

REM Step 4: Create logs directory
echo Creating logs directory...
if not exist logs (
    mkdir logs
    echo   [OK] Logs directory created
) else (
    echo   [OK] Logs directory already exists
)

echo.

REM Step 5: Install dependencies
echo Installing dependencies...
call npm ci --production
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] Failed to install dependencies
    exit /b 1
) else (
    echo   [OK] Dependencies installed
)

echo.

REM Step 6: Generate secure keys (optional)
echo Info: To generate secure keys, run:
echo   JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
echo   WEBHOOK_TOKEN: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

echo.

REM Step 7: Summary
echo ================================
echo [OK] SETUP COMPLETE
echo ================================
echo.
echo Next steps:
echo 1. Edit .env with your configuration
echo 2. Run database migrations: npx prisma migrate deploy
echo 3. Start server: set NODE_ENV=production ^&^& npm start
echo 4. Verify: curl http://localhost:5000/health
echo.
echo For details, see:
echo   - PRODUCTION_DEPLOYMENT.md (complete guide)
echo   - BACKEND_SETUP.md (quick start)
echo   - PRODUCTION_HARDENING_SUMMARY.md (implementation)
echo.
