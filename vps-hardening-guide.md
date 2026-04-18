# VPS Security Hardening Guide (Pending Steps)

This guide contains the remaining security steps for your Hostinger VPS. You can safely execute these once your application is deployed and your work laptop's SSH key is configured.

## 1. Add Work Laptop SSH Key
Before locking down passwords, ensure you can access the VPS from your work laptop.

1. Generate an SSH key on your work laptop (in Windows Terminal/PowerShell): 
   ```powershell
   ssh-keygen -t ed25519 -C "work_laptop"
   ```
2. Copy the public key (`cat ~/.ssh/id_ed25519.pub`).
3. Log into the VPS as your non-root user.
4. Open the authorized keys file:
   ```bash
   nano ~/.ssh/authorized_keys
   ```
5. Paste the key on a new line, save, and exit.

## 2. Configure UFW Firewall
Only allow essential traffic to your server.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow essential ports
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall (type 'y' when prompted)
sudo ufw enable

# Verify
sudo ufw status verbose
```

## 3. Enable Fail2ban
Protect your server against brute-force attacks by automatically banning bad IPs.

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verify it's monitoring SSH
sudo fail2ban-client status sshd
```

## 4. The Final Lockdown: Disable Root Login and Passwords
**WARNING: Only do this AFTER verifying you can log in from ALL your devices using SSH keys.**

1. Open the SSH config drop-in file:
```bash
sudo nano /etc/ssh/sshd_config.d/99-security.conf
```

2. Add these strict rules:
```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```

3. Save, validate, and restart the SSH service:
```bash
# Validate (should output nothing if there are no errors)
sudo sshd -t

# Apply changes
sudo systemctl restart ssh
```