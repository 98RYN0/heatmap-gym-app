param(
    [int]$Port = 5173,
    [string]$Root = (Get-Location).Path
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
        $request = $context.Request
        $response = $context.Response
        # Force each response to close its connection rather than keep-alive
        # — this server handles one request at a time (GetContext() blocks),
        # so a browser pipelining/reusing a connection for a second request
        # (e.g. the implicit favicon.ico fetch) before the first fully closes
        # was leaving responses in a bad state.
        $response.KeepAlive = $false

        $path = [Uri]::UnescapeDataString($request.Url.LocalPath)
        if ($path -eq "/") { $path = "/index.html" }
        $filePath = Join-Path $Root ($path.TrimStart("/"))

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath)
            $contentType = $mimeTypes[$ext]
            if (-not $contentType) { $contentType = "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $response.ContentLength64 = $notFound.Length
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }
    } catch {
        # Log and move on — one bad request (a dropped connection, a locked
        # file, etc.) shouldn't take down the whole dev server loop.
        Write-Host "Request error: $_"
    } finally {
        $context.Response.OutputStream.Close()
    }
}
