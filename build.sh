#!/bin/sh
set -e

# Ensure app is synced into image skeleton directory at /opt/larpos
mkdir -p image/skel/opt/larpos
cp -a app/* image/skel/opt/larpos/

sudo ./tools/alpine-make-vm-image \
  --image-format raw \
  --image-size 2G \
  --repositories-file repos \
  --packages "alpine-base cage firefox-esr seatd eudev font-dejavu mesa-dri-gallium nodejs npm seatd-launch nano adwaita-icon-theme libinput-udev libinput capitaine-cursors" \
  --fs-skel-dir image/skel \
  --script-chroot larpos.img run_larpos.sh

sudo chown nathan:nathan larpos.img