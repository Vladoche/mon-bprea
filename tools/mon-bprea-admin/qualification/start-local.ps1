param([Parameter(Mandatory=$true)][string]$CliPath, [switch]$Resume, [switch]$FinalCampaign, [switch]$InvitationCampaign, [switch]$CapacityCampaign,
    [ValidateSet(0,45,60,86400)][int]$RenewalOtpSeconds = 0)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$campaign=Join-Path $repo '.tmp/mon-bprea-admin-v2'
if($FinalCampaign){$campaign=Join-Path $campaign 'final-qualification'; New-Item -ItemType Directory -Path $campaign -Force | Out-Null}
$localProject=if($FinalCampaign){'mon-bprea-admin-v2-final-local'}else{'mon-bprea-admin-v2-local'}
if($InvitationCampaign){
    if($FinalCampaign){throw 'Choose a single local campaign'}
    $campaign=Join-Path $repo '.tmp/premiere-invitation-prod/qualification'
    $localProject='mon-bprea-admin-v2-invitation-local'
}
if($CapacityCampaign){
    if($FinalCampaign -or $InvitationCampaign -or $RenewalOtpSeconds){throw 'Choose a single local campaign'}
    $campaign=Join-Path $repo '.tmp/admin-23-capacity'
    $localProject='mon-bprea-admin-23-capacity-local'
}
$stage=Join-Path $campaign 'stack'
if($RenewalOtpSeconds){
    if($FinalCampaign -or $InvitationCampaign){throw 'Choose a single local campaign'}
    $campaign=Join-Path $repo ".tmp/admin-22/otp-$RenewalOtpSeconds"
    $localProject="mon-bprea-admin-22-otp-$RenewalOtpSeconds"
    $stage=Join-Path $campaign 'stack'
}
$network='bprea-admin-v2-local'
$docker=(Get-Command docker -ErrorAction Stop).Source
if((Test-Path -LiteralPath $stage) -and -not $Resume){throw 'A prior qualification stack exists; inspect it, never reset it.'}
if((& $docker --context desktop-linux context inspect desktop-linux --format '{{.Endpoints.docker.Host}}') -ne 'npipe:////./pipe/dockerDesktopLinuxEngine'){throw 'Only local Docker is allowed'}
if(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -In 4173,54321,54322,54324,54329){throw 'Qualification ports occupied'}
Get-ChildItem Env: | Where-Object Name -Match '^(SUPABASE|PG|DATABASE|POSTGRES|MON_BPREA|BPREA|DOCKER_HOST|DOCKER_CONTEXT)' | Remove-Item
if(-not $Resume){
New-Item -ItemType Directory -Path (Join-Path $stage 'supabase'),(Join-Path $stage 'cli-home') | Out-Null
$expiry=if($RenewalOtpSeconds){$RenewalOtpSeconds}else{1800}
$config=[IO.File]::ReadAllText((Join-Path $repo 'supabase/config.toml')).Replace('mon-bprea-lot6-1-local',$localProject).Replace('otp_expiry = 60',"otp_expiry = $expiry")
[IO.File]::WriteAllText((Join-Path $stage 'supabase/config.toml'),$config)
Copy-Item -LiteralPath (Join-Path $repo 'supabase/templates'),(Join-Path $repo 'supabase/functions'),(Join-Path $repo 'supabase/migrations') -Destination (Join-Path $stage 'supabase') -Recurse
} elseif(-not [IO.File]::ReadAllText((Join-Path $stage 'supabase/config.toml')).Contains('project_id = "'+$localProject+'"')){throw 'Wrong local project'}
$env:DOCKER_CONTEXT='desktop-linux'; $env:SUPABASE_TELEMETRY_DISABLED='1'; $env:DO_NOT_TRACK='1'
$env:SUPABASE_HOME=(Join-Path $stage 'cli-home')
$guard=Join-Path $campaign 'docker-guard'
if(-not (Test-Path -LiteralPath $guard)){New-Item -ItemType Directory -Path $guard | Out-Null}
$compiler=Join-Path $env:SystemRoot 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe "/out:$guard/docker.exe" (Join-Path $PSScriptRoot 'LoopbackDocker.cs')
if($LASTEXITCODE -ne 0){throw 'Loopback guard compilation failed'}
$env:BPREA_V2_DOCKER_EXE=$docker
$env:PATH=$guard+';'+$env:PATH
$env:BPREA_660C_DOCKER_NETWORK=$network
$env:BPREA_660C_DOCKER_NETWORK_ID=& $docker --context desktop-linux network ls --filter "name=^$network$" --format '{{.ID}}'
if(-not $env:BPREA_660C_DOCKER_NETWORK_ID){$env:BPREA_660C_DOCKER_NETWORK_ID=& $docker --context desktop-linux network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 $network}
if($LASTEXITCODE -ne 0){throw 'Network creation failed'}
$binding=& $docker --context desktop-linux network inspect $network --format '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}'
if($binding -ne '127.0.0.1'){throw 'Network must bind only loopback'}
& $CliPath start --workdir $stage --network-id $network --exclude studio,postgres-meta --agent no *> (Join-Path $campaign 'start.private.log')
if($LASTEXITCODE -ne 0){throw 'Local start failed; private log retained'}
$live=@(& $docker --context desktop-linux ps --filter "network=$network" --format '{{.Names}} {{.Ports}}')
if($live.Count -ne 6 -or ($live -match '0\.0\.0\.0:|\[::\]:|:::')){throw 'Loopback isolation not proven'}
& $CliPath status --workdir $stage --output json *> (Join-Path $campaign 'status.private.json')
if($LASTEXITCODE -ne 0){throw 'Local status failed'}
$live
