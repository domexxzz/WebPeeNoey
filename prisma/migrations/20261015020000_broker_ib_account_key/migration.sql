-- เลขบัญชีเทรดเดียวผูกได้ครั้งละ 1 สมาชิก ไม่ว่าจะระบุ MT4 หรือ MT5 (กันยื่นบัญชีเดียวกันซ้ำโดยเปลี่ยนแพลตฟอร์ม)
DROP INDEX "BrokerAccount_broker_platform_accountNumber_key";

CREATE UNIQUE INDEX "BrokerAccount_broker_accountNumber_key" ON "BrokerAccount"("broker", "accountNumber");
