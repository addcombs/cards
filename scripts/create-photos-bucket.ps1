# Creates the private card-photo bucket and serves it from the UI's CloudFront distribution at
# https://<domain>/photos/ (bucket keys photos/<photo id>/front.jpg and back.jpg, uploaded by
# upload-card-photos.ps1). The photos are kept apart from the UI bucket, which deploy-ui empties of
# anything not in the build. The distribution reaches the bucket through the UI's origin access
# control, and the bucket policy lets only that distribution read it. Safe to re-run: the bucket,
# origin and behavior are reused. Log: logs\photos-bucket.log
. "$PSScriptRoot\common.ps1" -LogName 'photos-bucket.log' -Title 'photos bucket'
# AWS managed policy ID
$cachingOptimized = '658327ea-f89d-4fab-a63d-7e88639e58f6'
$originId = 's3-photos'

$account = Invoke-AwsCli @('sts','get-caller-identity','--query','Account','--output','text')
$bucket = PhotosBucket $account
$existing = Invoke-AwsCli @('cloudfront','list-distributions','--query',"DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '$domain')].[Id,ARN] | [0]",'--output','text')
if (-not $existing -or $existing -eq 'None') { Fail "No CloudFront distribution for $domain. Run scripts\create-cloudfront.ps1 first." }
$distId, $distArn = $existing -split '\s+'
Step "account: $account, bucket: $bucket, distribution: $distId"

# --- bucket ---
if ($null -eq (Invoke-AwsCli @('s3api','head-bucket','--bucket',$bucket) -AllowFail -Quiet)) {
  Invoke-AwsCli @('s3api','create-bucket','--bucket',$bucket,'--create-bucket-configuration',"LocationConstraint=$awsRegion") | Out-Null
  Invoke-AwsCli @('s3api','put-public-access-block','--bucket',$bucket,'--public-access-block-configuration','BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true') | Out-Null
  Step "bucket created: $bucket (public access blocked)"
} else { Step "bucket exists: $bucket" }

# --- bucket policy: only this distribution may read ---
$policy = '{"Version":"2012-10-17","Statement":[{"Sid":"AllowCloudFrontRead","Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},"Action":"s3:GetObject","Resource":"arn:aws:s3:::' + $bucket + '/*","Condition":{"StringEquals":{"AWS:SourceArn":"' + $distArn + '"}}}]}'
$policyFile = Join-Path $logs 'photos-bucket-policy.json'
Write-Utf8 $policyFile $policy
Invoke-AwsCli @('s3api','put-bucket-policy','--bucket',$bucket,'--policy',"file://$policyFile") | Out-Null
Step "bucket policy set: only $distId can read $bucket"

# --- origin and photos/* behavior on the UI's distribution ---
$current = Invoke-AwsCli @('cloudfront','get-distribution-config','--id',$distId,'--output','json') | ConvertFrom-Json
$cfg = $current.DistributionConfig
$origins = @($cfg.Origins.Items)
$behaviors = @(if ($cfg.CacheBehaviors.Quantity -gt 0) { $cfg.CacheBehaviors.Items })
if (($origins | Where-Object Id -eq $originId) -and ($behaviors | Where-Object PathPattern -eq 'photos/*')) {
  Step "distribution already serves photos/* from $originId"
} else {
  # CloudFront wants every field of a new origin and behavior, so copy the UI's and change what differs.
  # The UI origin's access control signs requests to any S3 bucket in the account.
  $uiOrigin = $origins | Where-Object Id -eq 's3-ui'
  if (-not $uiOrigin.OriginAccessControlId) { Fail "the distribution has no s3-ui origin with an access control." }
  $origin = $uiOrigin | ConvertTo-Json -Depth 20 | ConvertFrom-Json
  $origin.Id = $originId
  $origin.DomainName = "$bucket.s3.$awsRegion.amazonaws.com"
  $origins = @($origins | Where-Object Id -ne $originId) + $origin
  $behavior = $cfg.DefaultCacheBehavior | ConvertTo-Json -Depth 20 | ConvertFrom-Json
  $behavior | Add-Member -NotePropertyName PathPattern -NotePropertyValue 'photos/*'
  $behavior.TargetOriginId = $originId
  $behavior.CachePolicyId = $cachingOptimized
  # JPEGs are already compressed.
  $behavior.Compress = $false
  $behaviors = @($behaviors | Where-Object PathPattern -ne 'photos/*') + $behavior
  $cfg.Origins = @{ Quantity = $origins.Count; Items = $origins }
  $cfg.CacheBehaviors = @{ Quantity = $behaviors.Count; Items = $behaviors }
  $configFile = Write-Json (Join-Path $logs 'photos-distribution-config.json') $cfg
  Invoke-AwsCli @('cloudfront','update-distribution','--id',$distId,'--if-match',$current.ETag,'--distribution-config',"file://$configFile",'--query','Distribution.Status','--output','text') | Out-Null
  Step "distribution updated: photos/* -> $originId (deploying takes about 5 minutes)"
}
Step "DONE. Next run scripts\upload-card-photos.ps1; photos are served from https://$domain/photos/"
Read-Host 'Press Enter to close'
