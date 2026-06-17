#!/bin/bash
# Hearth dev startup script
# Run from Git Bash: bash start.sh
# Detects current WiFi IP, updates mobile .env, starts backend

set -e

MOBILE_ENV="apps/mobile/.env"
BACKEND_DIR="backend/api"
VENV_ACTIVATE="$BACKEND_DIR/venv/Scripts/activate"

echo ""
echo "🏠 Hearth Dev Startup"
echo "====================="

# ── 1. Detect current WiFi IP ──────────────────────────────────────────────
echo "📡 Detecting WiFi IP..."

# Try ipconfig (Windows/Git Bash) — grab the first non-VirtualBox, non-Bluetooth IPv4
WIFI_IP=$(ipconfig 2>/dev/null \
  | grep -A 10 -i "Wireless LAN\|Wi-Fi" \
  | grep "IPv4" \
  | grep -v "169\.254\|127\." \
  | head -1 \
  | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" \
  | head -1)

# Fallback: try hostname -I (Linux/WSL)
if [ -z "$WIFI_IP" ]; then
  WIFI_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$WIFI_IP" ]; then
  echo "❌ Could not detect WiFi IP automatically."
  echo "   Please enter your IP manually (run: ipconfig | grep IPv4):"
  read -r WIFI_IP
fi

echo "✅ WiFi IP: $WIFI_IP"

# ── 2. Update mobile .env ──────────────────────────────────────────────────
if [ ! -f "$MOBILE_ENV" ]; then
  echo ""
  echo "⚠️  $MOBILE_ENV not found. Creating it..."
  cat > "$MOBILE_ENV" << EOF
EXPO_PUBLIC_API_URL=http://${WIFI_IP}:8000
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EOF
else
  # Replace only the API URL line, preserve other vars
  if grep -q "EXPO_PUBLIC_API_URL" "$MOBILE_ENV"; then
    sed -i "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://${WIFI_IP}:8000|" "$MOBILE_ENV"
  else
    echo "EXPO_PUBLIC_API_URL=http://${WIFI_IP}:8000" >> "$MOBILE_ENV"
  fi
fi

echo "✅ Updated $MOBILE_ENV → http://${WIFI_IP}:8000"

# ── 3. Start backend ───────────────────────────────────────────────────────
echo ""
echo "🚀 Starting FastAPI backend..."

if [ ! -f "$VENV_ACTIVATE" ]; then
  echo "❌ venv not found at $VENV_ACTIVATE"
  echo "   Run: python -m venv $BACKEND_DIR/venv && pip install -r $BACKEND_DIR/requirements.txt"
  exit 1
fi

# Start backend in background
(
  cd "$BACKEND_DIR"
  source venv/Scripts/activate
  echo "   Backend running at http://0.0.0.0:8000"
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &

BACKEND_PID=$!
echo "✅ Backend PID: $BACKEND_PID"

# ── 4. Print mobile start command ─────────────────────────────────────────
echo ""
echo "📱 Now start Expo in a new terminal:"
echo ""
echo "   cd apps/mobile && npx expo start -c --lan --offline"
echo ""
echo "   (or use --tunnel if LAN doesn't work)"
echo ""
echo "🔗 API: http://${WIFI_IP}:8000"
echo "🔗 Backend docs: http://${WIFI_IP}:8000/docs"
echo ""
echo "Press Ctrl+C to stop the backend."

# Keep script alive so Ctrl+C kills the backend too
wait $BACKEND_PID