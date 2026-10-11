-- AuditLog เป็นแบบเพิ่มได้อย่างเดียว (CLAUDE.md ข้อ 6): ห้าม UPDATE/DELETE แม้จะเรียกจากแอปเอง
-- (TRUNCATE ไม่ถูกบล็อก เพื่อให้ Integration Test ล้างฐานข้อมูลทดสอบได้)
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_delete
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
