# Deployment Guide for Turmoil (Apache)

Since **Turmoil** is a static frontend-only application (built with Vite + Phaser), hosting it is indeed a breeze! You don't need a Node.js server running in the background; you just need to serve the static files.

## 1. Build the Project

Run the build command locally to generate the optimized static files:

```bash
npm run build
```

This will create a `dist/` directory in your project root containing:

- `index.html`
- `assets/` (bundled JS, CSS, and images)

## 2. Transfer to Your Droplet

You can copy the files to your server using `scp` (Secure Copy) or `rsync`.

Replace `user@your-droplet-ip` with your actual server credentials.

```bash
# Upload the contents of dist to /var/www/html/turmoil on your server
scp -r dist/* user@your-droplet-ip:/var/www/html/turmoil/
```

_Note: Make sure the destination folder `/var/www/html/turmoil` exists and is writable._

## 3. Serve with Apache

Ensure Apache is installed (`sudo apt install apache2` on Ubuntu/Debian).

1.  **Create a Virtual Host configuration:**

    Create a new file: `/etc/apache2/sites-available/turmoil.conf`

2.  **Add the following content:**

```apache
<VirtualHost *:80>
    # Note: Start with Port 80 (HTTP).
    # Certbot (Step 4) will automatically upgrade this to Port 443 (HTTPS) and handle certificates.

    ServerName your-domain.com
    # Or use your IP if you don't have a domain yet
    # ServerName 123.456.78.90

    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html/turmoil

    <Directory /var/www/html/turmoil>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Optional: Enable Gzip compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript application/json
    </IfModule>

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

3.  **Enable the Site:**

```bash
# Enable the new site
sudo a2ensite turmoil.conf

# Reload Apache to apply changes
sudo systemctl reload apache2
```

## 4. Secure with HTTPS (SSL)

To enable secure HTTPS access (port 443), use **Certbot** with Let's Encrypt.

1.  **Install Certbot:**

    ```bash
    sudo apt install certbot python3-certbot-apache
    ```

2.  **Obtain and Install Certificate:**
    Run the following command and follow the interactive prompts:

    ```bash
    sudo certbot --apache -d your-domain.com -d www.your-domain.com
    ```

    _Replace `your-domain.com` with your actual domain._

3.  **Automatic Renewal:**
    Certbot handles renewal automatically. You can verify the timer is active:
    ```bash
    sudo systemctl status certbot.timer
    ```

## 5. Alternative: Simple Testing

If you just want to test it quickly on the server instantly without configuration:

**Using Python (usually installed on Linux):**

```bash
cd /var/www/html/turmoil
python3 -m http.server 8080
```

Then visit `http://your-droplet-ip:8080`.

## Troubleshooting

- **Permissions:** Ensure Apache can read the files:
  ```bash
  sudo chown -R www-data:www-data /var/www/html/turmoil
  sudo chmod -R 755 /var/www/html/turmoil
  ```
- **Black Screen/404s?** Check the browser console (`F12`). Ensure the `base` path in `vite.config.ts` is set to `./` if you are hosting in a subdirectory, or `/` if at the root.
