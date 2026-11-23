$inputStr = "protocol=https`nhost=github.com`n`n"
$output = $inputStr | git credential fill
$tokenLine = ($output | Select-String "password=").Line
$token = $tokenLine.Replace("password=", "").Trim()

$headers = @{
    "Authorization" = "Bearer $token"
    "User-Agent"    = "FinCore-Setup"
    "Accept"        = "application/vnd.github.v3+json"
}

$runs = Invoke-RestMethod -Uri "https://api.github.com/repos/Prakharmandloi22-sudo/FinCore/actions/runs?per_page=5" -Method Get -Headers $headers
foreach ($r in $runs.workflow_runs) {
    Write-Host "$($r.name) | Status: $($r.status) | Conclusion: $($r.conclusion) | Branch: $($r.head_branch) | Commit: $($r.head_sha.Substring(0,7))"
}

try {
    $res = Invoke-WebRequest -Uri "https://prakharmandloi22-sudo.github.io/FinCore/" -UseBasicParsing
    Write-Host "`nGitHub Pages Status: $($res.StatusCode)"
    Write-Host "Page Title matches FinCore: $($res.Content.Contains('FinCore'))"
} catch {
    Write-Host "`nGitHub Pages fetch error: $_"
}
