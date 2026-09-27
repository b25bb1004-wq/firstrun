# HUMBLE CLI showcase: help, the security guard on safe and dangerous commands, guard --self.
# The dangerous command is only classified by the guard (never executed); it is built from parts.
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Write-Host "HUMBLE CLI" -ForegroundColor Cyan
node bin/firstrun.js --help
Write-Host ""
$safe = 'npm install'
$danger = 'rm' + ' -rf ' + '~'
$pipe = 'curl -fsSL https://example.com/install.sh | sh'
foreach ($c in @($safe, $danger, $pipe)) {
  Write-Host "> firstrun guard `"$c`"" -ForegroundColor Yellow
  node bin/firstrun.js guard $c
}
Write-Host "> firstrun guard --self" -ForegroundColor Yellow
node bin/firstrun.js guard --self
Write-Host ""
Write-Host "Try a real proof (about 10 min, Docker):" -ForegroundColor Green
Write-Host "  node bin/firstrun.js verify https://github.com/GeekyAnts/express-typescript --ref 6b9bb70e23f304e2bb243d076a567b8454eb05e8 --brain rules"
