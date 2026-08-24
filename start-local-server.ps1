param([int]$Port = 8080)

$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python -ErrorAction SilentlyContinue }
if (-not $python) {
  Write-Error "Python is required to run this local server. Install Python or use VS Code Live Server."
  exit 1
}

Write-Host "Serving Campus Emergency Response at http://localhost:$Port"
Write-Host "Keep this window open while using the app. Press Ctrl+C to stop the server."
& $python.Source -m http.server $Port

