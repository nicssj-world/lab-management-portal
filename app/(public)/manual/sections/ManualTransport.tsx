'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { H2, H3, Callout, Section } from '../_primitives'
import { type Lang } from '../data'
import type { CollectionFigure } from './collection-data'
import { TRANSPORT_WORD_FIGURES, TRANSPORT_WORD_SECTION } from './transport-data'

interface Props { lang: Lang }

// ── Data ──────────────────────────────────────────────────────────────────────

const REJECTION_RULES = [
  { th: 'ไม่มีฉลากหรือรายละเอียดตัวอย่างไม่ครบ', en: 'Missing or incomplete label', bodyTh: 'สิ่งส่งตรวจที่ไม่มีฉลาก (Label) หรือมีรายละเอียดของตัวอย่างไม่ชัดเจน ไม่ครบตามข้อกำหนดในคู่มือการส่งตรวจของแต่ละรายการทดสอบ สำหรับงานเพาะเชื้อ ห้องปฏิบัติการจะรายงานว่า “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” และระบุเหตุผลเพิ่มเติมว่า “ไม่ระบุ ชื่อ-นามสกุล (ข้างขวด)” หอผู้ป่วยต้องทำการเก็บตัวอย่างใหม่', bodyEn: 'A specimen without a label, or with unclear or incomplete details required by the test manual, is unacceptable. For culture, report “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” with the additional reason “ไม่ระบุ ชื่อ-นามสกุล (ข้างขวด)” and request a new specimen.' },
  { th: 'ข้อมูลในใบส่งตรวจกับภาชนะไม่ตรงกัน', en: 'Request-form/container mismatch', bodyTh: 'ชื่อ-สกุลผู้ป่วย และวันเดือนปีเกิดหรือ HN. หรือ LAB ID ของใบนำส่งตรวจกับภาชนะบรรจุสิ่งตัวอย่างส่งตรวจไม่ตรงกัน สำหรับงานเพาะเชื้อ ห้องปฏิบัติการจะรายงานว่า “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” และระบุเหตุผลเพิ่มเติมว่า “ชื่อบนใบนำส่งกับชื่อข้างขวดไม่ตรงกัน” หอผู้ป่วยต้องทำการเก็บตัวอย่างใหม่', bodyEn: 'The patient name and DOB, HN, or LAB ID on the request form does not match the specimen container. For culture, report “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” with “ชื่อบนใบนำส่งกับชื่อข้างขวดไม่ตรงกัน” and request a new specimen.' },
  { th: 'ตัวอย่างหก เลอะ หรือรั่วซึม', en: 'Spilled, soiled, or leaking specimen', bodyTh: 'สิ่งส่งตรวจที่มีการหก เลอะ หรือรั่วซึม และห้องปฏิบัติการพิจารณาแล้วว่าไม่สามารถทำการเพาะเชื้อได้ ห้องปฏิบัติการจะรายงานว่า “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” และระบุเหตุผลเพิ่มเติมว่า “Leaked Specimen.” หอผู้ป่วยต้องทำการเก็บตัวอย่างใหม่', bodyEn: 'If a specimen is spilled, soiled, or leaking and the laboratory determines that culture cannot be performed, report “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” with “Leaked Specimen.” A new specimen is required.' },
  { th: 'ใช้ภาชนะไม่เหมาะสม', en: 'Inappropriate container', bodyTh: 'สิ่งส่งตรวจที่ใส่ในภาชนะไม่เหมาะสม เช่น ภาชนะที่ไม่ sterile, transport media ผิดชนิด หรือชิ้นเนื้อที่ใส่ formalin เป็นต้น ห้องปฏิบัติการจะรายงานว่า “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” และระบุเหตุผลเพิ่มเติมว่า “Not appropriate sample, Not process for culture” หอผู้ป่วยต้องทำการเก็บตัวอย่างใหม่', bodyEn: 'Examples include a non-sterile container, the wrong transport medium, or tissue placed in formalin. For culture, report “Unacceptable Specimen for C/S (IMPROPER COLLECTION)” with “Not appropriate sample, Not process for culture” and request a new specimen.' },
  { th: 'ไม่ระบุตำแหน่งเก็บตัวอย่าง', en: 'Collection site not stated', bodyTh: 'สิ่งส่งตรวจทุกชนิดต้องระบุตำแหน่งในการเก็บให้ชัดเจน หากไม่ระบุตำแหน่ง ห้องปฏิบัติการจะระบุในรายงานผลการเพาะเชื้อว่า “ไม่ระบุตำแหน่งการเก็บสิ่งส่งตรวจ”', bodyEn: 'Every specimen must state the collection site. If the site is missing, report “ไม่ระบุตำแหน่งการเก็บสิ่งส่งตรวจ”.' },
  { th: 'ไม่ระบุเวลาเก็บตัวอย่าง', en: 'Collection time not stated', bodyTh: 'สิ่งส่งตรวจทุกชนิดต้องระบุเวลาในการเก็บสิ่งส่งตรวจ ซึ่งเป็นคนละเวลาที่ทำการบันทึกขอส่งตรวจใน HIS หากไม่ระบุเวลา ห้องปฏิบัติการจะระบุในรายงานผลการเพาะเชื้อว่า “ไม่ระบุเวลาในการเก็บสิ่งส่งตรวจ”', bodyEn: 'Every specimen must state the collection time, which may differ from the time the test request was entered in HIS. If missing, report “ไม่ระบุเวลาในการเก็บสิ่งส่งตรวจ”.' },
  { th: 'ระยะเวลานำส่งเกินกำหนด', en: 'Transport delay', bodyTh: 'หากห้องปฏิบัติการตรวจสอบพบว่าสิ่งส่งตรวจมีระยะเวลาการนำส่งเกินกว่ากำหนด จะระบุในรายงานผลการเพาะเชื้อว่า “Delay Transportation” เนื่องจากการส่งตัวอย่างช้าอาจมีผลต่อการแปลผลการเพาะเชื้อ', bodyEn: 'If the delivery time exceeds the specified limit, report “Delay Transportation”; delayed delivery may affect interpretation of the culture result.' },
  { th: 'ปริมาตรต่ำกว่าหรือไม่ตามเกณฑ์', en: 'Insufficient or incorrect volume', bodyTh: 'ปริมาตรของสิ่งตัวอย่างส่งตรวจไม่ได้ตามเกณฑ์ที่กำหนด เช่น การส่งตรวจ PT, PTT หรือ ESR ต้องใส่เลือดให้ได้ปริมาตรตามข้าง tube หากปริมาตรต่ำกว่าเกณฑ์ที่กำหนดให้ปฏิเสธสิ่งส่งตรวจ', bodyEn: 'The specimen volume does not meet the defined criterion. For example, PT, PTT, and ESR tubes must be filled to the volume marked on the tube; below-specification volume is rejected.' },
  { th: 'ตัวอย่างมี Hemolysis', en: 'Hemolyzed specimen', bodyTh: 'มีการแตกของเม็ดเลือดแดง (Hemolyzed) ที่ 3+ ขึ้นไป', bodyEn: 'Red-cell hemolysis of 3+ or greater.' },
  { th: 'พบ Fibrin clot', en: 'Fibrin clot present', bodyTh: 'ตัวอย่างที่มี Fibrin clot เช่น การส่งตรวจ CBC, PT, INR, PTT และ Blood gas เป็นต้น', bodyEn: 'A specimen containing a fibrin clot, such as a CBC, PT, INR, PTT, or blood-gas specimen.' },
  { th: 'เก็บสิ่งส่งตรวจไม่ถูกต้อง', en: 'Incorrectly collected specimen', bodyTh: 'สิ่งตัวอย่างส่งตรวจที่เก็บไม่ถูกต้อง เช่น การเก็บเสมหะแต่เก็บเป็นน้ำลาย', bodyEn: 'A specimen collected incorrectly, such as submitting saliva instead of sputum.' },
  { th: 'สิ่งส่งตรวจปนเปื้อนนอกภาชนะ', en: 'Contaminated outside the container', bodyTh: 'สิ่งตัวอย่างส่งตรวจที่หกปนเปื้อนอยู่นอกภาชนะบรรจุ', bodyEn: 'A specimen that has spilled or contaminated the outside of the container.' },
  { th: 'นำส่งไม่ถูกวิธี', en: 'Improper transport condition', bodyTh: 'สิ่งตัวอย่างส่งตรวจที่นำส่งไม่ถูกวิธี ได้แก่ ตัวอย่างส่งตรวจ Blood gas ที่ควรใช้ ice pack ในการรักษาอุณหภูมิตัวอย่างตลอดเวลาในการนำส่ง หรือตัวอย่างส่งตรวจ Microbilirubin เด็กที่ควรห่อตัวอย่างส่งตรวจด้วยกระดาษทึบแสงหรือกระดาษฟอยล์ขณะนำส่งตรวจ', bodyEn: 'A specimen transported incorrectly, such as Blood gas without an ice pack throughout transport or pediatric Microbilirubin without opaque paper or foil protection.' },
  { th: 'ตัวอย่างข้นหรือหนืดมาก', en: 'Specimen too viscous', bodyTh: 'สิ่งตัวอย่างส่งตรวจที่มีลักษณะข้นหรือหนืดมาก ไม่สามารถดูดวัดได้', bodyEn: 'A specimen that is too thick or viscous to aspirate and measure.' },
]

