param([Parameter(Mandatory=$true)][string]$StoryboardPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$storyPath=(Resolve-Path -LiteralPath $StoryboardPath).Path
$scenes=Get-Content -LiteralPath $storyPath -Raw -Encoding UTF8 | ConvertFrom-Json
$directory=Split-Path -Parent $storyPath
$voice=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice.SelectVoice('Microsoft Zira Desktop')
  $voice.Rate=2
  for($index=0; $index -lt $scenes.Count; $index++) {
    $audioPath=Join-Path $directory ('narration-' + $index + '.wav')
    $voice.SetOutputToWaveFile($audioPath)
    $voice.Speak($scenes[$index].speech)
    $voice.SetOutputToNull()
  }
} finally { $voice.Dispose() }
Write-Output 'Created synthetic narration clips. No microphone recording was used.'
