# run-all.ps1
# Start backend, payment portal, and landing site in separate PowerShell windows

$ProjectRoot = "D:\project\vscode-egypt-buildpack-session4\vscode-egypt"

function Test-ServiceFolder($path, $name) {
    if (-not (Test-Path $path)) {
        Write-Host "Folder $name not found at $path" -ForegroundColor Red
        exit 1
    }
}

Test-ServiceFolder "$ProjectRoot\vse-backend" "vse-backend"
Test-ServiceFolder "$ProjectRoot\vse-payment-portal" "vse-payment-portal"
Test-ServiceFolder "$ProjectRoot\vse-landing" "vse-landing"

Write-Host "Starting backend on port 8787 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\vse-backend'; npm start"
Start-Sleep -Seconds 3

Write-Host "Starting payment portal on port 4000 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\vse-payment-portal'; npm start"
Start-Sleep -Seconds 2

Write-Host "Starting landing page on port 5000 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\vse-landing'; npm start"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All services are running:" -ForegroundColor Cyan
Write-Host "  - Backend:        http://localhost:8787" -ForegroundColor White
Write-Host "  - Payment Portal: http://localhost:4000" -ForegroundColor White
Write-Host "  - Landing Page:   http://localhost:5000" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open http://localhost:5000 in your browser to see the landing page." -ForegroundColor Yellow
Write-Host "To stop services: close the three PowerShell windows or press Ctrl+C in each." -ForegroundColor Gray
