[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ZhiyinSourceRoot,

  [Parameter(Mandatory = $true)]
  [string]$BodyIncSourceRoot
)

$ErrorActionPreference = "Stop"
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$templateRoot = Join-Path $PSScriptRoot "playables"
$zhiyinSource = (Resolve-Path -LiteralPath $ZhiyinSourceRoot).Path
$bodySource = (Resolve-Path -LiteralPath $BodyIncSourceRoot).Path
$zhiyinOutput = Join-Path $repoRoot "zhiyin"
$bodyOutput = Join-Path $repoRoot "body-inc"
$expectedZhiyinCommit = "7fe1091b75eaea714fe053dc18a2e81bddef192b"
$expectedBodyCommit = "4cae0dac9c2b4a9f470f95a3285d3be9451b723b"

function Assert-SourceFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required source file is missing: $Path"
  }
}

function Reset-OutputDirectory {
  param(
    [string]$Path,
    [string]$ExpectedName
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $expectedPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $ExpectedName))
  if ($fullPath -ne $expectedPath -or -not $fullPath.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to reset unexpected output path: $fullPath"
  }

  if (Test-Path -LiteralPath $fullPath) {
    Remove-Item -LiteralPath $fullPath -Recurse -Force
  }
  New-Item -ItemType Directory -Path $fullPath | Out-Null
}

function Replace-Required {
  param(
    [string]$Content,
    [string]$OldValue,
    [string]$NewValue,
    [string]$Label
  )

  if (-not $Content.Contains($OldValue)) {
    throw "Expected source marker was not found: $Label"
  }
  return $Content.Replace($OldValue, $NewValue)
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Assert-GitSource {
  param(
    [string]$Root,
    [string]$ExpectedCommit,
    [string[]]$RuntimePaths,
    [string]$Label
  )

  $head = (& git -C $Root rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -ne $ExpectedCommit) {
    throw "$Label source HEAD must be $ExpectedCommit, found $head"
  }

  $diffArguments = @("-C", $Root, "diff", "--quiet", "HEAD", "--") + $RuntimePaths
  & git @diffArguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label runtime source files differ from $ExpectedCommit"
  }

  $statusArguments = @("-C", $Root, "status", "--porcelain=v1", "--untracked-files=all", "--") + $RuntimePaths
  $runtimeStatus = @(& git @statusArguments)
  if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect $Label runtime source status"
  }
  if ($runtimeStatus.Count -gt 0) {
    throw "$Label runtime source paths contain modified or untracked files: $($runtimeStatus -join '; ')"
  }
}

Assert-SourceFile (Join-Path $zhiyinSource "package.json")
Assert-SourceFile (Join-Path $zhiyinSource "src\App.tsx")
Assert-SourceFile (Join-Path $bodySource "prototype-mobile-slice\app.js")
Assert-SourceFile (Join-Path $bodySource "prototype-pixi-slice\pixi-room.js")
Assert-SourceFile (Join-Path $templateRoot "zhiyin-site-bridge.css")
Assert-SourceFile (Join-Path $templateRoot "body-index.html")
Assert-SourceFile (Join-Path $templateRoot "body-site-bridge.css")

Assert-GitSource -Root $zhiyinSource -ExpectedCommit $expectedZhiyinCommit -Label "Zhiyin" -RuntimePaths @(
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.node.json",
  "index.html",
  "src",
  "public"
)
Assert-GitSource -Root $bodySource -ExpectedCommit $expectedBodyCommit -Label "Body Inc." -RuntimePaths @(
  "prototype-mobile-slice/app.js",
  "prototype-mobile-slice/styles.css",
  "prototype-mobile-slice/ai-copy-policy.js",
  "prototype-pixi-slice/bootstrap.js",
  "prototype-pixi-slice/pixi-room.js",
  "prototype-pixi-slice/assets",
  "prototype-pixi-slice/vendor"
)

