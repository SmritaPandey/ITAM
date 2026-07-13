import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';

/** Popular Windows apps (winget IDs) — expanded with brew monikers where known. */
const WINGET_POPULAR: { packageId: string; name: string; publisher?: string }[] = [
  { packageId: 'Google.Chrome', name: 'Google Chrome', publisher: 'Google' },
  { packageId: 'Mozilla.Firefox', name: 'Mozilla Firefox', publisher: 'Mozilla' },
  { packageId: 'Microsoft.Edge', name: 'Microsoft Edge', publisher: 'Microsoft' },
  { packageId: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', publisher: 'Microsoft' },
  { packageId: 'Microsoft.VisualStudio.2022.Community', name: 'Visual Studio 2022 Community', publisher: 'Microsoft' },
  { packageId: 'Microsoft.VisualStudio.2022.Professional', name: 'Visual Studio 2022 Professional', publisher: 'Microsoft' },
  { packageId: 'Microsoft.PowerShell', name: 'PowerShell', publisher: 'Microsoft' },
  { packageId: 'Microsoft.WindowsTerminal', name: 'Windows Terminal', publisher: 'Microsoft' },
  { packageId: 'Microsoft.PowerToys', name: 'PowerToys', publisher: 'Microsoft' },
  { packageId: 'Microsoft.DotNet.SDK.8', name: '.NET SDK 8', publisher: 'Microsoft' },
  { packageId: 'Microsoft.DotNet.Runtime.8', name: '.NET Runtime 8', publisher: 'Microsoft' },
  { packageId: 'Microsoft.Teams', name: 'Microsoft Teams', publisher: 'Microsoft' },
  { packageId: 'Microsoft.Office', name: 'Microsoft 365 Apps', publisher: 'Microsoft' },
  { packageId: 'Microsoft.OneDrive', name: 'OneDrive', publisher: 'Microsoft' },
  { packageId: 'Microsoft.PowerBI', name: 'Power BI Desktop', publisher: 'Microsoft' },
  { packageId: 'Microsoft.SQLServerManagementStudio', name: 'SQL Server Management Studio', publisher: 'Microsoft' },
  { packageId: 'Microsoft.AzureCLI', name: 'Azure CLI', publisher: 'Microsoft' },
  { packageId: 'Microsoft.AzureStorageExplorer', name: 'Azure Storage Explorer', publisher: 'Microsoft' },
  { packageId: 'Microsoft.Sysinternals.ProcessExplorer', name: 'Process Explorer', publisher: 'Microsoft' },
  { packageId: 'Microsoft.Sysinternals.ProcessMonitor', name: 'Process Monitor', publisher: 'Microsoft' },
  { packageId: '7zip.7zip', name: '7-Zip', publisher: 'Igor Pavlov' },
  { packageId: 'VideoLAN.VLC', name: 'VLC media player', publisher: 'VideoLAN' },
  { packageId: 'Notepad++.Notepad++', name: 'Notepad++', publisher: 'Don Ho' },
  { packageId: 'Git.Git', name: 'Git', publisher: 'Git Development Community' },
  { packageId: 'GitHub.cli', name: 'GitHub CLI', publisher: 'GitHub' },
  { packageId: 'GitHub.GitHubDesktop', name: 'GitHub Desktop', publisher: 'GitHub' },
  { packageId: 'OpenJS.NodeJS.LTS', name: 'Node.js LTS', publisher: 'OpenJS Foundation' },
  { packageId: 'Python.Python.3.12', name: 'Python 3.12', publisher: 'Python Software Foundation' },
  { packageId: 'Python.Python.3.11', name: 'Python 3.11', publisher: 'Python Software Foundation' },
  { packageId: 'Oracle.JavaRuntimeEnvironment', name: 'Java Runtime Environment', publisher: 'Oracle' },
  { packageId: 'Oracle.JDK.21', name: 'Oracle JDK 21', publisher: 'Oracle' },
  { packageId: 'EclipseAdoptium.Temurin.21.JDK', name: 'Eclipse Temurin JDK 21', publisher: 'Eclipse Adoptium' },
  { packageId: 'Adobe.Acrobat.Reader.64-bit', name: 'Adobe Acrobat Reader', publisher: 'Adobe' },
  { packageId: 'Adobe.CreativeCloud', name: 'Adobe Creative Cloud', publisher: 'Adobe' },
  { packageId: 'SlackTechnologies.Slack', name: 'Slack', publisher: 'Slack Technologies' },
  { packageId: 'Zoom.Zoom', name: 'Zoom', publisher: 'Zoom Video Communications' },
  { packageId: 'Discord.Discord', name: 'Discord', publisher: 'Discord' },
  { packageId: 'Telegram.TelegramDesktop', name: 'Telegram Desktop', publisher: 'Telegram' },
  { packageId: 'WhatsApp.WhatsApp', name: 'WhatsApp', publisher: 'WhatsApp' },
  { packageId: 'Spotify.Spotify', name: 'Spotify', publisher: 'Spotify' },
  { packageId: 'Dropbox.Dropbox', name: 'Dropbox', publisher: 'Dropbox' },
  { packageId: 'Google.GoogleDrive', name: 'Google Drive', publisher: 'Google' },
  { packageId: 'Google.Chrome.EXE', name: 'Google Chrome (EXE)', publisher: 'Google' },
  { packageId: 'Brave.Brave', name: 'Brave Browser', publisher: 'Brave Software' },
  { packageId: 'Opera.Opera', name: 'Opera', publisher: 'Opera' },
  { packageId: 'Vivaldi.Vivaldi', name: 'Vivaldi', publisher: 'Vivaldi Technologies' },
  { packageId: 'PuTTY.PuTTY', name: 'PuTTY', publisher: 'Simon Tatham' },
  { packageId: 'WinSCP.WinSCP', name: 'WinSCP', publisher: 'Martin Prikryl' },
  { packageId: 'TimKosse.FileZilla.Client', name: 'FileZilla', publisher: 'Tim Kosse' },
  { packageId: 'WiresharkFoundation.Wireshark', name: 'Wireshark', publisher: 'Wireshark Foundation' },
  { packageId: 'Insecure.Nmap', name: 'Nmap', publisher: 'Insecure.Com' },
  { packageId: 'KeePassXCTeam.KeePassXC', name: 'KeePassXC', publisher: 'KeePassXC Team' },
  { packageId: 'Bitwarden.Bitwarden', name: 'Bitwarden', publisher: 'Bitwarden' },
  { packageId: '1Password.1Password', name: '1Password', publisher: 'AgileBits' },
  { packageId: 'KeePassPasswordSafe.KeePass', name: 'KeePass', publisher: 'Dominik Reichl' },
  { packageId: 'WireGuard.WireGuard', name: 'WireGuard', publisher: 'WireGuard LLC' },
  { packageId: 'OpenVPNTechnologies.OpenVPN', name: 'OpenVPN', publisher: 'OpenVPN Technologies' },
  { packageId: 'NordVPN.NordVPN', name: 'NordVPN', publisher: 'Nord Security' },
  { packageId: 'Malwarebytes.Malwarebytes', name: 'Malwarebytes', publisher: 'Malwarebytes' },
  { packageId: 'Oracle.VirtualBox', name: 'Oracle VM VirtualBox', publisher: 'Oracle' },
  { packageId: 'Docker.DockerDesktop', name: 'Docker Desktop', publisher: 'Docker Inc.' },
  { packageId: 'VMware.WorkstationPro', name: 'VMware Workstation Pro', publisher: 'VMware' },
  { packageId: 'Hashicorp.Terraform', name: 'Terraform', publisher: 'HashiCorp' },
  { packageId: 'Hashicorp.Vagrant', name: 'Vagrant', publisher: 'HashiCorp' },
  { packageId: 'Kubernetes.kubectl', name: 'kubectl', publisher: 'Kubernetes' },
  { packageId: 'Helm.Helm', name: 'Helm', publisher: 'CNCF' },
  { packageId: 'GoLang.Go', name: 'Go', publisher: 'Go Authors' },
  { packageId: 'Rustlang.Rust.MSVC', name: 'Rust (MSVC)', publisher: 'Rust Project' },
  { packageId: 'JetBrains.IntelliJIDEA.Community', name: 'IntelliJ IDEA Community', publisher: 'JetBrains' },
  { packageId: 'JetBrains.IntelliJIDEA.Ultimate', name: 'IntelliJ IDEA Ultimate', publisher: 'JetBrains' },
  { packageId: 'JetBrains.PyCharm.Community', name: 'PyCharm Community', publisher: 'JetBrains' },
  { packageId: 'JetBrains.WebStorm', name: 'WebStorm', publisher: 'JetBrains' },
  { packageId: 'JetBrains.Rider', name: 'Rider', publisher: 'JetBrains' },
  { packageId: 'JetBrains.DataGrip', name: 'DataGrip', publisher: 'JetBrains' },
  { packageId: 'JetBrains.Toolbox', name: 'JetBrains Toolbox', publisher: 'JetBrains' },
  { packageId: 'SublimeHQ.SublimeText.4', name: 'Sublime Text 4', publisher: 'Sublime HQ' },
  { packageId: 'Axosoft.GitKraken', name: 'GitKraken', publisher: 'Axosoft' },
  { packageId: 'Postman.Postman', name: 'Postman', publisher: 'Postman' },
  { packageId: 'Insomnia.Insomnia', name: 'Insomnia', publisher: 'Kong' },
  { packageId: 'DBeaver.DBeaver.Community', name: 'DBeaver Community', publisher: 'DBeaver' },
  { packageId: 'MongoDB.Compass.Full', name: 'MongoDB Compass', publisher: 'MongoDB' },
  { packageId: 'Redis.RedisInsight', name: 'Redis Insight', publisher: 'Redis' },
  { packageId: 'PostgreSQL.pgAdmin', name: 'pgAdmin 4', publisher: 'PostgreSQL' },
  { packageId: 'MariaDB.Server', name: 'MariaDB Server', publisher: 'MariaDB' },
  { packageId: 'TheDocumentFoundation.LibreOffice', name: 'LibreOffice', publisher: 'The Document Foundation' },
  { packageId: 'OnlyOffice.DesktopEditors', name: 'ONLYOFFICE Desktop Editors', publisher: 'Ascensio' },
  { packageId: 'Notion.Notion', name: 'Notion', publisher: 'Notion Labs' },
  { packageId: 'Obsidian.Obsidian', name: 'Obsidian', publisher: 'Obsidian' },
  { packageId: 'Evernote.Evernote', name: 'Evernote', publisher: 'Evernote' },
  { packageId: 'Todoist.Todoist', name: 'Todoist', publisher: 'Doist' },
  { packageId: 'Asana.Asana', name: 'Asana', publisher: 'Asana' },
  { packageId: 'Atlassian.Sourcetree', name: 'Sourcetree', publisher: 'Atlassian' },
  { packageId: 'Atlassian.Companion', name: 'Atlassian Companion', publisher: 'Atlassian' },
  { packageId: 'Figma.Figma', name: 'Figma', publisher: 'Figma' },
  { packageId: 'Canva.Canva', name: 'Canva', publisher: 'Canva' },
  { packageId: 'BlenderFoundation.Blender', name: 'Blender', publisher: 'Blender Foundation' },
  { packageId: 'GIMP.GIMP', name: 'GIMP', publisher: 'GIMP Team' },
  { packageId: 'Inkscape.Inkscape', name: 'Inkscape', publisher: 'Inkscape' },
  { packageId: 'Audacity.Audacity', name: 'Audacity', publisher: 'Audacity Team' },
  { packageId: 'OBSProject.OBSStudio', name: 'OBS Studio', publisher: 'OBS Project' },
  { packageId: 'HandBrake.HandBrake', name: 'HandBrake', publisher: 'HandBrake Team' },
  { packageId: 'ShareX.ShareX', name: 'ShareX', publisher: 'ShareX Team' },
  { packageId: 'Greenshot.Greenshot', name: 'Greenshot', publisher: 'Greenshot' },
  { packageId: 'voidtools.Everything', name: 'Everything', publisher: 'voidtools' },
  { packageId: 'WinDirStat.WinDirStat', name: 'WinDirStat', publisher: 'WinDirStat Team' },
  { packageId: 'CPUID.CPU-Z', name: 'CPU-Z', publisher: 'CPUID' },
  { packageId: 'CPUID.HWMonitor', name: 'HWMonitor', publisher: 'CPUID' },
  { packageId: 'TechPowerUp.GPU-Z', name: 'GPU-Z', publisher: 'TechPowerUp' },
  { packageId: 'CrystalDewWorld.CrystalDiskInfo', name: 'CrystalDiskInfo', publisher: 'Crystal Dew World' },
  { packageId: 'CrystalDewWorld.CrystalDiskMark', name: 'CrystalDiskMark', publisher: 'Crystal Dew World' },
  { packageId: 'TeamViewer.TeamViewer', name: 'TeamViewer', publisher: 'TeamViewer' },
  { packageId: 'AnyDesk.AnyDesk', name: 'AnyDesk', publisher: 'AnyDesk Software' },
  { packageId: 'RustDesk.RustDesk', name: 'RustDesk', publisher: 'RustDesk' },
  { packageId: 'RealVNC.VNCViewer', name: 'VNC Viewer', publisher: 'RealVNC' },
  { packageId: 'Cisco.CiscoWebexMeetings', name: 'Webex Meetings', publisher: 'Cisco' },
  { packageId: 'Cisco.AnyConnect', name: 'Cisco AnyConnect', publisher: 'Cisco' },
  { packageId: 'Fortinet.FortiClientVPN', name: 'FortiClient VPN', publisher: 'Fortinet' },
  { packageId: 'PaloAltoNetworks.GlobalProtect', name: 'GlobalProtect', publisher: 'Palo Alto Networks' },
  { packageId: 'Citrix.Workspace', name: 'Citrix Workspace', publisher: 'Citrix' },
  { packageId: 'VMware.HorizonClient', name: 'VMware Horizon Client', publisher: 'VMware' },
  { packageId: 'Amazon.AWSCLI', name: 'AWS CLI', publisher: 'Amazon Web Services' },
  { packageId: 'Amazon.SessionManagerPlugin', name: 'Session Manager Plugin', publisher: 'Amazon Web Services' },
  { packageId: 'Google.CloudSDK', name: 'Google Cloud SDK', publisher: 'Google' },
  { packageId: 'Salesforce.SalesforceCLI', name: 'Salesforce CLI', publisher: 'Salesforce' },
  { packageId: 'Puppet.pdk', name: 'Puppet Development Kit', publisher: 'Puppet' },
  { packageId: 'Chef.ChefWorkstation', name: 'Chef Workstation', publisher: 'Progress Chef' },
  { packageId: 'Ansible.Ansible', name: 'Ansible', publisher: 'Red Hat' },
  { packageId: 'Elastic.Elasticsearch', name: 'Elasticsearch', publisher: 'Elastic' },
  { packageId: 'GrafanaLabs.Grafana', name: 'Grafana', publisher: 'Grafana Labs' },
  { packageId: 'Prometheus.Prometheus', name: 'Prometheus', publisher: 'Prometheus' },
  { packageId: 'NginxInc.Nginx', name: 'NGINX', publisher: 'F5' },
  { packageId: 'ApacheFriends.Xampp.8.2', name: 'XAMPP 8.2', publisher: 'Apache Friends' },
  { packageId: 'OpenVPNTechnologies.OpenVPNConnect', name: 'OpenVPN Connect', publisher: 'OpenVPN' },
  { packageId: 'Tailscale.Tailscale', name: 'Tailscale', publisher: 'Tailscale' },
  { packageId: 'Cloudflare.cloudflared', name: 'cloudflared', publisher: 'Cloudflare' },
  { packageId: 'Cloudflare.Warp', name: 'Cloudflare WARP', publisher: 'Cloudflare' },
  { packageId: 'Mozilla.Thunderbird', name: 'Thunderbird', publisher: 'Mozilla' },
  { packageId: 'eMClient.eMClient', name: 'eM Client', publisher: 'eM Client' },
  { packageId: 'Mailbird.Mailbird', name: 'Mailbird', publisher: 'Mailbird' },
  { packageId: 'Foxit.FoxitReader', name: 'Foxit Reader', publisher: 'Foxit' },
  { packageId: 'SumatraPDF.SumatraPDF', name: 'Sumatra PDF', publisher: 'Sumatra PDF' },
  { packageId: 'IrfanSkiljan.IrfanView', name: 'IrfanView', publisher: 'Irfan Skiljan' },
  { packageId: 'XnSoft.XnViewMP', name: 'XnView MP', publisher: 'XnSoft' },
  { packageId: 'FastStone.Viewer', name: 'FastStone Image Viewer', publisher: 'FastStone' },
  { packageId: 'CodecGuide.K-LiteCodecPack.Full', name: 'K-Lite Codec Pack Full', publisher: 'Codec Guide' },
  { packageId: 'MediaInfo.MediaInfo', name: 'MediaInfo', publisher: 'MediaArea' },
  { packageId: 'MP3Tag.MP3Tag', name: 'Mp3tag', publisher: 'Florian Heidenreich' },
  { packageId: 'AIMP.AIMP', name: 'AIMP', publisher: 'AIMP' },
  { packageId: 'foobar2000.foobar2000', name: 'foobar2000', publisher: 'Peter Pawlowski' },
  { packageId: 'Winamp.Winamp', name: 'Winamp', publisher: 'Winamp' },
  { packageId: 'qBittorrent.qBittorrent', name: 'qBittorrent', publisher: 'The qBittorrent project' },
  { packageId: 'Transmission.Transmission', name: 'Transmission', publisher: 'Transmission Project' },
  { packageId: 'Piriform.CCleaner', name: 'CCleaner', publisher: 'Piriform' },
  { packageId: 'Piriform.Speccy', name: 'Speccy', publisher: 'Piriform' },
  { packageId: 'Piriform.Defraggler', name: 'Defraggler', publisher: 'Piriform' },
  { packageId: 'Piriform.Recuva', name: 'Recuva', publisher: 'Piriform' },
  { packageId: 'RevoUninstaller.RevoUninstaller', name: 'Revo Uninstaller', publisher: 'VS Revo Group' },
  { packageId: 'Glarysoft.GlaryUtilities', name: 'Glary Utilities', publisher: 'Glarysoft' },
  { packageId: 'IObit.Uninstaller', name: 'IObit Uninstaller', publisher: 'IObit' },
  { packageId: 'IObit.DriverBooster', name: 'Driver Booster', publisher: 'IObit' },
  { packageId: 'Nvidia.GeForceExperience', name: 'GeForce Experience', publisher: 'NVIDIA' },
  { packageId: 'AMD.AMDSoftwareAdrenalinEdition', name: 'AMD Software Adrenalin', publisher: 'AMD' },
  { packageId: 'Intel.IntelDriverAndSupportAssistant', name: 'Intel DSA', publisher: 'Intel' },
  { packageId: 'Logitech.OptionsPlus', name: 'Logitech Options+', publisher: 'Logitech' },
  { packageId: 'Logitech.GHUB', name: 'Logitech G HUB', publisher: 'Logitech' },
  { packageId: 'Razer.Synapse', name: 'Razer Synapse', publisher: 'Razer' },
  { packageId: 'SteelSeries.GG', name: 'SteelSeries GG', publisher: 'SteelSeries' },
  { packageId: 'Corsair.iCUE', name: 'iCUE', publisher: 'Corsair' },
  { packageId: 'EpicGames.EpicGamesLauncher', name: 'Epic Games Launcher', publisher: 'Epic Games' },
  { packageId: 'Valve.Steam', name: 'Steam', publisher: 'Valve' },
  { packageId: 'Ubisoft.Connect', name: 'Ubisoft Connect', publisher: 'Ubisoft' },
  { packageId: 'ElectronicArts.EADesktop', name: 'EA App', publisher: 'Electronic Arts' },
  { packageId: 'GOG.Galaxy', name: 'GOG Galaxy', publisher: 'GOG' },
  { packageId: 'RiotGames.LeagueOfLegends.EUW', name: 'League of Legends', publisher: 'Riot Games' },
  { packageId: 'Blizzard.BattleNet', name: 'Battle.net', publisher: 'Blizzard' },
  { packageId: 'Unity.UnityHub', name: 'Unity Hub', publisher: 'Unity Technologies' },
  { packageId: 'GodotEngine.GodotEngine', name: 'Godot Engine', publisher: 'Godot' },
  { packageId: 'Arduino.ArduinoIDE', name: 'Arduino IDE', publisher: 'Arduino' },
  { packageId: 'RaspberryPiFoundation.RaspberryPiImager', name: 'Raspberry Pi Imager', publisher: 'Raspberry Pi' },
  { packageId: 'Balena.Etcher', name: 'balenaEtcher', publisher: 'Balena' },
  { packageId: 'Rufus.Rufus', name: 'Rufus', publisher: 'Pete Batard' },
  { packageId: 'Ventoy.Ventoy', name: 'Ventoy', publisher: 'Ventoy' },
  { packageId: 'SoftPerfect.RAMDisk', name: 'SoftPerfect RAM Disk', publisher: 'SoftPerfect' },
  { packageId: 'Sysinternals.BGInfo', name: 'BGInfo', publisher: 'Microsoft Sysinternals' },
  { packageId: 'Sysinternals.Autoruns', name: 'Autoruns', publisher: 'Microsoft Sysinternals' },
  { packageId: 'Sysinternals.TCPView', name: 'TCPView', publisher: 'Microsoft Sysinternals' },
  { packageId: 'Sysinternals.PsTools', name: 'PsTools', publisher: 'Microsoft Sysinternals' },
  { packageId: 'Microsoft.Sysinternals.Sysmon', name: 'Sysmon', publisher: 'Microsoft Sysinternals' },
  { packageId: 'Microsoft.WindowsAdminCenter', name: 'Windows Admin Center', publisher: 'Microsoft' },
  { packageId: 'Microsoft.RemoteDesktopClient', name: 'Remote Desktop', publisher: 'Microsoft' },
  { packageId: 'Microsoft.OpenJDK.21', name: 'Microsoft Build of OpenJDK 21', publisher: 'Microsoft' },
  { packageId: 'Microsoft.VCRedist.2015+.x64', name: 'VC++ Redistributable 2015+ x64', publisher: 'Microsoft' },
  { packageId: 'Microsoft.VCRedist.2015+.x86', name: 'VC++ Redistributable 2015+ x86', publisher: 'Microsoft' },
  { packageId: 'Microsoft.DirectX', name: 'DirectX End-User Runtime', publisher: 'Microsoft' },
  { packageId: 'Microsoft.NET.Framework.4.8', name: '.NET Framework 4.8', publisher: 'Microsoft' },
  { packageId: 'Microsoft.Winget.Source', name: 'Winget Source', publisher: 'Microsoft' },
  { packageId: 'Canonical.Ubuntu', name: 'Ubuntu (WSL)', publisher: 'Canonical' },
  { packageId: 'Debian.Debian', name: 'Debian (WSL)', publisher: 'Debian' },
  { packageId: 'SUSE.SLES', name: 'SUSE Linux Enterprise (WSL)', publisher: 'SUSE' },
  { packageId: 'Kalilinux.KaliLinux', name: 'Kali Linux (WSL)', publisher: 'Offensive Security' },
  { packageId: 'Alpine.AlpineWSL', name: 'Alpine WSL', publisher: 'Alpine' },
  { packageId: 'PenguinSoft.VcXsrv', name: 'VcXsrv', publisher: 'PenguinSoft' },
  { packageId: 'marha.WSLg', name: 'WSLg extras', publisher: 'Microsoft' },
  { packageId: 'Gyan.FFmpeg', name: 'FFmpeg', publisher: 'Gyan' },
  { packageId: 'yt-dlp.yt-dlp', name: 'yt-dlp', publisher: 'yt-dlp' },
  { packageId: 'Shopify.shopifyCLI', name: 'Shopify CLI', publisher: 'Shopify' },
  { packageId: 'Netflix.Stash', name: 'Stash', publisher: 'Netflix' },
  { packageId: 'Rclone.Rclone', name: 'Rclone', publisher: 'Rclone' },
  { packageId: 'Syncthing.Syncthing', name: 'Syncthing', publisher: 'Syncthing' },
  { packageId: 'Nextcloud.NextcloudDesktop', name: 'Nextcloud Desktop', publisher: 'Nextcloud' },
  { packageId: 'ownCloud.ownCloudDesktop', name: 'ownCloud Desktop', publisher: 'ownCloud' },
  { packageId: 'Mega.MEGAsync', name: 'MEGAsync', publisher: 'Mega' },
  { packageId: 'pCloud.pCloudDrive', name: 'pCloud Drive', publisher: 'pCloud' },
  { packageId: 'Box.Box', name: 'Box Drive', publisher: 'Box' },
  { packageId: 'Zoom.ZoomRooms', name: 'Zoom Rooms', publisher: 'Zoom' },
  { packageId: 'BlueJeans.BlueJeans', name: 'BlueJeans', publisher: 'Verizon' },
  { packageId: 'GoTo.GoToMeeting', name: 'GoTo Meeting', publisher: 'GoTo' },
  { packageId: 'LogMeIn.LastPass', name: 'LastPass', publisher: 'LogMeIn' },
  { packageId: 'Dashlane.Dashlane', name: 'Dashlane', publisher: 'Dashlane' },
  { packageId: 'Authy.AuthyDesktop', name: 'Authy Desktop', publisher: 'Twilio' },
  { packageId: 'Yubico.YubikeyManager', name: 'YubiKey Manager', publisher: 'Yubico' },
  { packageId: 'Yubico.Authenticator', name: 'Yubico Authenticator', publisher: 'Yubico' },
  { packageId: 'Symantec.EndpointProtection', name: 'Symantec Endpoint Protection', publisher: 'Broadcom' },
  { packageId: 'CrowdStrike.FalconSensor', name: 'CrowdStrike Falcon Sensor', publisher: 'CrowdStrike' },
  { packageId: 'SentinelOne.SentinelAgent', name: 'SentinelOne Agent', publisher: 'SentinelOne' },
  { packageId: 'CarbonBlack.CbDefense', name: 'VMware Carbon Black', publisher: 'VMware' },
  { packageId: 'TrendMicro.ApexOne', name: 'Trend Micro Apex One', publisher: 'Trend Micro' },
  { packageId: 'Sophos.SophosEndpointAgent', name: 'Sophos Endpoint Agent', publisher: 'Sophos' },
  { packageId: 'ESET.EndpointAntivirus', name: 'ESET Endpoint Antivirus', publisher: 'ESET' },
  { packageId: 'Kaspersky.EndpointSecurity', name: 'Kaspersky Endpoint Security', publisher: 'Kaspersky' },
  { packageId: 'Avast.BusinessAntivirus', name: 'Avast Business Antivirus', publisher: 'Avast' },
  { packageId: 'Bitdefender.GravityZone', name: 'Bitdefender GravityZone', publisher: 'Bitdefender' },
];

@Injectable()
export class PatchCatalogService {
  private readonly logger = new Logger(PatchCatalogService.name);
  private syncing = false;

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledSync() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    try {
      await this.syncCatalog();
    } catch (err: any) {
      this.logger.error(`Scheduled catalog sync failed: ${err?.message || err}`);
    }
  }

  async syncCatalog(tenantId?: string | null) {
    if (this.syncing) return { status: 'already_running', upserted: 0 };
    this.syncing = true;
    let upserted = 0;

    try {
      // 1) Static winget popular list (seed / fallback)
      for (const item of WINGET_POPULAR) {
        await this.upsertItem({
          tenantId: tenantId || null,
          source: 'WINGET',
          packageId: item.packageId,
          name: item.name,
          version: null,
          publisher: item.publisher || null,
          metadata: { origin: 'static-popular' },
        });
        upserted++;
      }

      // 2) Live winget community REST index (microsoft/winget-pkgs CDN)
      const wingetLive = await this.syncWingetRest(tenantId || null);
      upserted += wingetLive;

      // 3) Homebrew formulae API
      const brewCount = await this.syncBrewFormulae(tenantId || null);
      upserted += brewCount;

      // 4) Ubuntu/Debian apt Packages index (noble main)
      const aptCount = await this.syncAptPackages(tenantId || null);
      upserted += aptCount;

      // 5) Derive additional winget-style entries from brew names
      const brewDerived = await this.prisma.patchCatalogItem.findMany({
        where: { source: 'BREW', ...(tenantId ? { tenantId } : { tenantId: null }) },
        take: 120,
        orderBy: { syncedAt: 'desc' },
        select: { packageId: true, name: true },
      });
      for (const b of brewDerived) {
        const wingetId = this.guessWingetId(b.packageId, b.name);
        if (!wingetId) continue;
        await this.upsertItem({
          tenantId: tenantId || null,
          source: 'WINGET',
          packageId: wingetId,
          name: b.name,
          version: null,
          publisher: null,
          metadata: { origin: 'brew-derived', brewId: b.packageId },
        });
        upserted++;
      }

      this.logger.log(`Patch catalog sync complete: upserted≈${upserted}`);
      return {
        status: 'ok',
        upserted,
        wingetStatic: WINGET_POPULAR.length,
        wingetLive,
        brew: brewCount,
        apt: aptCount,
      };
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Fetch packages from the public winget-cdn / community source index.
   * Uses the Microsoft CDN package search API when available; falls back to
   * the GitHub winget-pkgs content index snapshot.
   */
  private async syncWingetRest(tenantId: string | null): Promise<number> {
    const urls = [
      process.env.WINGET_INDEX_URL ||
        'https://cdn.winget.microsoft.com/cache/source.msix',
      'https://api.github.com/repos/microsoft/winget-pkgs/contents/manifests',
    ];

    // Prefer the winget REST search endpoint (community mirror)
    try {
      const searchUrl =
        process.env.WINGET_SEARCH_URL ||
        'https://storeedgefd.dsx.mp.microsoft.com/v9.0/manifestSearch';
      const res = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'QS-Asset-PatchCatalog/1.0',
        },
        body: JSON.stringify({
          MaximumResults: 500,
          Query: { KeyWord: '', MatchType: 'Substring' },
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const packages: any[] = data.Data || data.data || [];
        let count = 0;
        for (const pkg of packages.slice(0, 500)) {
          const packageId = pkg.PackageIdentifier || pkg.packageIdentifier || pkg.Id;
          const name = pkg.PackageName || pkg.packageName || pkg.Name || packageId;
          const version =
            pkg.Versions?.[0]?.PackageVersion ||
            pkg.versions?.[0]?.packageVersion ||
            pkg.Version ||
            null;
          const publisher = pkg.Publisher || pkg.publisher || null;
          if (!packageId) continue;
          await this.upsertItem({
            tenantId,
            source: 'WINGET',
            packageId: String(packageId),
            name: String(name).slice(0, 200),
            version: version ? String(version) : null,
            publisher: publisher ? String(publisher).slice(0, 200) : null,
            metadata: { origin: 'winget-rest', raw: { packageId } },
          });
          count++;
        }
        if (count > 0) {
          this.logger.log(`Winget REST sync: ${count} packages`);
          return count;
        }
      } else {
        this.logger.warn(`Winget REST search ${res.status} — trying GitHub manifests`);
      }
    } catch (err: any) {
      this.logger.warn(`Winget REST failed: ${err?.message || err}`);
    }

    // Fallback: sample popular publisher letters from winget-pkgs GitHub API
    try {
      const res = await fetch(urls[1], {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'QS-Asset-PatchCatalog/1.0',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
      });
      if (!res.ok) {
        this.logger.warn(`Winget GitHub index ${res.status}`);
        return 0;
      }
      const letters: any[] = await res.json();
      let count = 0;
      // Walk first-level publisher dirs (a–z) and pull a few packages each
      for (const letter of (Array.isArray(letters) ? letters : []).slice(0, 12)) {
        if (!letter?.url || letter.type !== 'dir') continue;
        const pubRes = await fetch(letter.url, {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'QS-Asset-PatchCatalog/1.0',
            ...(process.env.GITHUB_TOKEN
              ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
              : {}),
          },
        });
        if (!pubRes.ok) continue;
        const publishers: any[] = await pubRes.json();
        for (const pub of (Array.isArray(publishers) ? publishers : []).slice(0, 8)) {
          if (pub.type !== 'dir') continue;
          const pkgRes = await fetch(pub.url, {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'QS-Asset-PatchCatalog/1.0',
              ...(process.env.GITHUB_TOKEN
                ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                : {}),
            },
          });
          if (!pkgRes.ok) continue;
          const pkgs: any[] = await pkgRes.json();
          for (const pkg of (Array.isArray(pkgs) ? pkgs : []).slice(0, 5)) {
            if (pkg.type !== 'dir') continue;
            const packageId = `${pub.name}.${pkg.name}`;
            await this.upsertItem({
              tenantId,
              source: 'WINGET',
              packageId,
              name: pkg.name,
              version: null,
              publisher: pub.name,
              metadata: { origin: 'winget-github', path: pkg.path },
            });
            count++;
            if (count >= 400) return count;
          }
        }
      }
      this.logger.log(`Winget GitHub sync: ${count} packages`);
      return count;
    } catch (err: any) {
      this.logger.warn(`Winget GitHub sync failed: ${err?.message || err}`);
      return 0;
    }
  }

  /** Sync Ubuntu noble main Packages.gz into APT catalog entries. */
  private async syncAptPackages(tenantId: string | null): Promise<number> {
    const mirror =
      process.env.APT_PACKAGES_URL ||
      'http://archive.ubuntu.com/ubuntu/dists/noble/main/binary-amd64/Packages.gz';
    try {
      const res = await fetch(mirror, {
        headers: { 'User-Agent': 'QS-Asset-PatchCatalog/1.0' },
      });
      if (!res.ok) {
        this.logger.warn(`APT Packages fetch ${res.status}`);
        return 0;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      let text: string;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const zlib = require('zlib');
        text = zlib.gunzipSync(buf).toString('utf8');
      } catch {
        text = buf.toString('utf8');
      }

      const blocks = text.split(/\n\n+/);
      let count = 0;
      for (const block of blocks) {
        if (count >= 500) break;
        const pkg = block.match(/^Package:\s*(.+)$/m)?.[1]?.trim();
        const version = block.match(/^Version:\s*(.+)$/m)?.[1]?.trim() || null;
        const desc = block.match(/^Description:\s*(.+)$/m)?.[1]?.trim() || pkg;
        const maintainer = block.match(/^Maintainer:\s*(.+)$/m)?.[1]?.trim() || null;
        if (!pkg) continue;
        // Prefer desktop/server-relevant packages (skip pure libs to keep catalog useful)
        const isLib = pkg.startsWith('lib') && !pkg.includes('ssl') && !pkg.includes('curl');
        if (isLib && count > 100) continue;
        await this.upsertItem({
          tenantId,
          source: 'APT',
          packageId: pkg,
          name: desc || pkg,
          version,
          publisher: maintainer ? maintainer.slice(0, 200) : 'Ubuntu',
          metadata: { origin: 'apt-ubuntu-noble', suite: 'noble/main' },
        });
        count++;
      }
      this.logger.log(`APT sync: ${count} packages`);
      return count;
    } catch (err: any) {
      this.logger.warn(`APT sync failed: ${err?.message || err}`);
      return 0;
    }
  }

  private async syncBrewFormulae(tenantId: string | null): Promise<number> {
    try {
      const res = await fetch('https://formulae.brew.sh/api/formula.json', {
        headers: { Accept: 'application/json', 'User-Agent': 'QS-Asset-PatchCatalog/1.0' },
      });
      if (!res.ok) {
        this.logger.warn(`Brew formulae API ${res.status}`);
        return 0;
      }
      const formulae: any[] = await res.json();
      // Cap to keep sync bounded but still hundreds of rows
      const slice = formulae.slice(0, 400);
      let count = 0;
      for (const f of slice) {
        const packageId = f.name || f.full_name;
        if (!packageId) continue;
        await this.upsertItem({
          tenantId,
          source: 'BREW',
          packageId: String(packageId),
          name: f.desc ? `${f.name} — ${String(f.desc).slice(0, 80)}` : String(f.name || packageId),
          version: f.versions?.stable || f.version || null,
          publisher: Array.isArray(f.urls?.stable?.url) ? null : (f.homepage || null),
          metadata: {
            homepage: f.homepage || null,
            license: f.license || null,
            dependencies: (f.dependencies || []).slice(0, 20),
          },
        });
        count++;
      }
      return count;
    } catch (err: any) {
      this.logger.warn(`Brew sync failed: ${err?.message || err}`);
      return 0;
    }
  }

  private guessWingetId(brewId: string, name: string): string | null {
    const known: Record<string, string> = {
      git: 'Git.Git',
      node: 'OpenJS.NodeJS.LTS',
      python: 'Python.Python.3.12',
      python3: 'Python.Python.3.12',
      go: 'GoLang.Go',
      rust: 'Rustlang.Rust.MSVC',
      terraform: 'Hashicorp.Terraform',
      vagrant: 'Hashicorp.Vagrant',
      docker: 'Docker.DockerDesktop',
      kubectl: 'Kubernetes.kubectl',
      helm: 'Helm.Helm',
      ffmpeg: 'Gyan.FFmpeg',
      wget: 'JernejSimoncic.Wget',
      curl: 'cURL.cURL',
      jq: 'jqlang.jq',
      nmap: 'Insecure.Nmap',
      wireshark: 'WiresharkFoundation.Wireshark',
      vlc: 'VideoLAN.VLC',
      firefox: 'Mozilla.Firefox',
      chromium: 'Google.Chrome',
      'visual-studio-code': 'Microsoft.VisualStudioCode',
      'google-chrome': 'Google.Chrome',
      slack: 'SlackTechnologies.Slack',
      zoom: 'Zoom.Zoom',
      postman: 'Postman.Postman',
      'keepassxc': 'KeePassXCTeam.KeePassXC',
      bitwarden: 'Bitwarden.Bitwarden',
      libreoffice: 'TheDocumentFoundation.LibreOffice',
      blender: 'BlenderFoundation.Blender',
      gimp: 'GIMP.GIMP',
      inkscape: 'Inkscape.Inkscape',
      audacity: 'Audacity.Audacity',
      'obs': 'OBSProject.OBSStudio',
      rclone: 'Rclone.Rclone',
      syncthing: 'Syncthing.Syncthing',
      openvpn: 'OpenVPNTechnologies.OpenVPN',
      wireguard: 'WireGuard.WireGuard',
      ansible: 'Ansible.Ansible',
      awscli: 'Amazon.AWSCLI',
      'azure-cli': 'Microsoft.AzureCLI',
    };
    if (known[brewId]) return known[brewId];
    // Skip if already in static list
    if (WINGET_POPULAR.some((w) => w.packageId.toLowerCase().includes(brewId.replace(/-/g, '').toLowerCase()))) {
      return null;
    }
    // Only invent IDs for short alphanumeric brew names
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/i.test(brewId)) return null;
    const vendor = brewId.split('-')[0];
    return `${vendor.charAt(0).toUpperCase()}${vendor.slice(1)}.${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) || brewId}`;
  }

  private async upsertItem(data: {
    tenantId: string | null;
    source: string;
    packageId: string;
    name: string;
    version: string | null;
    publisher: string | null;
    metadata: any;
  }) {
    const version = data.version || '';
    await this.prisma.patchCatalogItem.upsert({
      where: {
        source_packageId_version: {
          source: data.source,
          packageId: data.packageId,
          version,
        },
      },
      create: {
        tenantId: data.tenantId,
        source: data.source,
        packageId: data.packageId,
        name: data.name.slice(0, 200),
        version: version, // empty string when unknown — unique constraint needs non-null
        publisher: data.publisher ? String(data.publisher).slice(0, 200) : null,
        metadata: data.metadata || {},
        syncedAt: new Date(),
      },
      update: {
        name: data.name.slice(0, 200),
        publisher: data.publisher ? String(data.publisher).slice(0, 200) : null,
        metadata: data.metadata || {},
        syncedAt: new Date(),
        ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
      },
    });
  }

  async listCatalog(query: {
    source?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const where: any = {};
    if (query.source) where.source = query.source.toUpperCase();
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { packageId: { contains: query.search, mode: 'insensitive' } },
        { publisher: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.patchCatalogItem.findMany({
        where,
        orderBy: [{ source: 'asc' }, { name: 'asc' }],
        take: Math.min(query.limit || 50, 200),
        skip: query.offset || 0,
      }),
      this.prisma.patchCatalogItem.count({ where }),
    ]);
    return { data, total };
  }

  async getStats() {
    const bySource = await this.prisma.patchCatalogItem.groupBy({
      by: ['source'],
      _count: true,
    });
    const total = await this.prisma.patchCatalogItem.count();
    return {
      total,
      bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    };
  }
}
