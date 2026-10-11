import { Fragment } from "react";

/**
 * ตัดบรรทัดหัวข้อภาษาไทยเฉพาะตรงช่องว่างระหว่างวลี
 * เบราว์เซอร์ตัดคำไทยด้วยพจนานุกรม ซึ่งไม่รู้จักคำทับศัพท์ (เช่น "คอมมูนิตี้" ถูกตัดเป็น "คอม|มูนิตี้")
 * แต่ละวลีเป็น inline-block + max-w-full: ถ้าวลียาวกว่าความกว้างจอ จะยอมตัดภายในวลีแทนการล้นจอ
 */
export function Phrases({ text }: { text: string }) {
  const phrases = text.split(" ").filter(Boolean);
  return (
    <>
      {phrases.map((phrase, index) => (
        <Fragment key={`${phrase}-${index}`}>
          {index > 0 && " "}
          <span className="inline-block max-w-full">{phrase}</span>
        </Fragment>
      ))}
    </>
  );
}
