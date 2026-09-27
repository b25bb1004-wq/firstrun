# Local OCR for HUMBLE's spatial context (spec section 17, layer 2): Windows.Media.Ocr, on the machine, no network.
# Reads ONE base64 PNG from stdin (kept in memory, never written to disk) and prints lines with pixel boxes as JSON.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $task.Wait(-1)
  $task.Result
}

$bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$ms = New-Object System.IO.MemoryStream(, $bytes)
$stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) { throw 'no OCR language pack installed' }
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

$lines = foreach ($line in $result.Lines) {
  $x1 = [double]::MaxValue; $y1 = [double]::MaxValue; $x2 = 0; $y2 = 0
  foreach ($w in $line.Words) {
    $r = $w.BoundingRect
    $x1 = [Math]::Min($x1, $r.X); $y1 = [Math]::Min($y1, $r.Y)
    $x2 = [Math]::Max($x2, $r.X + $r.Width); $y2 = [Math]::Max($y2, $r.Y + $r.Height)
  }
  [pscustomobject]@{ text = $line.Text; x = [int]$x1; y = [int]$y1; width = [int]($x2 - $x1); height = [int]($y2 - $y1) }
}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$out = [pscustomobject]@{ width = $bitmap.PixelWidth; height = $bitmap.PixelHeight; lines = @($lines) }
[Console]::Out.Write(($out | ConvertTo-Json -Depth 4 -Compress))
