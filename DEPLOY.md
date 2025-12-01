# Deployment Guide: Ubuntu Server with Apache & Node.js

Since the app now uses a backend database (SQLite), we need to run a Node.js server and configure Apache to forward requests to it.

## Prerequisites
- Ubuntu Server.
- Apache installed.
- **Node.js installed** (v14+).

## 1. Install Node.js (if not installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 2. Upload Files
Upload all project files (`index.html`, `server.js`, `package.json`) to a folder on your server, e.g., `/var/www/calorie-app`.

```powershell
# From your local machine
scp index.html server.js package.json user@your-server-ip:~/calorie-app/
```

## 3. Setup Application
SSH into your server and set up the app.

```bash
# Move to directory
sudo mkdir -p /var/www/calorie-app
sudo mv ~/calorie-app/* /var/www/calorie-app/
cd /var/www/calorie-app

# Install dependencies
sudo npm install

# Fix permissions (so www-data or your user can write to the DB)
sudo chown -R $USER:www-data /var/www/calorie-app
sudo chmod -R 775 /var/www/calorie-app
```

## 4. Run with PM2 (Process Manager)
It's best to use `pm2` to keep the app running in the background.

```bash
sudo npm install -g pm2
pm2 start server.js --name "calorie-app"
pm2 save
pm2 startup
```

## 5. Configure Apache Reverse Proxy
Configure Apache to forward traffic from port 80 to your Node app on port 3000.

1. Enable proxy modules:
   ```bash
   sudo a2enmod proxy
   sudo a2enmod proxy_http
   ```

2. Edit your site config (e.g., `/etc/apache2/sites-available/000-default.conf`):
   ```apache
   <VirtualHost *:80>
       ServerAdmin webmaster@localhost
       DocumentRoot /var/www/html

       # Add this Proxy Pass configuration
       ProxyPreserveHost On
       ProxyPass / http://localhost:3000/
       ProxyPassReverse / http://localhost:3000/

       ErrorLog ${APACHE_LOG_DIR}/error.log
       CustomLog ${APACHE_LOG_DIR}/access.log combined
   </VirtualHost>
   ```

3. Restart Apache:
   ```bash
   sudo systemctl restart apache2
   ```

## 6. Verify
Visit `http://your-server-ip/`. You should see the app, and data will now be saved to the SQLite database on the server!
