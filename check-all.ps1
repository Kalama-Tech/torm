# Run all SDK quality checks
# PowerShell version - Quick status check

Write-Host "🔧 TORM SDK Status Check" -ForegroundColor Cyan
Write-Host ""

$sdks = @(
    @{Name="Python"; Path="sdks\python"; Tools=@("python", "black", "ruff", "mypy", "pytest")},
    @{Name="Node.js"; Path="sdks\nodejs"; Tools=@("node", "npm")},
    @{Name="Go"; Path="sdks\go"; Tools=@("go")},
    @{Name="PHP"; Path="sdks\php"; Tools=@("php", "composer")}
)

foreach ($sdk in $sdks) {
    Write-Host "📦 $($sdk.Name) SDK" -ForegroundColor Yellow
    Write-Host "   Path: $($sdk.Path)"
    
    # Check if directory exists
    if (Test-Path $sdk.Path) {
        Write-Host "   Directory: ✓" -ForegroundColor Green
    } else {
        Write-Host "   Directory: ✗ (not found)" -ForegroundColor Red
        Write-Host ""
        continue
    }
    
    # Check tools
    Write-Host "   Tools:"
    foreach ($tool in $sdk.Tools) {
        if (Get-Command $tool -ErrorAction SilentlyContinue) {
            $version = ""
            switch ($tool) {
                "python" { $version = (& python --version 2>&1).ToString().Trim() }
                "node" { $version = "v" + (& node --version 2>&1).ToString().Trim() }
                "go" { $version = ((& go version 2>&1) -split " ")[2] }
                "php" { $version = ((& php --version 2>&1) -split "`n")[0] }
                "npm" { $version = "v" + (& npm --version 2>&1).ToString().Trim() }
            }
            Write-Host "     - $tool : ✓ $version" -ForegroundColor Green
        } else {
            Write-Host "     - $tool : ✗ (not installed)" -ForegroundColor Red
        }
    }
    Write-Host ""
}

Write-Host "💡 To run full checks for a specific SDK:" -ForegroundColor Cyan
Write-Host "   cd sdks\<sdk-name>" -ForegroundColor Gray
Write-Host "   Run the appropriate commands manually" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Status check completed!" -ForegroundColor Green


