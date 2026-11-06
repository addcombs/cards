# Lets a user edit the cards in the app: creates the Cognito group `admins` in the app's user pool if
# it is missing and adds the user with the given email to it. The API allows PUT /api/cards/... only
# to members, and the UI shows the cards' edit buttons only to them. The group reaches the user's ID
# token at their next sign-in, so they must sign out and in again. Safe to re-run.
# Log: logs\card-admin.log
param([Parameter(Mandatory)][string]$Email)
. "$PSScriptRoot\common.ps1" -LogName 'card-admin.log' -Title 'card admin'
$group = 'admins'
$poolId = (Get-CognitoIds).userPoolId

$existing = Invoke-AwsCli @('cognito-idp','get-group','--user-pool-id',$poolId,'--group-name',$group,'--query','Group.GroupName','--output','text') -AllowFail -Quiet
if (-not $existing) {
  Invoke-AwsCli @('cognito-idp','create-group','--user-pool-id',$poolId,'--group-name',$group,'--description','May edit the cards') | Out-Null
  Step "group created: $group"
} else { Step "group exists: $group" }

# The pool signs in by email, so Cognito's admin calls take the email as the username.
$username = Invoke-AwsCli @('cognito-idp','admin-get-user','--user-pool-id',$poolId,'--username',$Email,'--query','Username','--output','text') -AllowFail -Quiet
if (-not $username) { Fail "No user with email $Email in pool $poolId. Register in the app first." }
Invoke-AwsCli @('cognito-idp','admin-add-user-to-group','--user-pool-id',$poolId,'--username',$username,'--group-name',$group) | Out-Null
Step "DONE. $Email is in $group; sign out of the app and back in to edit cards"
Read-Host 'Press Enter to close'
