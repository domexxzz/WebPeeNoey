#!/bin/sh
# สร้างฐานข้อมูลแยกสำหรับ Integration Test เพื่อไม่ให้เทสต์ไปลบข้อมูลในฐานข้อมูลที่ใช้พัฒนา
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE "${POSTGRES_DB}_test";
EOSQL
