param([int]$Port = 8080)

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Error "Could not start http://localhost:$Port. Try: .\start-local-server.ps1 -Port 8081"; exit 1 }
$mimeTypes = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8"; ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".svg"="image/svg+xml" }
Write-Host "Serving Campus Emergency Response at http://localhost:$Port"
Write-Host "Open that address in your browser. Press Ctrl+C to stop the server."
try {
  while ($listener.IsListening) {
    $context = $listener.GetContext(); $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = "index.html" }
    $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    if (-not $filePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) { $context.Response.StatusCode = 404; $bytes = [Text.Encoding]::UTF8.GetBytes("Not found") }
    else { $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant(); $context.Response.ContentType = $mimeTypes[$extension] ?? "application/octet-stream"; $bytes = [System.IO.File]::ReadAllBytes($filePath) }
    $context.Response.ContentLength64 = $bytes.Length; $context.Response.OutputStream.Write($bytes, 0, $bytes.Length); $context.Response.Close()
  }
} finally { $listener.Close() }

