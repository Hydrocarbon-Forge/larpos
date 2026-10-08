#!/bin/sh
set -e

# 1. Enable essential hardware & display services
# Reconcile device manager: ensure ONLY udev runs, remove conflicting mdev from sysinit
rc-update del mdev sysinit 2>/dev/null || true
rc-update del hwdrivers sysinit 2>/dev/null || true
rc-update del udev default 2>/dev/null || true

# If setup-devd is available in the image, trigger eudev configuration
if command -v setup-devd >/dev/null 2>&1; then
    setup-devd -C udev 2>/dev/null || true
fi

# Ensure eudev services run in sysinit for proper kernel uevent processing and DRM discovery
rc-update add udev sysinit 2>/dev/null || true
rc-update add udev-trigger sysinit 2>/dev/null || true
rc-update add udev-settle sysinit 2>/dev/null || true
rc-update add udev-postmount default 2>/dev/null || true

# seatd manages Wayland display & input permissions for Cage
rc-update add seatd default 2>/dev/null || true

# networking enables DHCP if an Ethernet cable is plugged in
rc-update add networking default 2>/dev/null || true

# 2. User & group provisioning
# Ensure device-access groups exist
addgroup -S video 2>/dev/null || true
addgroup -S render 2>/dev/null || true
addgroup -S seat 2>/dev/null || true
addgroup -S input 2>/dev/null || true

# Create kiosk user if not already present
if ! id -u kiosk >/dev/null 2>&1; then
    adduser -D -u 1000 -s /bin/sh kiosk
fi

# Add kiosk to all display, render, seat, and input groups
addgroup kiosk seat 2>/dev/null || true
addgroup kiosk video 2>/dev/null || true
addgroup kiosk render 2>/dev/null || true
addgroup kiosk input 2>/dev/null || true

# 3. Directory layout & log capture permissions
mkdir -p /opt/larpos/frontend
mkdir -p /var/larpos/state /var/larpos/bins
mkdir -p /var/log
touch /var/log/larpos-cage.log

chown -R kiosk:kiosk /opt/larpos /var/larpos
chown kiosk:kiosk /var/log/larpos-cage.log
chmod 0664 /var/log/larpos-cage.log

# Ensure display diagnostic utility is executable
chmod +x /usr/sbin/larpos-display-check 2>/dev/null || true

cat << 'EOF' > /usr/sbin/autologin
#!/bin/sh
exec /bin/login -f kiosk
EOF
chmod +x /usr/sbin/autologin

passwd -d kiosk

sed -i 's|^tty1:.*|tty1::respawn:/sbin/getty -n -l /usr/sbin/autologin 38400 tty1|' /etc/inittab

cat << 'EOF' > /home/kiosk/.profile
export XDG_RUNTIME_DIR=/tmp/runtime-root
export WLR_RENDERER=pixman
export WLR_NO_HARDWARE_CURSORS=1
export MOZ_ENABLE_WAYLAND=1
export XCURSOR_PATH=/usr/share/icons
export XCURSOR_THEME=capitaine-cursors
export XCURSOR_SIZE=24
export LLM_BASE="${LLM_BASE:-http://192.168.1.72:8080}"
export SEATD_SOCK=/run/seatd.sock
export LIBSEAT_BACKEND=seatd

mkdir -p -m 0700 "$XDG_RUNTIME_DIR"
if [ -S /run/seatd.sock ]; then
    ln -sf /run/seatd.sock "$XDG_RUNTIME_DIR/seatd.sock"
fi

if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    # Start your Node.js backend if present
    if [ -f /opt/larpos/server.js ]; then
        node /opt/larpos/server.js &
        sleep 1
    fi

    CAGE_LOG="/var/log/larpos-cage.log"
    touch "$CAGE_LOG" 2>/dev/null || CAGE_LOG="/tmp/larpos-cage.log"

    # Wait up to ~10s for /dev/dri/card0 to exist AND be openable by kiosk
    DRI_NODE="/dev/dri/card0"
    DRI_READY=0

    for i in $(seq 1 10); do
        if [ -e "$DRI_NODE" ] && [ -r "$DRI_NODE" ]; then
            DRI_READY=1
            break
        fi
        sleep 1
    done

    # Refresh seatd socket symlink if socket appeared during wait
    if [ -S /run/seatd.sock ]; then
        ln -sf /run/seatd.sock "$XDG_RUNTIME_DIR/seatd.sock"
    fi

    if [ "$DRI_READY" -eq 1 ]; then
        exec cage -- firefox-esr --kiosk http://127.0.0.1:8080/ 2>> "$CAGE_LOG"
    else
        echo "=== [LarpOS Display Diagnostic: DRM Attach Timeout] ==="
        echo "Notice: $DRI_NODE is not available or readable by kiosk after 10s."
        ls -l /dev/dri 2>&1 || true
        id
        getent group video render 2>&1 || grep -E "^(video|render):" /etc/group 2>&1 || true
        ls -ld /run/seatd /run/seatd.sock "$XDG_RUNTIME_DIR" 2>&1 || true
        ls -la /run/seatd 2>/dev/null || true
        dmesg | tail -30 2>&1 || true
        echo "=== [Falling back to WLR_BACKENDS=headless] ==="

        {
            echo "=== [LarpOS Display Diagnostic: DRM Attach Timeout] ==="
            date
            ls -l /dev/dri 2>&1 || true
            id
            getent group video render 2>&1 || grep -E "^(video|render):" /etc/group 2>&1 || true
            ls -ld /run/seatd /run/seatd.sock "$XDG_RUNTIME_DIR" 2>&1 || true
            ls -la /run/seatd 2>/dev/null || true
            dmesg | tail -30 2>&1 || true
            echo "========================================================"
        } >> "$CAGE_LOG" 2>&1

        export WLR_BACKENDS=headless
        exec cage -- firefox-esr --kiosk http://127.0.0.1:8080/ 2>> "$CAGE_LOG"
    fi
fi
EOF

chown kiosk:kiosk /home/kiosk/.profile
chmod +x /home/kiosk/.profile

exit 0