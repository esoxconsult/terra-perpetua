# Deploy

The web root `/var/www/sites/terraperpetua.org/httpdocs` is a symlink to `repo/site` of a clone of this repository (`/var/www/sites/terraperpetua.org/repo`). `.git` and everything outside `site/` is therefore not served.

## Deploy a new version

```bash
git -C /var/www/sites/terraperpetua.org/repo pull --ff-only
```

## nginx

`nginx/terraperpetua.conf` holds security headers, compression and caching rules. After it changes in the repository, copy it again (command below). It is copied (not symlinked) to `/etc/nginx/snippets/`, so a push to this repository never changes the server configuration on its own:

```bash
install -m 644 /var/www/sites/terraperpetua.org/repo/deploy/nginx/terraperpetua.conf /etc/nginx/snippets/terraperpetua.conf && nginx -t && systemctl reload nginx
```

The server block contains, below the `root` line:

```
location ~ /\.(?!well-known) { deny all; }
include snippets/terraperpetua.conf;
```
