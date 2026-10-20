# Run locally in the VS Code terminal. Never send the key in chat.
$runwaySecureKey = Read-Host 'Paste Runway API key (input is hidden)' -AsSecureString
$runwayKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($runwaySecureKey)
try {
    $runwayPlainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($runwayKeyPointer)
    if ([string]::IsNullOrWhiteSpace($runwayPlainKey)) { throw 'API key cannot be empty.' }
    [Environment]::SetEnvironmentVariable('RUNWAYML_API_SECRET', $runwayPlainKey.Trim(), 'User')
    Write-Output 'Runway API key saved to your local user environment. No key was written to the project.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($runwayKeyPointer)
    $runwayPlainKey = $null
    $runwaySecureKey.Dispose()
}
