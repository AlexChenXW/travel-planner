#!/bin/bash
set -e

DIR="/Users/AlexChen/travel-planner"
DEPLOY="$DIR/.fc-deploy"

rm -rf "$DEPLOY"
mkdir -p "$DEPLOY"

# Copy standalone server (use /. to include dotfiles like .next and .env)
cp -r "$DIR/.next/standalone/travel-planner/." "$DEPLOY/"

# Copy static assets (standalone .next lacks these)
mkdir -p "$DEPLOY/.next/static"
cp -r "$DIR/.next/static" "$DEPLOY/.next/"

# Copy public assets
cp -r "$DIR/public" "$DEPLOY/public"

# Copy node_modules for mysql2 and openai (standalone may not include all)
cp -r "$DIR/node_modules/mysql2" "$DEPLOY/node_modules/mysql2" 2>/dev/null || true
cp -r "$DIR/node_modules/openai" "$DEPLOY/node_modules/openai" 2>/dev/null || true

# Download node binary for linux (FC custom.debian10 has no node)
if [ ! -f "$DEPLOY/node" ]; then
  echo "Downloading node v22 for linux..."
  cd "$DEPLOY" && curl -sL https://npmmirror.com/mirrors/node/v22.14.0/node-v22.14.0-linux-x64.tar.xz | tar xJ --include='*/bin/node' --strip-components=2
fi

# Copy FC proxy (strips Content-Disposition header)
cp "$DIR/fc-proxy.js" "$DEPLOY/fc-proxy.js"

# Create bootstrap script
cat > "$DEPLOY/bootstrap" << 'BOOTSTRAP'
#!/bin/bash
cd /code
chmod +x ./node
exec ./node fc-proxy.js 2>&1
BOOTSTRAP
chmod +x "$DEPLOY/bootstrap"

# Patch macOS paths to FC /code directory
sed -i '' 's|/Users/AlexChen|/code|g' "$DEPLOY/server.js"
sed -i '' 's|/Users/AlexChen|/code|g' "$DEPLOY/.next/required-server-files.json"

# Copy s.yaml to deploy dir
cp "$DIR/s.yaml" "$DEPLOY/s.yaml"

echo "Deploy package ready at $DEPLOY"
du -sh "$DEPLOY"
