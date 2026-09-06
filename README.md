# เว็บไซต์ ตรอ.คุณภาพ

เว็บไซต์ประชาสัมพันธ์บริการตรวจสภาพรถ รองรับการแสดงผลบนมือถือ และตั้งค่าให้ใช้โดเมน `www.khunnaphap.co` ผ่าน GitHub Pages

## นำเว็บไซต์ขึ้น GitHub Pages

1. สร้าง repository ใหม่ใน GitHub เช่น `khunnaphap-website`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ไปยัง branch `main`
3. ใน repository ไปที่ **Settings → Pages**
4. เลือก **Deploy from a branch**, เลือก branch `main` และโฟลเดอร์ `/(root)` แล้วกด Save
5. เมื่อ GitHub Pages พร้อมใช้งาน ให้ใส่ Custom domain เป็น `www.khunnaphap.co`

## ตั้งค่า DNS

ที่ผู้ให้บริการโดเมน เพิ่ม DNS record ดังนี้

| Type | Host / Name | Value |
| --- | --- | --- |
| CNAME | `www` | `<ชื่อผู้ใช้-GitHub>.github.io` |

แทนที่ `<ชื่อผู้ใช้-GitHub>` ด้วยชื่อผู้ใช้ GitHub ของคุณ เช่น หาก username คือ `example` ให้ใส่ `example.github.io`

หลัง DNS อัปเดตแล้ว กลับไปที่ **Settings → Pages** และเปิด **Enforce HTTPS**
