<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Protected routes

ถ้าอนาคตเพิ่มหน้า protected ใหม่ เช่น `/admin` หรือ `/reports` ต้องเพิ่ม path นั้นใน regex ของ `proxy.ts` ด้วย ไม่งั้น Proxy จะไม่ redirect ไป login
