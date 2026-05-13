#!/bin/bash
# =============================================================================
# MongoDB Entrypoint Wrapper
#
# Copies the keyFile from the read-only host mount to a writable path and
# sets the required 400 permissions before handing off to the official
# MongoDB Docker entrypoint.
#
# Required for MongoDB 7+ replica-set + auth setups in Docker where the
# host-mounted keyFile cannot have permissions set directly by compose.
# =============================================================================
set -e

# Copy keyFile to a writable path and lock down permissions
cp /tmp/mongo-keyfile-src /etc/mongo-keyfile
chmod 400 /etc/mongo-keyfile
chown 999:999 /etc/mongo-keyfile 2>/dev/null || true   # mongodb uid in official image

exec /usr/local/bin/docker-entrypoint.sh "$@"