const REJECTION_GROUPS = [
  {
    th: 'การชี้บ่งและข้อมูล', en: 'Identification and information',
    descriptionTh: 'ตรวจสอบฉลาก ตัวชี้บ่ง ตำแหน่ง และเวลาเก็บให้ครบถ้วนและสอดคล้องกับใบนำส่ง', descriptionEn: 'Verify labels, identifiers, collection site, and collection time against the request.',
    rules: [REJECTION_RULES[0], REJECTION_RULES[1], REJECTION_RULES[4], REJECTION_RULES[5], REJECTION_RULES[6]],
  },
  {
    th: 'ภาชนะและปริมาตร', en: 'Container and volume',
    descriptionTh: 'ใช้ภาชนะให้ถูกชนิดและเก็บตัวอย่างให้ได้ปริมาตรตามที่กำหนด', descriptionEn: 'Use the correct container and collect the specified volume.',
    rules: [REJECTION_RULES[3], REJECTION_RULES[7]],
  },
  {
    th: 'คุณภาพสิ่งตัวอย่าง', en: 'Specimen quality',
    descriptionTh: 'ปฏิเสธตัวอย่างที่ไม่เหมาะสมต่อการตรวจวิเคราะห์หรือการเพาะเชื้อ', descriptionEn: 'Reject specimens unsuitable for analysis or culture.',
    rules: [REJECTION_RULES[2], REJECTION_RULES[8], REJECTION_RULES[9], REJECTION_RULES[10], REJECTION_RULES[11], REJECTION_RULES[13]],
  },
  {
    th: 'การนำส่ง', en: 'Transport',
    descriptionTh: 'นำส่งทันทีหรือควบคุมสภาวะตามข้อกำหนดของการตรวจ', descriptionEn: 'Deliver immediately or maintain the conditions required for the test.',
    rules: [REJECTION_RULES[12]],
  },
]

const SPECIMEN_STORAGE_OVERVIEW = [
  {
    specimenTh: 'สิ่งตัวอย่างส่งตรวจทั่วไป', specimenEn: 'General specimens',
    storageTh: 'บรรจุในถุง biohazard ปิดสนิท และแยกใบส่งตรวจไว้ในช่องด้านนอกของถุง', storageEn: 'Seal in a biohazard bag and keep the request form in the outer pocket.',
    transportTh: 'นำส่งห้องปฏิบัติการทันที หรือปฏิบัติตามข้อกำหนดเฉพาะของรายการตรวจ', transportEn: 'Deliver immediately, or follow the requirements for the individual test.',
  },
  {
    specimenTh: 'Blood gas', specimenEn: 'Blood gas',
    storageTh: 'ควบคุมอุณหภูมิตัวอย่างด้วย ice pack ตลอดระยะเวลาการนำส่ง', storageEn: 'Maintain specimen temperature with an ice pack throughout transport.',
    transportTh: 'นำส่งห้องปฏิบัติการทันที', transportEn: 'Deliver to the laboratory immediately.',
  },
  {
    specimenTh: 'ปัสสาวะทั่วไป / ปัสสาวะแรกตอนเช้า', specimenEn: 'Random / first-morning urine',
    storageTh: 'เก็บในภาชนะที่สะอาด แห้ง และมีฝาปิดสนิท', storageEn: 'Collect in a clean, dry, tightly capped container.',
    transportTh: 'นำส่งภายใน 2 ชั่วโมง', transportEn: 'Deliver within 2 hours.',
  },
  {
    specimenTh: 'ปัสสาวะ 24 ชั่วโมง', specimenEn: '24-hour urine',
    storageTh: 'เก็บในตู้เย็นที่อุณหภูมิ 4 °C หรือเก็บในกล่องโฟมที่แช่น้ำแข็งตลอดเวลา', storageEn: 'Keep refrigerated at 4 °C or in an ice-filled foam container throughout collection.',
    transportTh: 'เมื่อเก็บครบแล้ว นำส่งทันที หรือภายใน 2 ชั่วโมง', transportEn: 'After collection is complete, deliver immediately or within 2 hours.',
  },
  {
    specimenTh: 'น้ำอสุจิ', specimenEn: 'Semen',
    storageTh: 'ห้ามแช่เย็น', storageEn: 'Do not refrigerate.',
    transportTh: 'นำส่งภายใน 1 ชั่วโมง', transportEn: 'Deliver within 1 hour.',
  },
  {
    specimenTh: 'Microbilirubin ในผู้ป่วยเด็ก', specimenEn: 'Pediatric microbilirubin',
    storageTh: 'ป้องกันแสงโดยห่อภาชนะด้วยกระดาษทึบแสงหรือกระดาษฟอยล์', storageEn: 'Protect from light with opaque paper or aluminium foil.',
    transportTh: 'นำส่งตามข้อกำหนดของรายการตรวจ', transportEn: 'Follow the requirements for the individual test.',
  },
]

