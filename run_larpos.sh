#!/bin/sh
set -e

# 1. Enable essential hardware & display services
# udev creates the device nodes for your GPU (/dev/dri) and keyboard/mouse
rc-update add udev default
# seatd manages Wayland display & input permissions for Cage
rc-update add seatd default
# networking enables DHCP if an Ethernet cable is plugged in
rc-update add networking default



adduser -D -u 1000 -s /bin/sh kiosk
addgroup kiosk seat
addgroup kiosk video
addgroup kiosk input

mkdir -p /opt/larpos/frontend
chown -R kiosk:kiosk /opt/larpos

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

mkdir -p -m 0700 "$XDG_RUNTIME_DIR"
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    # Start your Node.js backend if present
    if [ -f /opt/larpos/server.js ]; then
        node /opt/larpos/server.js &
        sleep 1
    fi

    # Launch Cage with Chromium in clean user mode!
    exec cage -- firefox-esr --kiosk http://127.0.0.1:8080/
fi
EOF

chown kiosk:kiosk /home/kiosk/.profile
chmod +x /home/kiosk/.profile

exit 0