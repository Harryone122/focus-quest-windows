param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\previews\forest-waypoint-overlay-current.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mapPath = Join-Path $projectRoot 'src\renderer\src\exploration\MapDefinition.ts'
$imagePath = Join-Path $projectRoot 'src\renderer\src\assets\forest-dynamic-v2\static\noon.png'
$source = Get-Content -LiteralPath $mapPath -Raw
$pattern = "\{ id: '([^']+)', x: ([0-9.]+), y: ([0-9.]+), neighbors: \[([^\]]*)\]"
$matches = [regex]::Matches($source, $pattern)

$nodes = @{}
foreach ($match in $matches) {
  $neighbors = [regex]::Matches($match.Groups[4].Value, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value }
  $nodes[$match.Groups[1].Value] = @{
    X = [double]$match.Groups[2].Value
    Y = [double]$match.Groups[3].Value
    Neighbors = @($neighbors)
  }
}

$bitmap = [System.Drawing.Bitmap]::FromFile($imagePath)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(225, 232, 58, 49), 4)
$nodeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 220, 76))
$nodeOutline = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 12, 17, 19), 2)
$labelFont = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$labelBack = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 7, 11, 14))

$drawn = [System.Collections.Generic.HashSet[string]]::new()
foreach ($entry in $nodes.GetEnumerator()) {
  foreach ($neighborId in $entry.Value.Neighbors) {
    if (-not $nodes.ContainsKey($neighborId)) { continue }
    $edge = @($entry.Key, $neighborId) | Sort-Object
    $edgeKey = $edge -join '|'
    if (-not $drawn.Add($edgeKey)) { continue }
    $neighbor = $nodes[$neighborId]
    $graphics.DrawLine(
      $linePen,
      [float]($entry.Value.X * $bitmap.Width),
      [float]($entry.Value.Y * $bitmap.Height),
      [float]($neighbor.X * $bitmap.Width),
      [float]($neighbor.Y * $bitmap.Height)
    )
  }
}

foreach ($entry in $nodes.GetEnumerator()) {
  $x = [float]($entry.Value.X * $bitmap.Width)
  $y = [float]($entry.Value.Y * $bitmap.Height)
  $graphics.FillEllipse($nodeBrush, $x - 7, $y - 7, 14, 14)
  $graphics.DrawEllipse($nodeOutline, $x - 7, $y - 7, 14, 14)
  $size = $graphics.MeasureString($entry.Key, $labelFont)
  $graphics.FillRectangle($labelBack, $x + 8, $y - 16, $size.Width + 4, $size.Height)
  $graphics.DrawString($entry.Key, $labelFont, $labelBrush, $x + 10, $y - 16)
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($resolvedOutput)) | Out-Null
$bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$linePen.Dispose()
$nodeBrush.Dispose()
$nodeOutline.Dispose()
$labelFont.Dispose()
$labelBrush.Dispose()
$labelBack.Dispose()

Write-Output $resolvedOutput
