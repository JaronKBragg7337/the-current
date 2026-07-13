[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet(
        'dev',
        'test',
        'test:all',
        'test:coverage',
        'test:e2e',
        'build',
        'build:heartbeat',
        'build:heartbeat:verify',
        'build:github',
        'build:github:verify',
        'preview',
        'lint',
        'typecheck',
        'sim:150',
        'sim:long',
        'data:ingest',
        'assets:validate',
        'licenses:generate',
        'licenses:validate'
    )]
    [string]$Script = 'dev',

    [Parameter()]
    [string]$SourcePath = (Split-Path -Parent $PSScriptRoot),

    [Parameter()]
    [string]$CacheRoot = '',

    [Parameter()]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$')]
    [string]$ProjectKey = '',

    [Parameter()]
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NormalizedFullPath {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$BasePath
    )

    $candidate = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    }
    else {
        Join-Path -Path $BasePath -ChildPath $Path
    }

    return [System.IO.Path]::GetFullPath($candidate).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Test-PathWithin {
    param(
        [Parameter(Mandatory)]
        [string]$ChildPath,

        [Parameter(Mandatory)]
        [string]$ParentPath
    )

    $separator = [System.IO.Path]::DirectorySeparatorChar
    $normalizedChild = $ChildPath.TrimEnd($separator) + $separator
    $normalizedParent = $ParentPath.TrimEnd($separator) + $separator
    return $normalizedChild.StartsWith(
        $normalizedParent,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Get-TextSha256 {
    param(
        [Parameter(Mandatory)]
        [string]$Text
    )

    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        $hash = $algorithm.ComputeHash($bytes)
        return [System.Convert]::ToHexString($hash).ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
    }
}

function Assert-SafeCacheLayout {
    param(
        [Parameter(Mandatory)]
        [string]$ResolvedSource,

        [Parameter(Mandatory)]
        [string]$ResolvedCacheRoot,

        [Parameter(Mandatory)]
        [string]$ResolvedCacheInstance,

        [Parameter(Mandatory)]
        [string]$ResolvedWorkspace
    )

    $cacheVolumeRoot = [System.IO.Path]::GetPathRoot($ResolvedCacheRoot)
    if ([string]::IsNullOrWhiteSpace($cacheVolumeRoot)) {
        throw 'The cache root must resolve to a local drive.'
    }

    $trimmedVolumeRoot = $cacheVolumeRoot.TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    if ($ResolvedCacheRoot.Equals($trimmedVolumeRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to use a drive root as CacheRoot.'
    }

    $drive = [System.IO.DriveInfo]::new($cacheVolumeRoot)
    if (-not $drive.IsReady -or $drive.DriveFormat -ne 'NTFS') {
        throw "CacheRoot must be on a ready NTFS volume; '$cacheVolumeRoot' is not suitable."
    }

    if ($ResolvedSource.Equals($ResolvedWorkspace, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Source and cache workspace must be different directories.'
    }
    if (Test-PathWithin -ChildPath $ResolvedWorkspace -ParentPath $ResolvedSource) {
        throw 'The cache workspace must not be inside the source tree.'
    }
    if (Test-PathWithin -ChildPath $ResolvedSource -ParentPath $ResolvedWorkspace) {
        throw 'The source tree must not be inside the cache workspace.'
    }
    if (-not (Test-PathWithin -ChildPath $ResolvedCacheInstance -ParentPath $ResolvedCacheRoot)) {
        throw 'The cache instance escaped CacheRoot.'
    }
    if (-not (Test-PathWithin -ChildPath $ResolvedWorkspace -ParentPath $ResolvedCacheInstance)) {
        throw 'The cache workspace escaped its managed cache instance.'
    }
    if ((Split-Path -Leaf $ResolvedWorkspace) -ne 'workspace') {
        throw "The purge target must end in a directory named 'workspace'."
    }
}

function Invoke-Runner {
    $resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path.TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    if (-not (Test-Path -LiteralPath $resolvedSource -PathType Container)) {
        throw "SourcePath is not a directory: $resolvedSource"
    }

    $sourcePackageJson = Join-Path -Path $resolvedSource -ChildPath 'package.json'
    $sourcePackageLock = Join-Path -Path $resolvedSource -ChildPath 'package-lock.json'
    if (-not (Test-Path -LiteralPath $sourcePackageJson -PathType Leaf)) {
        throw 'SourcePath must contain package.json.'
    }
    if (-not (Test-Path -LiteralPath $sourcePackageLock -PathType Leaf)) {
        throw 'SourcePath must contain package-lock.json; this runner intentionally uses npm ci.'
    }

    $package = Get-Content -LiteralPath $sourcePackageJson -Raw | ConvertFrom-Json
    $packageName = if ($null -ne $package.name -and -not [string]::IsNullOrWhiteSpace([string]$package.name)) {
        [string]$package.name
    }
    else {
        Split-Path -Leaf $resolvedSource
    }
    $safePackageName = ($packageName -replace '[^A-Za-z0-9._-]', '-').Trim('-', '.', '_')
    if ([string]::IsNullOrWhiteSpace($safePackageName)) {
        $safePackageName = 'project'
    }

    $resolvedCacheRoot = if ([string]::IsNullOrWhiteSpace($CacheRoot)) {
        if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
            throw 'LOCALAPPDATA is not set. Pass an explicit -CacheRoot on an NTFS volume.'
        }
        Get-NormalizedFullPath -Path 'Codex\project-cache' -BasePath $env:LOCALAPPDATA
    }
    else {
        Get-NormalizedFullPath -Path $CacheRoot -BasePath (Get-Location).Path
    }

    $sourceIdentityHash = Get-TextSha256 -Text $resolvedSource.ToLowerInvariant()
    $effectiveProjectKey = if ([string]::IsNullOrWhiteSpace($ProjectKey)) {
        '{0}-{1}' -f $safePackageName, $sourceIdentityHash.Substring(0, 12)
    }
    else {
        $ProjectKey
    }
    $resolvedCacheInstance = Get-NormalizedFullPath `
        -Path $effectiveProjectKey `
        -BasePath $resolvedCacheRoot
    $resolvedWorkspace = Get-NormalizedFullPath `
        -Path 'workspace' `
        -BasePath $resolvedCacheInstance
    $resolvedState = Get-NormalizedFullPath `
        -Path 'state' `
        -BasePath $resolvedCacheInstance

    Assert-SafeCacheLayout `
        -ResolvedSource $resolvedSource `
        -ResolvedCacheRoot $resolvedCacheRoot `
        -ResolvedCacheInstance $resolvedCacheInstance `
        -ResolvedWorkspace $resolvedWorkspace

    $sourceIdentityMarker = Join-Path -Path $resolvedState -ChildPath 'source-id.sha256'
    $lockHashMarker = Join-Path -Path $resolvedState -ChildPath 'package-lock.sha256'
    $sourceLockHash = (Get-FileHash -LiteralPath $sourcePackageLock -Algorithm SHA256).Hash.ToLowerInvariant()
    $recordedSourceIdentity = if (Test-Path -LiteralPath $sourceIdentityMarker -PathType Leaf) {
        (Get-Content -LiteralPath $sourceIdentityMarker -Raw).Trim()
    }
    else {
        $null
    }
    $recordedLockHash = if (Test-Path -LiteralPath $lockHashMarker -PathType Leaf) {
        (Get-Content -LiteralPath $lockHashMarker -Raw).Trim()
    }
    else {
        $null
    }

    if ($null -ne $recordedSourceIdentity -and $recordedSourceIdentity -ne $sourceIdentityHash) {
        throw 'The managed cache belongs to a different source path. Choose another -ProjectKey or -CacheRoot.'
    }

    $workspaceExists = Test-Path -LiteralPath $resolvedWorkspace -PathType Container
    if (-not $DryRun -and $workspaceExists -and $null -eq $recordedSourceIdentity) {
        throw 'Refusing to purge an unmanaged cache workspace without a matching source identity marker.'
    }

    $cachedNodeModules = Join-Path -Path $resolvedWorkspace -ChildPath 'node_modules'
    $needsInstall = (
        $recordedLockHash -ne $sourceLockHash -or
        -not (Test-Path -LiteralPath $cachedNodeModules -PathType Container)
    )

    Write-Host "Source: $resolvedSource"
    Write-Host "Cache:  $resolvedWorkspace"
    Write-Host "Task:   npm run $Script"
    if ($DryRun) {
        Write-Host 'Mode:   dry run (no directories, files, installs, or npm scripts will be changed/run)'
        Write-Host "Sync:   would mirror filtered project source into the cache workspace"
        Write-Host "Install: $(if ($needsInstall) { 'would run npm ci' } else { 'cached package-lock hash matches; would skip npm ci' })"
        return
    }

    $robocopy = Get-Command -Name 'robocopy.exe' -ErrorAction Stop
    $npm = Get-Command -Name 'npm.cmd' -ErrorAction Stop

    New-Item -ItemType Directory -Path $resolvedCacheRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $resolvedCacheInstance -Force | Out-Null
    New-Item -ItemType Directory -Path $resolvedState -Force | Out-Null
    if (-not $workspaceExists) {
        New-Item -ItemType Directory -Path $resolvedWorkspace -Force | Out-Null
    }

    if ($null -eq $recordedSourceIdentity) {
        [System.IO.File]::WriteAllText(
            $sourceIdentityMarker,
            "$sourceIdentityHash`n",
            [System.Text.UTF8Encoding]::new($false)
        )
    }

    # These checks are intentionally repeated immediately before robocopy /MIR,
    # because /MIR is the only operation here that purges stale destination files.
    Assert-SafeCacheLayout `
        -ResolvedSource $resolvedSource `
        -ResolvedCacheRoot $resolvedCacheRoot `
        -ResolvedCacheInstance $resolvedCacheInstance `
        -ResolvedWorkspace $resolvedWorkspace
    $markerBeforePurge = (Get-Content -LiteralPath $sourceIdentityMarker -Raw).Trim()
    if ($markerBeforePurge -ne $sourceIdentityHash) {
        throw 'Source identity changed before synchronization; refusing to purge the cache.'
    }

    $excludedDirectoryNames = @(
        '.git',
        'node_modules',
        'dist',
        'coverage',
        '.vite',
        '.turbo',
        '.npm',
        '.pnpm-store',
        'playwright-report',
        'test-results',
        'blob-report',
        '.auth',
        'browser-data',
        'user-data-dir'
    )
    $excludedRelativeDirectories = @(
        'data\raw',
        'data\cache',
        'data\saves',
        'assets\source-cache',
        'assets\work',
        'assets\generated',
        'benchmarks\results'
    )
    $excludedDirectories = [System.Collections.Generic.List[string]]::new()
    foreach ($name in $excludedDirectoryNames) {
        $excludedDirectories.Add($name)
    }
    foreach ($relativeDirectory in $excludedRelativeDirectories) {
        $excludedDirectories.Add((Join-Path -Path $resolvedSource -ChildPath $relativeDirectory))
        $excludedDirectories.Add((Join-Path -Path $resolvedWorkspace -ChildPath $relativeDirectory))
    }
    $excludedDirectories.Add($cachedNodeModules)

    $excludedFiles = @(
        '.env',
        '.env.*',
        '*.pem',
        '*.key',
        '*.p12',
        '*.pfx',
        'credentials*.json',
        'secrets*.json',
        'cookies*.json',
        'storage-state*.json',
        '*.log',
        '*.dmp',
        '*.tsbuildinfo',
        '*.blend1',
        '*.blend2',
        '.DS_Store',
        'Thumbs.db',
        'Desktop.ini'
    )

    $robocopyArguments = [System.Collections.Generic.List[string]]::new()
    $robocopyArguments.Add($resolvedSource)
    $robocopyArguments.Add($resolvedWorkspace)
    foreach ($argument in @(
        '/MIR',
        '/COPY:DAT',
        '/DCOPY:DAT',
        '/R:2',
        '/W:1',
        '/XJ',
        '/FFT',
        '/NP',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/XD'
    )) {
        $robocopyArguments.Add($argument)
    }
    foreach ($directory in $excludedDirectories) {
        $robocopyArguments.Add($directory)
    }
    $robocopyArguments.Add('/XF')
    foreach ($filePattern in $excludedFiles) {
        $robocopyArguments.Add($filePattern)
    }

    & $robocopy.Source @robocopyArguments
    $syncExitCode = $LASTEXITCODE
    if ($syncExitCode -ge 8) {
        throw "Filtered source synchronization failed with robocopy exit code $syncExitCode."
    }

    $cachedPackageJson = Join-Path -Path $resolvedWorkspace -ChildPath 'package.json'
    $cachedPackageLock = Join-Path -Path $resolvedWorkspace -ChildPath 'package-lock.json'
    if (
        -not (Test-Path -LiteralPath $cachedPackageJson -PathType Leaf) -or
        -not (Test-Path -LiteralPath $cachedPackageLock -PathType Leaf)
    ) {
        throw 'Synchronization did not produce package.json and package-lock.json in the cache.'
    }
    $cachedLockHash = (Get-FileHash -LiteralPath $cachedPackageLock -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($cachedLockHash -ne $sourceLockHash) {
        throw 'Cached package-lock.json does not match the source after synchronization.'
    }

    Push-Location -LiteralPath $resolvedWorkspace
    try {
        if ($needsInstall) {
            Write-Host 'Dependencies: package-lock changed or cache is incomplete; running npm ci.'
            & $npm.Source ci --no-audit --no-fund
            $installExitCode = $LASTEXITCODE
            if ($installExitCode -ne 0) {
                exit $installExitCode
            }
            [System.IO.File]::WriteAllText(
                $lockHashMarker,
                "$sourceLockHash`n",
                [System.Text.UTF8Encoding]::new($false)
            )
        }
        else {
            Write-Host 'Dependencies: package-lock hash unchanged; using the existing NTFS cache.'
        }

        & $npm.Source run $Script
        $taskExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    exit $taskExitCode
}

try {
    Invoke-Runner
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
