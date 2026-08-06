# run-all.ps1
# ============================================================================
#  بيشغل الباك إند وبوابة الدفع والموقع التسويقي، كل واحد في نافذة PowerShell
#  منفصلة، عشان تقدر تشوف اللوج بتاع كل واحد لوحده.
#
#  شغّله بعد ما install-vscode-egypt.ps1 يخلص بنجاح.
# ============================================================================

$ProjectRoot = "C:\Dev"

function Test-ServiceFolder($path, $name) {
    if (-not (Test-Path $path)) {
        Write-Host "مش لاقي فولدر $name في $path — شغّل install-vscode-egypt.ps1 الأول." -ForegroundColor Red
        exit 1
    }
}

Test-ServiceFolder "$ProjectRoot\vse-backend" "vse-backend"
Test-ServiceFolder "$ProjectRoot\vse-payment-portal" "vse-payment-portal"
Test-ServiceFolder "$ProjectRoot\vse-landing" "vse-landing"

Write-Host "بيتم فتح الباك إند على المنفذ 8787 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\vse-backend'; npm start"
Start-Sleep -Seconds 3

Write-Host "بيتم فتح بوابة الدفع على المنفذ 4000 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\vse-payment-portal'; npm start"
Start-Sleep -Seconds 2

Write-Host "بيتم فتح الموقع التسويقي على المنفذ 5000 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\vse-landing'; npm start"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  كل الخدمات شغالة دلوقتي:" -ForegroundColor Cyan
Write-Host "  - الباك إند:        http://localhost:8787" -ForegroundColor White
Write-Host "  - بوابة الدفع:      http://localhost:4000" -ForegroundColor White
Write-Host "  - الموقع التسويقي:  http://localhost:5000" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "افتح http://localhost:5000 في المتصفح عشان تشوف الموقع." -ForegroundColor Yellow
Write-Host "لتشغيل المحرر نفسه (VS Code Egypt)، افتح فولدر vscode-egypt\vscode وشغّل: .\scripts\code.bat" -ForegroundColor Yellow
Write-Host ""
Write-Host "لإيقاف الخدمات: قفل نوافذ PowerShell التلاتة اللي اتفتحوا، أو اضغط Ctrl+C في كل واحدة." -ForegroundColor Gray