const TRANSPORT_GUIDANCE = [
  {
    th: 'แปะสติ๊กเกอร์ barcode LAB ID ตามแนวนอนของหลอดเก็บตัวอย่างหรือภาชนะบรรจุ โดยให้ตัวเลข LAB ID อยู่ทางด้านบนของหลอดหรือภาชนะบรรจุ และไม่ควรแปะสติ๊กเกอร์ทับขีดบอกปริมาตรข้างหลอด',
    en: 'Place the LAB ID barcode sticker horizontally on the specimen tube or container, with the LAB ID numbers at the top. Do not cover the volume markings on the tube.',
  },
  {
    th: 'การชี้บ่งสิ่งตัวอย่างส่งตรวจ: ตัวชี้บ่งที่ 1 คือ ชื่อ-สกุลของผู้ป่วย และตัวชี้บ่งที่ 2 คือ วันเดือนปีเกิดผู้ป่วย หรือ HN. หรือ Lab ID โดยต้องระบุให้ตรวจสอบย้อนกลับได้',
    en: 'Specimen identification: identifier 1 is the patient name and surname; identifier 2 is the patient date of birth, HN, or Lab ID. The identifiers must support traceability.',
  },
  {
    th: 'หอผู้ป่วยที่ไม่มีเครื่องพิมพ์ barcode LAB ID ให้ใช้สติ๊กเกอร์ของหอผู้ป่วยติดหลอดเก็บตัวอย่างหรือภาชนะบรรจุ และต้องมีใบส่งตรวจทางห้องปฏิบัติการกำกับมาด้วย',
    en: 'A ward without a LAB ID barcode printer must use the ward sticker on the specimen tube or container and send the laboratory request form with it.',
  },
  {
    th: 'นำตัวอย่างส่งตรวจใส่ซองบรรจุที่มีสัญลักษณ์ และควรนำส่งห้องปฏิบัติการทันที หรือเก็บไว้ตามคำแนะนำของการทดสอบแต่ละ Test',
    en: 'Place the specimen in a labeled protective bag. Deliver it to the laboratory immediately or store it according to the instructions for each test.',
  },
]

const STAT_STEPS = [
  { th: 'แพทย์ พยาบาลหรือผู้รับบริการ โทรประสานกับนักเทคนิคการแพทย์ทราบกรณีขอส่งสิ่งตัวอย่างส่งตรวจ กรณีเร่งด่วน พร้อมกับบันทึกรายการขอตรวจ(Request Lab) ในระบบสารสนเทศ HIS และดำเนินการจัดเก็บ นำส่งสิ่งตัวอย่างส่งตรวจยังห้องปฏิบัติการเทคนิคการแพทย์โดยเร็ว', en: 'The physician, nurse, or service user contacts the medical technologist about the urgent specimen request, records the Request Lab in the HIS information system, then collects and delivers the specimen to the Medical Technology laboratory as quickly as possible.' },
  { th: 'นักเทคนิคการแพทย์ พิจารณาดำเนินการตรวจสอบ ลงทะเบียนรับสิ่งตัวอย่างส่งตรวจ ตรวจวิเคราะห์และรายงานผลการตรวจวิเคราะห์กรณีเร่งด่วนก่อน', en: 'The medical technologist reviews and verifies the specimen, registers receipt, performs the analysis, and reports the urgent result first.' },
]

const NIPT_TUBE_RULES = [
  'หลอดเก็บเลือดต้องเป็นชนิด Cowin tube หรือ Streck tube เท่านั้น โดยปริมาณเลือดที่ยอมรับได้ต่ำสุด คืออย่างน้อย 8 มิลลิลิตร',
  'สิ่งส่งตรวจที่ส่งมาต้องถูกควบคุมอุณหภูมิในช่วง 6–35 °C',
  'หลังปั่นแยกพลาสมาแล้ว หากพบภาวะเม็ดเลือดแดงแตกรุนแรง (severe hemolysis), ไขมันสูง (lipidemia), บิลลิรูบินสูง (hyperbilirubinemia) หรือพบการปนเปื้อนของเชื้อจุลชีพ (bacterial contamination) ให้ดำเนินการปฏิเสธสิ่งส่งตรวจ',
  'สิ่งส่งตรวจขนส่งมาในอุณหภูมิที่ไม่เหมาะสม หรือใช้ภาชนะบรรจุที่ไม่ได้รับการรับรอง ผิดประเภท หรือหมดอายุแล้ว ให้ปฏิเสธสิ่งส่งตรวจ',
]

const NIPT_REQUIRE_SIGNATURE = [
  'ตัวอย่างที่ถูกส่งมาถึงห้องปฏิบัติการเกินกว่า 96 ชั่วโมง แต่ไม่เกิน 7 วัน',
  'ผู้รับบริการมีอายุครรภ์น้อยกว่า 10 สัปดาห์ หรือเกิน 20 สัปดาห์',
  'ผู้รับบริการที่มี BMI มากกว่า 40',
  'ผู้รับบริการมีประวัติเป็นเนื้องอก สามารถส่งตรวจได้แต่ต้องได้รับคำปรึกษาจากแพทย์ก่อนส่งตรวจ (Pre-test counseling) และลงนามในเอกสารยินยอมรับการตรวจคัดกรอง CBH-NIPT (Fm-WI-T-BM17-02)',
]