Push-Location $zhiyinSource
try {
  & npm run build -- --base=/zhiyin/
  if ($LASTEXITCODE -ne 0) {
    throw "Zhiyin build failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

Reset-OutputDirectory -Path $zhiyinOutput -ExpectedName "zhiyin"
$zhiyinAssetOutput = Join-Path $zhiyinOutput "assets"
New-Item -ItemType Directory -Path $zhiyinAssetOutput | Out-Null
Copy-Item -LiteralPath (Join-Path $zhiyinSource "dist\index.html") -Destination (Join-Path $zhiyinOutput "index.html")

$bundleFiles = Get-ChildItem -LiteralPath (Join-Path $zhiyinSource "dist\assets") -File |
  Where-Object { $_.Name -like "index-*.js" -or $_.Name -like "index-*.css" }
if (($bundleFiles | Where-Object { $_.Name -like "index-*.js" }).Count -ne 1 -or
    ($bundleFiles | Where-Object { $_.Name -like "index-*.css" }).Count -ne 1) {
  throw "Expected one Zhiyin JavaScript bundle and one CSS bundle"
}
$bundleFiles | Copy-Item -Destination $zhiyinAssetOutput
Get-ChildItem -LiteralPath (Join-Path $zhiyinSource "public\assets") -File |
  Where-Object { $_.Name -ne "background-yunnan-breeze.mp3" } |
  Copy-Item -Destination $zhiyinAssetOutput

$zhiyinBundle = Get-ChildItem -LiteralPath $zhiyinAssetOutput -Filter "index-*.js" | Select-Object -First 1
$zhiyinBundleText = (Get-Content -LiteralPath $zhiyinBundle.FullName -Raw).Replace("/assets/", "/zhiyin/assets/").TrimEnd("`r", "`n")
Write-Utf8NoBom -Path $zhiyinBundle.FullName -Content $zhiyinBundleText

$zhiyinIndexPath = Join-Path $zhiyinOutput "index.html"
$zhiyinIndex = Get-Content -LiteralPath $zhiyinIndexPath -Raw
$zhiyinIndex = Replace-Required $zhiyinIndex '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' "<meta name=`"viewport`" content=`"width=device-width, initial-scale=1.0`" />`r`n    <meta name=`"description`" content=`"知音可交互前端 Demo：把内容流里的碎片兴趣整理成一张会继续生长的灵感卡。`" />" "Zhiyin viewport"
$zhiyinIndex = Replace-Required $zhiyinIndex "  </head>" "    <link rel=`"stylesheet`" href=`"./site-bridge.css`" />`r`n  </head>" "Zhiyin head"
$zhiyinIndex = Replace-Required $zhiyinIndex "  <body>" "  <body>`r`n    <a class=`"site-return`" href=`"../#toys`" aria-label=`"返回曹弘霖个人网站`"><span aria-hidden=`"true`">↖</span><b>PLAYGROUND</b></a>" "Zhiyin body"
Write-Utf8NoBom -Path $zhiyinIndexPath -Content $zhiyinIndex
Copy-Item -LiteralPath (Join-Path $templateRoot "zhiyin-site-bridge.css") -Destination (Join-Path $zhiyinOutput "site-bridge.css")

Reset-OutputDirectory -Path $bodyOutput -ExpectedName "body-inc"
$bodySpriteOutput = Join-Path $bodyOutput "assets\sprites"
$bodyVendorOutput = Join-Path $bodyOutput "vendor"
New-Item -ItemType Directory -Path $bodySpriteOutput -Force | Out-Null
New-Item -ItemType Directory -Path $bodyVendorOutput -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $templateRoot "body-index.html") -Destination (Join-Path $bodyOutput "index.html")
Copy-Item -LiteralPath (Join-Path $templateRoot "body-site-bridge.css") -Destination (Join-Path $bodyOutput "site-bridge.css")
Copy-Item -LiteralPath (Join-Path $bodySource "prototype-mobile-slice\styles.css") -Destination (Join-Path $bodyOutput "styles.css")
Copy-Item -LiteralPath (Join-Path $bodySource "prototype-mobile-slice\ai-copy-policy.js") -Destination (Join-Path $bodyOutput "ai-copy-policy.js")
Copy-Item -LiteralPath (Join-Path $bodySource "prototype-pixi-slice\assets\office-background.png") -Destination (Join-Path $bodyOutput "assets\office-background.png")
Get-ChildItem -LiteralPath (Join-Path $bodySource "prototype-pixi-slice\assets\sprites") -File | Copy-Item -Destination $bodySpriteOutput
Copy-Item -LiteralPath (Join-Path $bodySource "prototype-pixi-slice\vendor\pixi-8.19.0.min.mjs") -Destination (Join-Path $bodyVendorOutput "pixi-8.19.0.min.mjs")
Copy-Item -LiteralPath (Join-Path $bodySource "prototype-pixi-slice\vendor\PIXI-LICENSE.txt") -Destination (Join-Path $bodyVendorOutput "PIXI-LICENSE.txt")

$bodyApp = Get-Content -LiteralPath (Join-Path $bodySource "prototype-mobile-slice\app.js") -Raw
$bodyApp = Replace-Required $bodyApp 'const aiRequestBudgetMs = 22000;' "const aiRequestBudgetMs = 22000;`r`nconst aiEndpoint = `"./api/ai-secretary`";`r`nconst aiEnabled = document.documentElement.dataset.aiSecretary === `"enabled`";" "Body AI configuration"
$bodyApp = Replace-Required $bodyApp '<p class="hint">手机竖屏体验切片。先让腿部事业群试营业，看看休息时间能不能变成办公室救火。</p>' '<p class="hint">手机竖屏可玩实验。只演示一局办公室事故，不提供训练或安全建议。</p>' "Body visible boundary"
$bodyApp = Replace-Required $bodyApp '建议 ${recommendedDurationText()}，理由是楼梯业务仍在诉讼。' '本局选择 ${recommendedDurationText()}，理由是楼梯业务仍在诉讼。' "Body duration copy"
$bodyApp = Replace-Required $bodyApp 'title: "部门使用固定值班稿",' 'title: aiEnabled ? "部门使用固定值班稿" : "静态试玩使用本地值班稿",' "Body local title"
$bodyApp = Replace-Required $bodyApp 'canRetry: state.agent.status === "failed"' 'canRetry: aiEnabled && state.agent.status === "failed"' "Body home retry"
$bodyApp = Replace-Required $bodyApp '  supersedeAgentRequest();' "  if (!aiEnabled) {`r`n    if (reportId) updateReportAgentState(reportId, { agentSource: `"local`" });`r`n    state.agent.status = `"failed`";`r`n    state.agent.error = `"AI 接口未启用，本轮使用本地预案。`";`r`n    renderAgentSurface();`r`n    return;`r`n  }`r`n`r`n  supersedeAgentRequest();" "Body AI disabled guard"
$bodyApp = Replace-Required $bodyApp 'fetch("/api/ai-secretary", {' 'fetch(aiEndpoint, {' "Body AI endpoint"
Write-Utf8NoBom -Path (Join-Path $bodyOutput "app.js") -Content $bodyApp

$bodyBootstrap = Get-Content -LiteralPath (Join-Path $bodySource "prototype-pixi-slice\bootstrap.js") -Raw
$bodyBootstrap = Replace-Required $bodyBootstrap 'await import("/assets/mobile/app.js");' 'await import("./app.js");' "Body bootstrap app import"
Write-Utf8NoBom -Path (Join-Path $bodyOutput "bootstrap.js") -Content $bodyBootstrap

$bodyPixi = Get-Content -LiteralPath (Join-Path $bodySource "prototype-pixi-slice\pixi-room.js") -Raw
$bodyPixi = Replace-Required $bodyPixi "/assets/pixi/assets/" "./assets/" "Body Pixi asset paths"
Write-Utf8NoBom -Path (Join-Path $bodyOutput "pixi-room.js") -Content $bodyPixi

Write-Output "Prepared playable routes:"
Write-Output "  $zhiyinOutput"
Write-Output "  $bodyOutput"
