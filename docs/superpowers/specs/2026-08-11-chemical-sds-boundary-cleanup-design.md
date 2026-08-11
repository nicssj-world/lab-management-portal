# Chemical SDS Boundary Cleanup Design

**Date:** 2026-08-11

## Goal

ทำให้ SDS ห้องสารเคมีและ SDS แยกตามงานที่อยู่ในฐานข้อมูลเดียวกันไม่ปนกันในทะเบียน การ์ดสถานะ และ workflow โดยเก็บไฟล์กับประวัติเดิมไว้ครบ และไม่ลบข้อมูลจากฐานข้อมูล

## Current evidence

จากการตรวจฐานข้อมูลแบบอ่านอย่างเดียว:

- `chemical_sds_versions` มี 134 รายการ: `draft` 110 และ `approved` 24
- 106 รายการจำแนกเป็น SDS แยกตามงานได้จาก `chemical_department_chemical_links` หรือ department holding
- 20 รายการจำแนกเป็น SDS ห้องสารเคมีได้ และแต่ละรายการมี room holding เพียงหนึ่งรายการ
- 8 รายการ legacy ยังไม่ผูกตรงกับ holding หรือลิงก์งาน และ product เดียวกันมีทั้ง room และ department holding จึงต้องกักไว้เป็นรายการกำกวมก่อน
- `chemical_sds_publications` ยังไม่มีข้อมูล จึงยังไม่มีการเผยแพร่ผ่าน registry-v2

ปัญหาจึงไม่ใช่การมีตาราง `chemical_sds_versions` ร่วมกัน แต่คือ query เดิมตีความ version ระดับ product เป็น SDS ของห้องทั้งหมด และ legacy rows บางส่วนไม่มีความสัมพันธ์ปลายทางที่ explicit

## Chosen approach

คง `chemical_sds_versions` เป็นตาราง version กลางเพื่อรักษาประวัติ แต่ใช้ความสัมพันธ์เป็น source of truth:

1. Version ที่มี `source_holding_id` ให้ใช้ `chemical_inventory_holdings.storage_scope` เป็นปลายทาง
2. Legacy version ที่ไม่มี `source_holding_id` แต่มี `chemical_department_chemical_links` ให้ใช้ linked holding เป็นปลายทางของ SDS งาน
3. Legacy version ที่ไม่มี link ให้ fallback เป็น room ได้เฉพาะเมื่อ product มี room holdings และไม่มี department holdings; ถ้ามีทั้งสอง scope ให้ถือเป็น `ambiguous` และไม่แสดงในแผงห้องจนกว่าจะผูกข้อมูล
4. Backfill เฉพาะ 20 room versions ที่มี room holding เดียว โดยเติม `source_holding_id` และบันทึก audit; ไม่เปลี่ยนไฟล์หรือ status
5. 8 ambiguous จะไม่ถูกเขียนทับจากการเดา และจะแสดงใน dry-run report เพื่อรอการยืนยันปลายทาง
6. 106 department versions และลิงก์เดิมจะคงอยู่ใน compatibility workflow ของคลัง SDS งาน; ห้ามย้ายให้กลายเป็น room SDS และห้ามลบ version ที่ถูกหลาย department links ใช้ร่วมกัน

## Application behavior

- แผง `SDS ห้องสารเคมี` รับเฉพาะ version IDs ที่ resolve เป็น room
- modal SDS ในทะเบียนเลือก version ที่ `source_holding_id` ตรงกับ holding ของแถวเท่านั้น; approved version จาก department หรือ holding อื่นห้ามเป็น fallback
- แผง `SDS แยกตามงาน` ใช้ `chemical_department_sds` และ department publications ของตนเอง ไม่ใช้ status cards ของ room SDS
- status ของ version เดิมถูกเก็บตามเดิม: `draft` ยังคงเป็น draft และ `approved` ยังคงเป็น approved; approved ไม่ถูกตีความว่าเผยแพร่แล้ว
- การ link publication จะยังเป็นขั้นตอนแยกต่างหาก และไม่ถูกสร้างอัตโนมัติใน cleanup
- การอนุมัติ/แทนที่ version ใหม่ต้องไม่ทำให้รายการของปลายทางอื่นถูกเลือกมาแสดงเป็น SDS ของ holding ปัจจุบัน

## Data safety

สคริปต์ cleanup จะมีสองโหมด:

- ค่าเริ่มต้นเป็น dry-run แสดง classification, planned updates, ambiguous rows และ invariant failures โดยไม่เขียนข้อมูล
- `--apply` เขียนเฉพาะ `source_holding_id` ของ deterministic room rows หลังตรวจ invariant แล้ว พร้อมบันทึก `audit_log` ที่มีเหตุผลและ before/after

สคริปต์จะไม่ลบ `chemical_sds_versions`, `chemical_sds_files`, `chemical_department_sds` หรือ department links และจะหยุดถ้าพบหลาย room holding สำหรับ version เดียว, source holding ไม่ตรง product, หรือ target holding ไม่ใช่ room

## Verification

เพิ่ม regression tests สำหรับ:

- direct room version แสดงใน room และ direct department version ไม่แสดง
- department-linked legacy version ไม่แสดงใน room แม้ product เดียวกันมี room holding
- unlinked product ที่มีทั้ง room และ department holdings ถูกจัดเป็น ambiguous และไม่ถูกแสดงใน room
- registry modal ไม่ใช้ approved version จาก product อื่น holding เป็น fallback
- cleanup plan วางแผนเฉพาะ deterministic room assignments และหยุดที่ ambiguous rows

ตรวจด้วย `npm run test:chemical-safety`, `npx tsc --noEmit`, `npm run build` และ dry-run ของ cleanup script ก่อน apply
