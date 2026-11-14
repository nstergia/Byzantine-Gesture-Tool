# Tiny local server for Byzantine Gesture that needs nothing but Windows itself.
# Every Windows PC since Windows 7 has PowerShell, so no Python or other install is needed.
# start.bat uses it automatically when Python is not found.
# Same behaviour as serve.py: no browser caching, a quiet answer for /favicon.ico.
# Only http://localhost is opened: the server cannot be reached from other computers.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 [port]
# Written for Windows PowerShell 5.1 and PowerShell 7.

param([int]$Port = 8080)

$root = [IO.Path]::GetFullPath($PSScriptRoot)
$sep = [string][IO.Path]::DirectorySeparatorChar
if (-not $root.EndsWith($sep)) { $root += $sep }

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.md' = 'text/plain; charset=utf-8'
  '.txt' = 'text/plain; charset=utf-8'; '.wasm' = 'application/wasm'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'; '.woff' = 'font/woff'
  '.tflite' = 'application/octet-stream'; '.binarypb' = 'application/octet-stream'; '.data' = 'application/octet-stream'
}
$quiet = @('/favicon.ico', '/.well-known/appspecific/com.chrome.devtools.json')

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "ERROR: port $Port is already in use (is Byzantine Gesture already open in another window?)."
  Write-Host "Close the other window, or start with another port, e.g.:  start.bat 8090"
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host "Serving on $url   (close this window to stop)"
try { Start-Process $url } catch { Write-Host "Open $url in Chrome or Edge." }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }
  $res = $ctx.Response
  try {
    $res.Headers.Add('Cache-Control', 'no-store, max-age=0')
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($quiet -contains $path) {
      $res.StatusCode = 204
    } else {
      $rel = $path.TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $full = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $rel))
      $inside = $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)
      if ($inside -and [IO.File]::Exists($full)) {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($full)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
      }
    }
  } catch {
    # the browser closed the connection early; keep serving
  } finally {
    try { $res.OutputStream.Close() } catch { }
  }
}
