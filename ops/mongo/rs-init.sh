#!/bin/bash
# =============================================================================
# MongoDB Replica Set Initialiser
#
# Called once by the mongo-rs-init Docker Compose service after the mongo
# container is healthy.  Idempotent: if the replica set is already
# initialised the script exits 0 without making any changes.
# =============================================================================
set -euo pipefail

mongosh "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/admin?authSource=admin" \
  --quiet \
  --eval "
    try {
      const s = rs.status();
      print('Replica set \"' + s.set + '\" already initialised — nothing to do.');
    } catch (e) {
      if (e.codeName === 'NotYetInitialized' || e.code === 94) {
        const result = rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] });
        if (result.ok === 1) {
          print('Replica set rs0 initialised successfully.');
        } else {
          printjson(result);
          throw new Error('rs.initiate() did not return ok:1');
        }
      } else {
        printjson({ code: e.code, codeName: e.codeName, message: e.message });
        throw e;
      }
    }
  "
