# Uploads the card photos in ..\photos (git-ignored; PSA's image downloads, named like
# psa-order-24221025-r01-i01-94481237-1992 TOPPS GOLD 141 MICHAEL JORDAN-Front-<id>.jpg) to the photo
# bucket from create-photos-bucket.ps1:
#   photos/<photo id>/front.jpg, back.jpg     1000 px tall, served at https://<domain>/photos/
#   originals/<photo id>/front.jpg, back.jpg  as downloaded, not served
# The photo ID is the PSA cert number, or order-<order>-r<row> when the name has none; the cards
# table (<app>-api\db\migrations) refers to the photos by it. Other files are skipped. Safe to re-run:
# changed photos are replaced. Log: logs\card-photos.log
. "$PSScriptRoot\common.ps1" -LogName 'card-photos.log' -Title 'card photos'
Add-Type -AssemblyName System.Drawing
$source = Join-Path $root 'photos'
$out = Join-Path $logs 'photos'
$height = 1000

if (-not (Test-Path $source)) { Fail "no photos folder at $source." }
$account = Invoke-AwsCli @('sts','get-caller-identity','--query','Account','--output','text')
$bucket = PhotosBucket $account
if ($null -eq (Invoke-AwsCli @('s3api','head-bucket','--bucket',$bucket) -AllowFail -Quiet)) { Fail "bucket $bucket not found. Run scripts\create-photos-bucket.ps1 first." }

# --- pair the fronts and backs by photo ID ---
$cards = @{}
foreach ($file in Get-ChildItem $source -Filter '*.jpg') {
  $m = [regex]::Match($file.Name, '^psa-order-(?<order>\d+)[^-]*-r(?<row>\d+)-i\d+-(?:(?<cert>\d{6,})-)?.*-(?<side>Front|Back)-\S+\.jpg$')
  if (-not $m.Success) { Step "skipped (not a PSA card photo): $($file.Name)"; continue }
  $id = if ($m.Groups['cert'].Success) { $m.Groups['cert'].Value } else { "order-$($m.Groups['order'].Value)-r$($m.Groups['row'].Value)" }
  if (-not $cards[$id]) { $cards[$id] = @{} }
  $cards[$id][$m.Groups['side'].Value.ToLowerInvariant()] = $file
}
$incomplete = @($cards.Keys | Where-Object { -not ($cards[$_].front -and $cards[$_].back) })
if ($incomplete) { Fail "missing a front or back photo for: $(($incomplete | Sort-Object) -join ', ')" }
Step "$($cards.Count) cards: $(($cards.Keys | Sort-Object) -join ', ')"

# --- resize to $height px tall as JPEG quality 85 ---
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$quality = New-Object System.Drawing.Imaging.EncoderParameters 1
$quality.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]85)
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
foreach ($id in $cards.Keys) {
  New-Item -ItemType Directory -Force (Join-Path $out "photos\$id"), (Join-Path $out "originals\$id") | Out-Null
  foreach ($side in 'front', 'back') {
    $file = $cards[$id][$side]
    Copy-Item $file.FullName (Join-Path $out "originals\$id\$side.jpg")
    $image = [System.Drawing.Image]::FromFile($file.FullName)
    try {
      $width = [int][math]::Round($image.Width * $height / $image.Height)
      $resized = New-Object System.Drawing.Bitmap $width, $height
      $g = [System.Drawing.Graphics]::FromImage($resized)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.DrawImage($image, 0, 0, $width, $height)
      $resized.Save((Join-Path $out "photos\$id\$side.jpg"), $jpeg, $quality)
      $g.Dispose(); $resized.Dispose()
    } finally { $image.Dispose() }
  }
}
$size = (Get-ChildItem (Join-Path $out 'photos') -Recurse -File | Measure-Object Length -Sum).Sum
Step "resized to $height px tall: $([math]::Round($size / 1MB, 1)) MB in all"

# --- upload; a replaced photo shows within a day ---
Invoke-AwsCli @('s3','sync',(Join-Path $out 'photos'),"s3://$bucket/photos",'--delete','--content-type','image/jpeg','--cache-control','public,max-age=86400','--only-show-errors') | Out-Null
Invoke-AwsCli @('s3','sync',(Join-Path $out 'originals'),"s3://$bucket/originals",'--delete','--content-type','image/jpeg','--only-show-errors') | Out-Null
Step "uploaded to s3://$bucket/photos and /originals"
Step "DONE. e.g. https://$domain/photos/$(($cards.Keys | Sort-Object)[0])/front.jpg"
Read-Host 'Press Enter to close'