const NIPT_ACCEPT_WITH_CONDITION = [
  'ผู้รับบริการที่ได้รับการรักษาด้วย Heparin ต้องได้รับครั้งสุดท้ายนานกว่า 24 ชั่วโมง ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'ผู้รับบริการที่ได้รับ Human serum albumin therapy ต้องรับครั้งสุดท้ายนานกว่า 4 สัปดาห์ ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'ผู้รับบริการที่ได้รับการรักษาด้วย Exogeneous DNA cells introduced immunotherapy หรือยาที่มีสาเหตุทำให้ DNA mutation ต้องได้รับการฉีดครั้งสุดท้ายไม่น้อยกว่า 4 สัปดาห์ ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'ผู้รับบริการที่ได้รับการเปลี่ยนถ่ายเลือด (Allogenic blood transfusion) ภายใน 1 ปี ต้องได้รับการเปลี่ยนถ่ายเลือดครั้งสุดท้ายนานกว่า 1 ปี ก่อนเจาะเลือดตรวจ NGS-NIPT',
  'กรณีเป็น Vanishing Twin Syndrome ตัวอ่อนที่ฝ่อไปแล้ว จะต้องฝ่อก่อนอายุครรภ์ครบ 8 สัปดาห์ และต้องนับต่อจากวันที่ตัวอ่อนฝ่อไปอีก 8 สัปดาห์ จึงจะสามารถเจาะเลือดตรวจ NGS-NIPT ได้',
]

const NIPT_REQUIRE_HISTORY = [
  'ผู้รับบริการที่ใช้เทคโนโลยีเจริญพันธุ์ต่างๆ',
  'ผู้รับบริการที่มีประวัติโรคทางพันธุกรรมเกิดขึ้นกับครอบครัว',
  'ผู้รับบริการที่มีประวัติความผิดปกติของระบบสืบพันธุ์',
  'ผู้รับบริการที่มีประวัติการตั้งครรภ์ผิดปกติมาก่อน หรือเคยตรวจคัดกรองทารกด้วยวิธีอื่นมาก่อนและพบความผิดปกติ',
]

const NIPT_REJECT = [
  'สิ่งส่งตรวจที่ข้อมูลไม่ชัดเจน ไม่มีชื่อหรือใบขอตรวจ ข้อมูลบนหลอดเก็บเลือดและใบขอตรวจไม่ตรงกัน',
  'สิ่งส่งตรวจที่เม็ดเลือดแดงแตกรุนแรง (Severe hemolysis), มีไขมันในเลือดสูง, เลือดแข็งตัวในหลอดตัวอย่าง หรือมีการปนเปื้อนของเชื้อจุลชีพในสิ่งส่งตรวจ รวมถึงคนไข้ติดเชื้อในกระแสเลือด',
  'สิ่งส่งตรวจที่มีปริมาณไม่เพียงพอ หรือพบภาวะรั่วซึม หรือหกออกมานอกภาชนะเก็บสิ่งส่งตรวจ',
  'สิ่งส่งตรวจขนส่งมาในอุณหภูมิที่ไม่เหมาะสม หรือใช้ภาชนะบรรจุที่ไม่ได้รับการรับรอง ผิดประเภท หรือหมดอายุแล้ว',
  'สิ่งส่งตรวจถึงห้องปฏิบัติการเกินกว่า 7 วัน',
  'ผู้รับบริการมีความผิดปกติของ Karyotype, Chromosome aneuploidy, Sex chromosome aneuploidy (SCA), chromosomal microdeletion / microduplication syndrome และ maternal, fetal or placental mosaicism',
  'การตั้งครรภ์แฝดสามหรือมากกว่า',
  'ทารกในครรภ์แฝดอย่างน้อย 1 คน มีพัฒนาการการเจริญเติบโตที่บกพร่อง',
  'ผู้รับบริการที่เป็นหรือมีประวัติมะเร็ง, malignant tumor, benign tumor มาก่อน (ยกเว้น benign uterine fibroid)',
]

