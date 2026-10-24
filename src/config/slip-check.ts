/**
 * ตรวจสลิปอัตโนมัติผ่าน EasySlip (ไม่บังคับ)
 * - EASYSLIP_TOKEN (ความลับ): ไม่ตั้ง = ปิด แอดมินตรวจสลิปด้วยตาเหมือนเดิม (ยังอ่าน QR + กันสลิปซ้ำในเครื่องเราเสมอ)
 * - SLIP_RECEIVER_ACCOUNTS: เลขบัญชีปลายทางตามที่โชว์บนสลิป คั่นด้วยจุลภาค ใส่ตัวปิดบังได้ เช่น "xxx-x-x1234-x"
 *   จำเป็นเพราะสลิปมักโชว์ "เลขบัญชีธนาคาร" ไม่ใช่เลขพร้อมเพย์ที่ใช้สร้าง QR — ถ้าไม่ตั้ง ระบบเทียบกับเลขพร้อมเพย์ของออเดอร์อย่างเดียว
 *
 * ⚠️ ผลตรวจไม่ผ่านไม่ปฏิเสธออเดอร์เอง และไม่มีการอนุมัติอัตโนมัติ — แค่ติดป้ายให้แอดมินตัดสิน
 */

export interface SlipCheckConfig {
  easyslipToken: string | null;
  receiverAccounts: string[];
}

interface SlipCheckEnv {
  EASYSLIP_TOKEN?: string;
  SLIP_RECEIVER_ACCOUNTS?: string;
}

const ACCOUNT_PATTERN = /^[0-9xX-]{4,30}$/;

export function resolveSlipCheckConfig(env: SlipCheckEnv): SlipCheckConfig {
  const token = env.EASYSLIP_TOKEN?.trim() ?? "";
  const receiverAccounts = (env.SLIP_RECEIVER_ACCOUNTS ?? "")
    .split(",")
    .map((account) => account.trim())
    .filter((account) => ACCOUNT_PATTERN.test(account));
  return { easyslipToken: token.length >= 8 ? token : null, receiverAccounts };
}

/** อ่านตอนเรียกใช้ (ไม่ใช่ตอน import) — ค่าลับฝั่งเซิร์ฟเวอร์ ไม่ถูกฝังตอน build */
export function getSlipCheckConfig(): SlipCheckConfig {
  return resolveSlipCheckConfig({ EASYSLIP_TOKEN: process.env.EASYSLIP_TOKEN, SLIP_RECEIVER_ACCOUNTS: process.env.SLIP_RECEIVER_ACCOUNTS });
}
