$max = 30
for ($i = 0; $i -lt $max; $i = $i + 1) {
  docker compose -f 'C:\WEB\AGENT_OPS_PLATFORM\docker-compose.yml' ps > $null 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Output 'DOCKER_READY'; exit 0 }
  Start-Sleep -Seconds 5
}
Write-Output 'TIMEOUT'