const TABS = [
  { id: 'general', th: 'การส่งตรวจทั่วไป', en: 'General Transport' },
  { id: 'nipt',    th: 'NGS: NIPT',         en: 'NGS: NIPT'        },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function NiptSection({ title, badge, badgeColor, badgeBg, items, note }: {
  title: string; badge: string; badgeColor: string; badgeBg: string; items: string[]; note?: string
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      {/* Category header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: '8px 8px 0 0',
        background: badgeBg, border: `1px solid ${badgeColor}30`,
        borderBottom: 'none',
      }}>
        <span style={{ padding: '2px 9px', borderRadius: 5, background: badgeColor, color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '.02em' }}>{badge}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: badgeColor }}>{title}</span>
      </div>
      {/* Items */}
      <div style={{ border: `1px solid ${badgeColor}25`, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        {note && (
          <div style={{ padding: '9px 14px', background: badgeBg, borderBottom: `1px solid ${badgeColor}20`, fontSize: 12.5, color: badgeColor, lineHeight: 1.6 }}>
            {note}
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '10px 14px',
            background: i % 2 === 0 ? 'var(--card)' : 'var(--bg)',
            borderBottom: i < items.length - 1 ? `1px solid ${badgeColor}15` : 'none',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 10.5, marginTop: 1,
              background: badgeBg, border: `1.5px solid ${badgeColor}40`, color: badgeColor,
            }}>{i + 1}</div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WordSourceImage({ figure, lang, className, style }: {
  figure: CollectionFigure
  lang: Lang
  className?: string
  style?: CSSProperties
}) {
  return (
    <img
      src={figure.src}
      alt={lang === 'th' ? figure.titleTh : figure.titleEn}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ display: 'block', height: 'auto', ...style }}
    />
  )
}

function IdentifierExamples({ examples, lang }: {
  examples: readonly { id: string; title: { th: string; en: string }; items: readonly { th: string; en: string }[]; figures?: readonly CollectionFigure[] }[]
  lang: Lang
}) {
  return (
    <div className="word-identifier-examples">
      {examples.map(example => {
        const figures = example.figures ?? []
        const photograph = figures.find(sourceFigure => !sourceFigure.id.includes('-check-'))
        const check = figures.find(sourceFigure => sourceFigure.id.includes('-check-'))
        const figureVariant = photograph?.id.includes('ward-request') ? ' word-identifier-figure--request' : ''
        return (
          <div key={example.id} className={`word-identifier-figure${figureVariant}`}>
            <div className="word-identifier-photo">
              {photograph && <WordSourceImage figure={photograph} lang={lang} />}
            </div>
            <div className="word-identifier-copy">
              <h5>{lang === 'th' ? example.title.th : example.title.en}</h5>
              {example.items.map((item, index) => (
                <p key={`${example.id}-${index}`}>{lang === 'th' ? item.th : item.en}</p>
              ))}
            </div>
            {check && (
              <div className="word-identifier-check">
                <WordSourceImage figure={check} lang={lang} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WordTransportSection({ lang }: { lang: Lang }) {
  const source = TRANSPORT_WORD_SECTION
  const renderText = (item: { th: string; en: string }) => lang === 'th' ? item.th : item.en
  const renderBarcodeParagraph = (item: { th: string; en: string }, index: number) => {
    const paragraphText = renderText(item)
    return index === 0 ? paragraphText.replace(/^1\.1\s*/, '') : paragraphText
  }
  const paragraphStyle = { margin: 0, fontSize: 16, color: 'var(--ink)', lineHeight: 1.7 }
  const splitUnsuitableItem = (item: { th: string; en: string }) => {
    const itemText = renderText(item)
    const separator = itemText.indexOf(' ')
    return separator > 0
      ? { marker: itemText.slice(0, separator), copy: itemText.slice(separator + 1) }
      : { marker: '', copy: itemText }
  }
  const bagText = renderText(source.bag.paragraph)
  const bagMarker = lang === 'th' ? 'ที่มีสัญลักษณ์' : 'bearing the symbol'
  const bagMarkerStart = bagText.indexOf(bagMarker)
  const bagMarkerEnd = bagMarkerStart >= 0 ? bagMarkerStart + bagMarker.length : -1

  return (
    <div className="word-source-section">
      <h3 className="word-source-heading">{renderText(source.title)}</h3>

      <section className="word-source-block">
        <h4 className="word-source-top-heading">{renderText(source.barcodeWard.title)}</h4>
        {source.barcodeWard.paragraphs.map((item, index) => (
          <p key={index} style={{ ...paragraphStyle, marginBottom: index < source.barcodeWard.paragraphs.length - 1 ? 8 : 0 }}>{renderBarcodeParagraph(item, index)}</p>
        ))}
        <IdentifierExamples examples={source.barcodeWard.examples} lang={lang} />
      </section>

      <section className="word-source-block">
        <h4 className="word-source-top-heading">{renderText(source.nonBarcodeWard.title)}</h4>
        {source.nonBarcodeWard.leading && <p className="word-source-label">{renderText(source.nonBarcodeWard.leading)}</p>}
        <IdentifierExamples examples={source.nonBarcodeWard.examples} lang={lang} />
        {source.nonBarcodeWard.trailing && <p className="word-source-label">{renderText(source.nonBarcodeWard.trailing)}</p>}
      </section>

      <section className="word-source-block word-transport-block">
        <div className="word-transport-sentence">
          <p style={paragraphStyle}>
            {bagMarkerEnd >= 0 ? (
              <>
                {bagText.slice(0, bagMarkerEnd)}
                <WordSourceImage
                  figure={TRANSPORT_WORD_FIGURES.biohazard}
                  lang={lang}
                  className="word-biohazard-image"
                  style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 8px' }}
                />
                {bagText.slice(bagMarkerEnd)}
              </>
            ) : bagText}
          </p>
        </div>
        <div className="word-transport-photo-row">
          {source.bag.figures.filter(sourceFigure => sourceFigure.id !== TRANSPORT_WORD_FIGURES.biohazard.id).map(sourceFigure => (
            <WordSourceImage key={sourceFigure.id} figure={sourceFigure} lang={lang} />
          ))}
        </div>
      </section>

      <h3 className="word-source-heading">{renderText(source.rejection.title)}</h3>
      <div className="word-rejection-list">
        {source.rejection.tables.map(table => (
          <section key={table.id} className="word-rejection-item">
            <p style={{ ...paragraphStyle, marginBottom: 10 }}>{renderText(table.intro)}</p>
            <div className="word-source-table-scroll">
              <table className="word-source-table">
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={`${table.id}-${rowIndex}`}>
                      {row.map(cell => {
                        const cellFigures = ('figures' in cell && cell.figures
                          ? cell.figures
                          : 'figure' in cell && cell.figure
                            ? [cell.figure]
                            : []) as unknown as readonly CollectionFigure[]
                        const statusFigure = cellFigures.find(sourceFigure => sourceFigure.id.includes('-rejected-mark-') || sourceFigure.id.includes('-accepted-mark-'))
                        const contentFigures = cellFigures.filter(sourceFigure => sourceFigure.id !== statusFigure?.id)
                        return (
                          <td key={cell.id} style={{ width: `${100 / row.length}%` }}>
                            <div className="word-table-media">
                              {contentFigures.map(sourceFigure => (
                                <WordSourceImage key={sourceFigure.id} figure={sourceFigure} lang={lang} className="word-table-photo" />
                              ))}
                              {statusFigure && cell.status && (
                                <div className="word-table-status">
                                  <WordSourceImage figure={statusFigure} lang={lang} />
                                  <span>{cell.status}</span>
                                </div>
                              )}
                            </div>
                            {cell.paragraphs.map((paragraph, index) => (
                              <p key={index} style={{ ...paragraphStyle, marginBottom: index < cell.paragraphs.length - 1 ? 6 : 0 }}>{renderText(paragraph)}</p>
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <section className="word-unsuitable-block" aria-labelledby="word-unsuitable-heading">
        <div className="word-unsuitable-header">
          <span className="word-unsuitable-header-icon" aria-hidden="true">
            <Icon name="alert" size={18} stroke={1.8} />
          </span>
          <h4 id="word-unsuitable-heading" className="word-unsuitable-heading">{renderText(source.rejection.unsuitable.title)}</h4>
        </div>
        <ol className="word-unsuitable-list">
          {source.rejection.unsuitable.items.map((item, index) => {
            const itemParts = splitUnsuitableItem(item)
            return (
              <li key={index} className="word-unsuitable-item">
                {itemParts.marker && <span className="word-unsuitable-number">{itemParts.marker}</span>}
                <p style={{ ...paragraphStyle, margin: 0 }}>{itemParts.copy}</p>
              </li>
            )
          })}
        </ol>
      </section>

      <p className="word-source-note" role="note">{renderText(source.rejection.note)}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ManualTransport({ lang }: Props) {
  const [tab, setTab] = useState('general')

  return (
    <Section>
      <H2 eyebrow="03 · Transport & Rejection">
        {lang === 'th' ? 'การส่งตัวอย่างส่งตรวจ' : 'Specimen Transport'}
      </H2>
      <style>{`
        .manual-storage-cards { display: none; }
        .word-source-section { color: var(--ink); }
        .word-source-heading {
          margin: 0 0 22px; padding: 7px 10px; background: #e9e2ed; color: #111827;
          font-size: 20px; font-weight: 800; line-height: 1.45;
        }
        .word-source-block { margin: 0 0 28px; }
        .word-source-top-heading {
          margin: 0 0 9px; color: var(--ink); font-size: 17px; font-weight: 400; line-height: 1.55;
        }
        .word-identifier-examples { margin: 22px 0 30px; }
        .word-identifier-figure {
          display: grid; grid-template-columns: minmax(180px, .9fr) minmax(275px, 1.35fr) 58px;
          align-items: center; gap: 22px; max-width: 790px; margin: 0 auto;
        }
        .word-identifier-figure--request {
          max-width: 900px; grid-template-columns: minmax(340px, 1.3fr) minmax(270px, .95fr) 58px;
        }
        .word-identifier-photo { display: flex; justify-content: center; min-width: 0; }
        .word-identifier-photo img { width: 100%; max-width: 330px; }
        .word-identifier-figure--request .word-identifier-photo img { max-width: 520px; }
        .word-identifier-copy { min-width: 0; }
        .word-identifier-copy h5 {
          margin: 0 0 5px; color: var(--ink); font-size: 18px; font-weight: 700; line-height: 1.5;
        }
        .word-identifier-copy p { margin: 2px 0; color: var(--ink); font-size: 16px; line-height: 1.65; }
        .word-identifier-check { display: flex; justify-content: center; }
        .word-identifier-check img { width: 48px; }
        .word-source-label {
          display: inline-block; margin: 12px 0 0; padding: 5px 11px; border: 2px solid #ed6c00;
          color: var(--ink); background: var(--card); font-size: 16px; line-height: 1.55;
        }
        .word-transport-sentence { margin: 0; }
        .word-biohazard-image { display: inline-block; width: 47px; vertical-align: middle; margin: 0 8px; }
        .word-transport-photo-row {
          display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(120px, .8fr);
          align-items: center; gap: 18px; margin: 22px 0 0;
        }
        .word-transport-photo-row img { width: 100%; max-height: 220px; object-fit: contain; }
        .word-rejection-list { display: flex; flex-direction: column; gap: 20px; }
        .word-rejection-item { margin: 0; }
        .word-source-table-scroll { overflow-x: auto; }
        .word-source-table {
          width: 100%; min-width: 680px; border-collapse: collapse; table-layout: fixed;
          color: var(--ink); background: var(--card);
        }
        .word-source-table td {
          padding: 12px 16px; vertical-align: top; border: 1px solid #111; background: var(--card);
        }
        .word-table-media {
          display: flex; align-items: center; justify-content: center; gap: 22px;
          min-height: 140px; margin-bottom: 12px;
        }
        .word-table-photo { width: auto; max-width: 58%; max-height: 220px; object-fit: contain; }
        .word-table-status { display: flex; align-items: center; gap: 8px; color: #111; font-size: 18px; line-height: 1.35; white-space: nowrap; }
        .word-table-status img { width: 48px; max-width: none; }
        .word-unsuitable-block { margin: 20px 0 0; }
        .word-unsuitable-header {
          display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
          border: 1px solid rgba(217,119,6,.28); border-bottom: 0; border-radius: 12px 12px 0 0;
          background: rgba(217,119,6,.08);
        }
        .word-unsuitable-header-icon {
          display: inline-flex; flex: 0 0 34px; width: 34px; height: 34px;
          align-items: center; justify-content: center; border: 1px solid rgba(217,119,6,.3);
          border-radius: 9px; color: #B45309; background: rgba(217,119,6,.16);
        }
        .word-unsuitable-heading { margin: 0; color: var(--ink); font-size: 18px; font-weight: 800; line-height: 1.5; }
        .word-unsuitable-list {
          display: flex; flex-direction: column; gap: 0; margin: 0; padding: 6px 0;
          list-style: none; border: 1px solid rgba(217,119,6,.28); border-radius: 0 0 12px 12px;
          background: var(--card);
        }
        .word-unsuitable-item {
          display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 14px;
          align-items: start; min-width: 0; padding: 14px 18px;
        }
        .word-unsuitable-item:nth-child(even) { background: var(--surface-2); }
        .word-unsuitable-number {
          display: inline-flex; width: 42px; min-height: 30px;
          align-items: center; justify-content: center; box-sizing: border-box;
          border: 1px solid rgba(217,119,6,.35); border-radius: 8px;
          color: #B45309; background: var(--card); font-size: 13px; font-weight: 800;
          line-height: 1; font-variant-numeric: tabular-nums;
        }
        .word-unsuitable-item p { min-width: 0; }
        .word-urgent-copy { min-width: 0; margin: 0; color: var(--ink); font-size: 16px; font-weight: 400; line-height: 1.7; }
        .word-source-note {
          margin: 12px 0 0; padding: 10px 14px; border-top: 1px solid var(--border);
          color: var(--ink); background: var(--surface-2); font-size: 16px; line-height: 1.7;
        }
        .manual-catalog-link {
          min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          padding: 8px 13px; border: 1px solid var(--primary); border-radius: 8px;
          background: var(--primary); color: #fff; text-decoration: none;
          font-size: 12.5px; font-weight: 700; transition: background .15s, box-shadow .15s;
        }
        .manual-catalog-link:hover, .manual-catalog-link:focus-visible {
          background: var(--primary-hover, var(--primary)); box-shadow: 0 0 0 3px var(--primary-soft); outline: none;
        }
        @media (max-width: 640px) {
          .word-source-heading { font-size: 18px; }
          .word-source-top-heading { font-size: 16px; }
          .word-identifier-figure, .word-identifier-figure--request { grid-template-columns: minmax(0, 1fr); gap: 10px; max-width: none; }
          .word-identifier-photo { justify-content: flex-start; }
          .word-identifier-photo img { max-width: 330px; }
          .word-identifier-copy h5 { font-size: 17px; }
          .word-identifier-copy p, .word-source-label, .word-source-note { font-size: 15px; }
          .word-identifier-check { justify-content: flex-start; }
          .word-transport-sentence { align-items: flex-start; }
          .word-transport-photo-row { grid-template-columns: 1fr; gap: 12px; }
          .word-transport-photo-row img { max-height: none; }
          .word-source-table { min-width: 620px; }
          .word-source-table td { padding: 10px 12px; }
          .word-unsuitable-header { gap: 10px; padding: 12px; }
          .word-unsuitable-header-icon { flex-basis: 32px; width: 32px; height: 32px; }
          .word-unsuitable-heading { font-size: 17px; }
          .word-unsuitable-item { grid-template-columns: 48px minmax(0, 1fr); gap: 10px; padding: 12px; }
          .word-unsuitable-number { width: 38px; min-height: 28px; font-size: 12px; }
          .manual-storage-table-wrap { display: none; }
          .manual-storage-cards { display: grid; gap: 8px; margin-bottom: 10px; }
          .manual-storage-card { padding: 12px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); }
          .manual-storage-card h4 { margin: 0 0 9px; color: var(--ink); font-size: 13px; line-height: 1.45; }
          .manual-storage-card dl { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 7px 9px; margin: 0; }
          .manual-storage-card dt { color: var(--muted); font-size: 11px; font-weight: 700; }
          .manual-storage-card dd { margin: 0; color: var(--ink); font-size: 12px; line-height: 1.6; }
          .manual-catalog-link { width: 100%; min-height: 44px; box-sizing: border-box; }
        }
      `}</style>

      {/* ── Pill tab switcher ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 6, marginBottom: 22, padding: '4px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
        {TABS.map(t => {
          const active = t.id === tab
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '7px 18px', borderRadius: 7, border: 'none',
                background: active ? 'var(--card)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 500, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                transition: 'all .15s', lineHeight: 1.25,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--muted)' }}
            >
              {lang === 'th' ? t.th : t.en}
            </button>
          )
        })}
      </div>

      {/* ════════════════════════ GENERAL TAB ════════════════════════════ */}
      {tab === 'general' && (
        <>
          <WordTransportSection lang={lang} />
          {false && (
            <>
          {/* Biohazard notice */}
          <div style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'rgba(22,163,74,.05)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 9, marginBottom: 20 }}>
            <Icon name="biohazard" size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
              {lang === 'th'
                ? 'สิ่งตัวอย่างส่งตรวจทุกชนิดต้องบรรจุในถุง biohazard ปิดสนิท ใบส่งตรวจอยู่ในช่องด้านนอกของถุง ไม่ปะปนกับตัวอย่าง และจัดส่งห้องปฏิบัติการโดยเร็วที่สุดในสภาวะที่เหมาะสม'
                : 'All specimens are sealed in biohazard bags; request forms travel in the outer pocket. Deliver to the lab as quickly as possible under the appropriate temperature condition.'}
            </p>
          </div>

          <H3 mt={0}>{lang === 'th' ? 'ข้อแนะนำในการเก็บและวิธีการนำส่งสิ่งตัวอย่างส่งตรวจ' : 'Specimen Collection and Transport Guidance'}</H3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
            {TRANSPORT_GUIDANCE.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 13px', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 9, background: index % 2 === 0 ? 'var(--card)' : 'var(--bg)' }}>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800 }}>{index + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>{lang === 'th' ? item.th : item.en}</span>
              </div>
            ))}
          </div>

          {/* Specimen storage overview */}
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            {lang === 'th' ? 'วิธีการเก็บรักษาตัวอย่างส่งตรวจก่อนนำส่งห้องปฏิบัติการ' : 'Specimen Storage Before Laboratory Transport'}
          </h3>
          <div className="manual-storage-table-wrap" style={{ overflowX: 'auto', marginBottom: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--ink)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  <th scope="col" style={{ width: '24%', padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{lang === 'th' ? 'สิ่งตัวอย่างส่งตรวจ' : 'Specimen'}</th>
                  <th scope="col" style={{ width: '46%', padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{lang === 'th' ? 'วิธีการเก็บรักษา' : 'Storage method'}</th>
                  <th scope="col" style={{ width: '30%', padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{lang === 'th' ? 'การนำส่ง' : 'Transport'}</th>
                </tr>
              </thead>
              <tbody>
                {SPECIMEN_STORAGE_OVERVIEW.map((row, index) => (
                  <tr key={row.specimenEn} style={{ background: index % 2 === 0 ? 'var(--card)' : 'var(--bg)' }}>
                    <th scope="row" style={{ padding: '11px 14px', verticalAlign: 'top', textAlign: 'left', fontWeight: 700, lineHeight: 1.6, borderBottom: index < SPECIMEN_STORAGE_OVERVIEW.length - 1 ? '1px solid var(--border)' : 'none' }}>{lang === 'th' ? row.specimenTh : row.specimenEn}</th>
                    <td style={{ padding: '11px 14px', verticalAlign: 'top', color: 'var(--muted)', lineHeight: 1.6, borderBottom: index < SPECIMEN_STORAGE_OVERVIEW.length - 1 ? '1px solid var(--border)' : 'none' }}>{lang === 'th' ? row.storageTh : row.storageEn}</td>
                    <td style={{ padding: '11px 14px', verticalAlign: 'top', color: 'var(--muted)', lineHeight: 1.6, borderBottom: index < SPECIMEN_STORAGE_OVERVIEW.length - 1 ? '1px solid var(--border)' : 'none' }}>{lang === 'th' ? row.transportTh : row.transportEn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="manual-storage-cards">
            {SPECIMEN_STORAGE_OVERVIEW.map(row => (
              <article key={row.specimenEn} className="manual-storage-card">
                <h4>{lang === 'th' ? row.specimenTh : row.specimenEn}</h4>
                <dl>
                  <dt>{lang === 'th' ? 'การเก็บรักษา' : 'Storage'}</dt>
                  <dd>{lang === 'th' ? row.storageTh : row.storageEn}</dd>
                  <dt>{lang === 'th' ? 'การนำส่ง' : 'Transport'}</dt>
                  <dd>{lang === 'th' ? row.transportTh : row.transportEn}</dd>
                </dl>
              </article>
            ))}
          </div>
          <div style={{ marginBottom: 22 }}>
            <Callout tone="info">
              {lang === 'th'
                ? <><strong>หมายเหตุ:</strong> ตารางนี้จัดทำขึ้นเพื่อแสดงแนวทางการเก็บรักษาตัวอย่างส่งตรวจในภาพรวมเท่านั้น ก่อนดำเนินการเก็บหรือขนส่ง โปรดตรวจสอบข้อกำหนดเฉพาะของรายการตรวจนั้นจากหน้ารายละเอียดรายการตรวจในระบบอีกครั้ง</>
                : <><strong>Note:</strong> This table is an overview only. Before collection or transport, verify the requirements for the individual test on its test-detail page.</>}
            </Callout>
            <Link href="/catalog" className="manual-catalog-link">
              <Icon name="search" size={14} style={{ color: '#fff' }} />
              {lang === 'th' ? 'ค้นหาข้อกำหนดเฉพาะรายรายการตรวจ' : 'Find test-specific requirements'}
              <Icon name="arrowRight" size={14} style={{ color: '#fff' }} />
            </Link>
          </div>

          {/* Rejection criteria */}
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            {lang === 'th' ? 'เกณฑ์การรับ–ปฏิเสธสิ่งตัวอย่างส่งตรวจ' : 'Specimen Acceptance and Rejection Criteria'}
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
            {lang === 'th'
              ? 'สิ่งตัวอย่างส่งตรวจจะไม่ได้รับการตรวจวิเคราะห์เมื่อไม่เป็นไปตามเกณฑ์ข้อใดข้อหนึ่งต่อไปนี้'
              : 'A specimen will not be accepted for analysis when it fails any of the following criteria.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 10, marginBottom: 22 }}>
            {REJECTION_GROUPS.map((group, groupIndex) => (
              <section key={group.en} aria-labelledby={`rejection-group-${groupIndex}`} style={{ overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,.06)', borderBottom: '1px solid rgba(220,38,38,.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 800 }}>{groupIndex + 1}</span>
                    <h4 id={`rejection-group-${groupIndex}`} style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.35 }}>{lang === 'th' ? group.th : group.en}</h4>
                  </div>
                  <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{lang === 'th' ? group.descriptionTh : group.descriptionEn}</p>
                </div>
                <div>
                  {group.rules.map((rule, ruleIndex) => {
                    const number = REJECTION_RULES.indexOf(rule) + 1
                    const isLast = ruleIndex === group.rules.length - 1
                    return (
                      <article key={rule.en} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <span aria-hidden="true" style={{ width: 21, height: 21, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, background: 'var(--surface-2)', color: 'var(--danger)', fontSize: 11, fontWeight: 800 }}>{number}</span>
                        <div style={{ minWidth: 0 }}>
                          <h5 style={{ margin: 0, fontSize: 12.5, color: 'var(--ink)', fontWeight: 700, lineHeight: 1.55 }}>{lang === 'th' ? rule.th : rule.en}</h5>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{lang === 'th' ? rule.bodyTh : rule.bodyEn}</p>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

            </>
          )}

          {/* STAT workflow */}
          <section className="word-unsuitable-block word-urgent-block" aria-labelledby="word-urgent-heading">
            <div className="word-unsuitable-header">
              <span className="word-unsuitable-header-icon" aria-hidden="true">
                <Icon name="clock" size={18} stroke={1.8} />
              </span>
              <h3 id="word-urgent-heading" className="word-unsuitable-heading">
                {lang === 'th' ? 'แนวทางการรับสิ่งตัวอย่างส่งตรวจกรณีเร่งด่วน' : 'Guidance for receiving urgent specimens'}
              </h3>
            </div>
            <ol className="word-unsuitable-list">
              {STAT_STEPS.map((s, i) => (
                <li key={i} className="word-unsuitable-item">
                  <span className="word-unsuitable-number">{i + 1}</span>
                  <p className="word-urgent-copy">
                    {lang === 'th' ? s.th : s.en}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {/* ════════════════════════ NIPT TAB ═══════════════════════════════ */}
      {tab === 'nipt' && (
        <>
          {/* NIPT intro banner */}
          <div style={{ padding: '13px 16px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>
              หลักเกณฑ์ในการรับหรือปฏิเสธสิ่งส่งตรวจ
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
              สำหรับการตรวจคัดกรองกลุ่มอาการดาวน์ ด้วยวิธี <strong>Next Generation Sequencing: Non-Invasive Prenatal Testing (NGS: NIPT)</strong>
            </div>
          </div>

          {/* Tube & transport requirements */}
          <NiptSection
            title="ข้อกำหนดหลอดเก็บเลือดและการขนส่ง"
            badge="📋 ข้อกำหนด"
            badgeColor="#0891B2"
            badgeBg="rgba(8,145,178,.08)"
            items={NIPT_TUBE_RULES}
          />

          <NiptSection
            title="กรณีที่ผู้รับบริการต้องลงนามยืนยันการขอตรวจ"
            badge="🖊 ลงนาม"
            badgeColor="#D97706"
            badgeBg="rgba(217,119,6,.08)"
            items={NIPT_REQUIRE_SIGNATURE}
            note="ทางห้องปฏิบัติการจะไม่ดำเนินการทดสอบจนกว่าจะได้รับเอกสารดังกล่าว"
          />

          <NiptSection
            title="สามารถรับสิ่งส่งตรวจได้ แต่ต้องตรวจสอบเงื่อนไขก่อนเจาะเลือดตรวจ NIPT"
            badge="✅ ตรวจสอบก่อน"
            badgeColor="var(--primary)"
            badgeBg="var(--primary-soft)"
            items={NIPT_ACCEPT_WITH_CONDITION}
          />

          <NiptSection
            title="สามารถรับสิ่งส่งตรวจได้ แต่ต้องสืบค้นหรือขอประวัติเพิ่ม"
            badge="🔍 สืบค้นประวัติ"
            badgeColor="#065F46"
            badgeBg="rgba(22,163,74,.08)"
            items={NIPT_REQUIRE_HISTORY}
            note="คัดเลือกผู้รับบริการที่มีภูมิหลังเกี่ยวกับ chromosomal abnormality น้อยที่สุด หากพิจารณาแล้วเห็นว่ามีความเสี่ยงที่จะกระทบต่อผลตรวจ ให้ปฏิเสธสิ่งส่งตรวจ"
          />

          <NiptSection
            title="เงื่อนไขที่ต้องปฏิเสธสิ่งส่งตรวจ"
            badge="❌ ปฏิเสธ"
            badgeColor="var(--danger)"
            badgeBg="rgba(220,38,38,.07)"
            items={NIPT_REJECT}
          />

          <Callout tone="warning" icon="alert">
            หากพบเงื่อนไขที่ไม่แน่ใจ ให้ติดต่อคลินิกหรือโรงพยาบาลที่ส่งตรวจก่อนดำเนินการ
          </Callout>
        </>
      )}
    </Section>
  )
}
