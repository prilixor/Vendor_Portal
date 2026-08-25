# Bake rounded corners into tab / touch icons. Chrome cannot CSS-round a favicon.
Add-Type -AssemblyName System.Drawing

function Add-RoundedRect(
  [System.Drawing.Drawing2D.GraphicsPath]$path,
  [int]$x,
  [int]$y,
  [int]$w,
  [int]$h,
  [int]$r
) {
  $d = [Math]::Max(2, $r * 2)
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}

function Save-RoundedPng(
  [string]$srcPath,
  [string]$destPath,
  [int]$size,
  [int]$radius
) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.Clear([System.Drawing.Color]::Transparent)
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      Add-RoundedRect $path 0 0 $size $size $radius
      $g.SetClip($path)
      $g.DrawImage($src, 0, 0, $size, $size)
      $path.Dispose()
    }
    finally {
      $g.Dispose()
    }
    $destDir = Split-Path -Parent $destPath
    if (-not (Test-Path $destDir)) {
      New-Item -ItemType Directory -Path $destDir | Out-Null
    }
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  }
  finally {
    $src.Dispose()
  }
}

function Save-PngIco([string]$pngPath, [string]$icoPath) {
  $png = [System.IO.File]::ReadAllBytes($pngPath)
  $ico = New-Object byte[] (22 + $png.Length)
  $ico[0] = 0; $ico[1] = 0
  $ico[2] = 1; $ico[3] = 0
  $ico[4] = 1; $ico[5] = 0
  $ico[6] = 32
  $ico[7] = 32
  $ico[8] = 0
  $ico[9] = 0
  $ico[10] = 1; $ico[11] = 0
  $ico[12] = 32; $ico[13] = 0
  [BitConverter]::GetBytes([uint32]$png.Length).CopyTo($ico, 14)
  [BitConverter]::GetBytes([uint32]22).CopyTo($ico, 18)
  [Array]::Copy($png, 0, $ico, 22, $png.Length)
  [System.IO.File]::WriteAllBytes($icoPath, $ico)
}

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "public\branding\blinksmed-mark.png"
$public = Join-Path $root "public"
$www = Join-Path (Split-Path -Parent $root) "Prilixor.VendorPortal.API\wwwroot"

Save-RoundedPng $src (Join-Path $public "bm-icon.png") 64 14
Save-RoundedPng $src (Join-Path $public "favicon-32.png") 32 7
Save-RoundedPng $src (Join-Path $public "favicon-16.png") 16 4
Save-RoundedPng $src (Join-Path $public "favicon.png") 64 14
Save-RoundedPng $src (Join-Path $public "apple-touch-icon.png") 180 40
Save-PngIco (Join-Path $public "favicon-32.png") (Join-Path $public "bm-icon.ico")
Copy-Item -Force (Join-Path $public "bm-icon.ico") (Join-Path $public "favicon.ico")

$roundedPng = [System.IO.File]::ReadAllBytes((Join-Path $public "bm-icon.png"))
$b64 = [Convert]::ToBase64String($roundedPng)
$svg = @"
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="BlinksMed">
  <image href="data:image/png;base64,$b64" width="64" height="64"/>
</svg>
"@
Set-Content -Path (Join-Path $public "bm-icon.svg") -Value $svg -Encoding utf8

if (Test-Path $www) {
  foreach ($name in @("bm-icon.png", "bm-icon.ico", "bm-icon.svg", "favicon.ico", "apple-touch-icon.png")) {
    Copy-Item -Force (Join-Path $public $name) (Join-Path $www $name) -ErrorAction SilentlyContinue
  }
}

Write-Host "Wrote rounded favicons from $src"
