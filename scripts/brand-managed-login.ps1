# Applies the app's colours to its Cognito managed-login style. config\managed-login-branding.json
# holds the style (app-like neutral backgrounds, light/dark following the visitor's system setting)
# with the theme colours as palette references such as {primary-40} or {secondary-90}; they are
# filled in from the UI's Material palettes (<app>-ui\src\app\theme\generated_theme-colors.scss,
# generated from project.json theme by scripts\start-all.ps1) by scripts\managed-login-style.ps1,
# so the sign-in page matches the app. Every deploy from main does the same, so this is only needed
# to apply them without deploying. Run scripts\create-cognito-pool.ps1 first.
# Log: logs\managed-login.log (appended); the filled-in style: logs\managed-login-branding-filled.json
. "$PSScriptRoot\common.ps1" -LogName 'managed-login.log' -AppendLog
. "$PSScriptRoot\managed-login-style.ps1"
$settings = Join-Path $config 'managed-login-branding.json'
if (-not (Test-Path $settings)) { Fail 'config\managed-login-branding.json not found.' }
$themeFile = Join-Path $uiDir 'src\app\theme\generated_theme-colors.scss'
if (-not (Test-Path $themeFile)) { Fail 'theme palettes not found. Run scripts\start-all.ps1 to generate them.' }

try { $style = Get-ManagedLoginStyle $themeFile $settings $project.theme.primary $project.theme.secondary }
catch { Fail $_.Exception.Message }
$filled = Join-Path $logs 'managed-login-branding-filled.json'
Write-Utf8 $filled $style
Step "style filled in from primary $($project.theme.primary), secondary $($project.theme.secondary): logs\managed-login-branding-filled.json"

$ids = Get-CognitoIds
$id = Invoke-AwsCli @('cognito-idp','describe-managed-login-branding-by-client','--user-pool-id',$ids.userPoolId,'--client-id',$ids.userPoolClientId,'--query','ManagedLoginBranding.ManagedLoginBrandingId','--output','text')
Invoke-AwsCli @('cognito-idp','update-managed-login-branding','--user-pool-id',$ids.userPoolId,'--managed-login-branding-id',$id,'--settings',"file://$filled",'--query','ManagedLoginBranding.LastModifiedDate','--output','text') | Out-Null
Step "BRANDING DONE: $app colours applied to style $id"
Read-Host 'Press Enter to close'
