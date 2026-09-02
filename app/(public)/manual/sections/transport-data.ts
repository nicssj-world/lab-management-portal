import type { CollectionFigure } from './collection-data'

export interface TransportText {
  th: string
  en: string
}

export interface TransportIdentifierExample {
  id: string
  title: TransportText
  items: TransportText[]
  figures?: CollectionFigure[]
}

export interface TransportWordCase {
  id: string
  paragraphs: TransportText[]
  status?: 'Rejected' | 'Accept'
  figure?: CollectionFigure
}

export interface TransportWordTableCell {
  id: string
  paragraphs: TransportText[]
  status?: 'Rejected' | 'Accept'
  figure?: CollectionFigure
  figures?: CollectionFigure[]
}

export interface TransportWordTableSection {
  id: string
  intro: TransportText
  rows: TransportWordTableCell[][]
}

const text = (th: string, en: string = th): TransportText => ({ th, en })

const figure = (
  id: string,
  file: string,
  titleTh: string,
  titleEn: string,
  captionTh: string,
  captionEn: string,
  ratio?: string,
): CollectionFigure => ({
  id,
  src: `/images/manual/collection/source/${file}`,
  titleTh,
  titleEn,
  captionTh,
  captionEn,
  ratio,
})

export const TRANSPORT_WORD_FIGURES = {
  biohazard: figure(
    'transport-biohazard',
    'image46.png',
    'สัญลักษณ์ Biohazard',
    'Biohazard symbol',
    'ภาพประกอบจากหัวข้อข้อแนะนำในการเก็บและวิธีการนำส่งสิ่งตัวอย่างส่งตรวจ',
    'Illustration from the specimen collection and transport guidance section.',
  ),
  barcodeCheckOne: figure('transport-barcode-check-one', 'image52.png', '✓', '✓', '', ''),
  barcodeCheckTwo: figure('transport-barcode-check-two', 'image520.png', '✓', '✓', '', ''),
  barcodeTube: figure('transport-barcode-tube', 'image53-word.png', 'การติดสติ๊กเกอร์ barcode LAB ID', 'LAB ID barcode sticker on a tube', '', ''),
  wardCheckOne: figure('transport-ward-check-one', 'image54.png', '✓', '✓', '', ''),
  wardCheckTwo: figure('transport-ward-check-two', 'image540.png', '✓', '✓', '', ''),
  wardRequest: figure('transport-ward-request', 'image55-word.png', 'ใบส่งตรวจและภาชนะบรรจุสิ่งตัวอย่าง', 'Request form and specimen container', '', ''),
  bagPhotoOne: figure('transport-bag-photo-one', 'image56-word.png', 'ตัวอย่างส่งตรวจในซองบรรจุ', 'Specimen in a transport bag', '', ''),
  bagPhotoTwo: figure('transport-bag-photo-two', 'image57.png', 'ตัวอย่างส่งตรวจในซองบรรจุ', 'Specimen in a transport bag', '', ''),
  rejectedMarkOne: figure('transport-rejected-mark-one', 'image58.png', 'Rejected', 'Rejected', '', ''),
  rejectedMarkTwo: figure('transport-rejected-mark-two', 'image580.png', 'Rejected', 'Rejected', '', ''),
  acceptedMarkOne: figure('transport-accepted-mark-one', 'image60.png', 'Accept', 'Accept', '', ''),
  acceptedMarkTwo: figure('transport-accepted-mark-two', 'image600.png', 'Accept', 'Accept', '', ''),
  acceptedLabelPhoto: figure('transport-accepted-label-photo', 'image61.png', 'Accept', 'Accept', '', ''),
  mismatchPhoto: figure('transport-mismatch-photo', 'image62.png', 'ตัวอย่างชื่อ/HN ไม่ตรงกัน', 'Mismatched name/HN example', '', ''),
  clottedTube: figure('transport-clotted-tube', 'image65.png', 'Clotted Blood Tube', 'Clotted Blood Tube', '', ''),
  lithiumTube: figure('transport-lithium-tube', 'image66.png', 'Lithium heparin Tube', 'Lithium heparin Tube', '', ''),
  noLabel: figure(
    'transport-no-label',
    'image59-word.png',
    'Rejected',
    'Rejected',
    'ตัวอย่างสิ่งส่งตรวจที่ไม่มีฉลาก (ภาพประกอบจากคู่มือ)',
    'Unlabelled specimen example (illustration from the manual).',
    '4 / 5',
  ),
  lowVolume: figure(
    'transport-low-volume',
    'image63-word.png',
    'Rejected',
    'Rejected',
    'ปริมาตรต่ำกว่าเกณฑ์ที่กำหนด',
    'Volume below the required criterion.',
    '3 / 4',
  ),
  correctVolume: figure(
    'transport-correct-volume',
    'image64.png',
    'Accept',
    'Accept',
    'ใส่เลือดให้ได้ปริมาตรตามข้าง tube',
    'Fill the blood to the volume marked on the tube.',
    '3 / 4',
  ),
  wrongUrineContainer: figure(
    'transport-wrong-urine-container',
    'image67.png',
    'Rejected',
    'Rejected',
    'ใช้กระป๋องเก็บปัสสาวะ (ฝาเหลือง) ในการเก็บตัวอย่างส่งตรวจ ส่งตรวจ Urine Culture',
    'A yellow-cap urine cup used for a Urine Culture specimen.',
  ),
  correctUrineContainer: figure(
    'transport-correct-urine-container',
    'image68.png',
    'Accept',
    'Accept',
    'ใช้กระป๋องเก็บปัสสาวะ Sterile (ฝาแดง) ในการเก็บตัวอย่างส่งตรวจ ส่งตรวจ Urine Culture',
    'A sterile red-cap urine cup used for a Urine Culture specimen.',
  ),
} as const

export const TRANSPORT_WORD_SECTION = {
  title: text('ข้อแนะนำในการเก็บและวิธีการนำส่งสิ่งตัวอย่างส่งตรวจ', 'Specimen collection and transport guidance'),
  barcodeWard: {
    title: text('1. หอผู้ป่วยที่ใช้เครื่อง print barcode LAB ID ให้ปฏิบัติดังนี้', '1. Wards using a LAB ID barcode printer shall follow these instructions.'),
    paragraphs: [
      text(
        '1.1 แปะสติ๊กเกอร์ barcode LAB ID ตามแนวนอนของหลอดเก็บตัวอย่างหรือภาชนะบรรจุ โดยให้ตัวเลข LAB ID อยู่ทางด้านบนของหลอดหรือภาชนะบรรจุ และไม่ควรแปะสติ๊กเกอร์ทับขีดบอกปริมาตรข้างหลอด',
        '1.1 Place the LAB ID barcode sticker horizontally on the specimen tube or container, with the LAB ID numbers at the top of the tube or container. Do not place the sticker over the volume markings on the tube.',
      ),
    ],
    examples: [
      {
        id: 'barcode-example-one',
        title: text('การชี้บ่งสิ่งตัวอย่างส่งตรวจ', 'Specimen identification'),
        items: [
          text('1. ตัวชี้บ่งที่1 คือ ชื่อ-สกุลของผู้ป่วย', '1. Identifier 1 is the patient name and surname.'),
          text('2. ตัวชี้บ่งที่2 คือ วันเดือนปีเกิดผู้ป่วย หรือ HN.', '2. Identifier 2 is the patient date of birth or HN.'),
          text('หรือ Lab ID', 'Or Lab ID.'),
        ],
        figures: [
          TRANSPORT_WORD_FIGURES.barcodeTube,
          TRANSPORT_WORD_FIGURES.barcodeCheckOne,
        ],
      },
    ] satisfies TransportIdentifierExample[],
  },
  nonBarcodeWard: {
    title: text('2. หอผู้ป่วยที่ไม่มีเครื่อง print barcode LAB ID จะใช้สติ๊กเกอร์ของหอผู้ป่วยติดหลอดเก็บตัวอย่างหรือภาชนะบรรจุและต้องมีใบส่งตรวจทางห้องปฏิบัติการ ดังนี้', '2. Wards without a LAB ID barcode printer use the ward sticker on the specimen tube or container and must send the laboratory request form as follows.'),
    leading: text('ตัวชี้บ่งที่1 คือ ชื่อ-สกุลของผู้ป่วย', 'Identifier 1 is the patient name and surname.'),
    trailing: text('ตัวชี้บ่งที่ 2 คือ วันเดือนปีเกิดผู้ป่วย หรือ HN. หรือ Lab ID', 'Identifier 2 is the patient date of birth or HN. or Lab ID.'),
    examples: [
      {
        id: 'ward-sticker-example-one',
        title: text('การชี้บ่งสิ่งตัวอย่างส่งตรวจ', 'Specimen identification'),
        items: [
          text('1. ตัวชี้บ่งที่1 คือ ชื่อ-สกุลของผู้ป่วย', '1. Identifier 1 is the patient name and surname.'),
          text('2. ตัวชี้บ่งที่2 คือ วันเดือนปีเกิดผู้ป่วย หรือ HN.', '2. Identifier 2 is the patient date of birth or HN.'),
          text('หรือ Lab ID', 'Or Lab ID.'),
        ],
        figures: [
          TRANSPORT_WORD_FIGURES.wardRequest,
          TRANSPORT_WORD_FIGURES.wardCheckOne,
        ],
      },
    ] satisfies TransportIdentifierExample[],
  },
  bag: {
    paragraph: text(
      '3. ตัวอย่างส่งตรวจ นำใส่ซองบรรจุที่มีสัญลักษณ์ และควรนำส่งห้องปฏิบัติการทันที หรือเก็บไว้ตามคำแนะนำของการทดสอบแต่ละ Test',
      '3. Place the specimen in a package bearing the symbol and deliver it to the laboratory immediately, or store it according to the instructions for each Test.',
    ),
    figures: [
      TRANSPORT_WORD_FIGURES.biohazard,
      TRANSPORT_WORD_FIGURES.bagPhotoOne,
      TRANSPORT_WORD_FIGURES.bagPhotoTwo,
    ],
  },
  rejection: {
    title: text('เกณฑ์การปฏิเสธสิ่งตัวอย่างส่งตรวจทางห้องปฏิบัติการ', 'Criteria for rejecting laboratory specimens'),
    cases: [
      {
        id: 'no-label',
        paragraphs: [
          text('สิ่งส่งตรวจที่ไม่มีฉลาก (Label) หรือมีรายละเอียดของตัวอย่างไม่ชัดเจน ไม่ครบตามข้อกำหนดในคู่มือการส่งตรวจของแต่ละรายการทดสอบ', 'A specimen without a label, or with specimen details that are unclear or incomplete according to the requirements in the test manual.'),
          text(': เนื่องจากไม่ติดสติ๊กเกอร์ในการ identified ตัวอย่างผู้ป่วย', ': Because no sticker was attached to identify the patient specimen.'),
        ],
        status: 'Rejected' as const,
        figure: TRANSPORT_WORD_FIGURES.noLabel,
      },
      {
        id: 'two-identifiers',
        paragraphs: [
          text(': ฉลากที่ติดข้างขวดตัวอย่างต้องidentified ตัวอย่างได้ อย่างน้อย 2 marker ได้แก่', ': The label attached to the specimen container must identify the specimen with at least 2 markers:'),
          text('1. ชื่อ-สกุลผู้ป่วย', '1. Patient name and surname.'),
          text('2. วันเดือนปีเกิด หรือ HN. หรือ LAB ID', '2. Date of birth, HN., or LAB ID.'),
        ],
        status: 'Accept' as const,
      },
      {
        id: 'mismatch',
        paragraphs: [
          text('ชื่อ-สกุลผู้ป่วย และวันเดือนปีเกิดหรือ HN. หรือ LAB ID ของใบนำส่งตรวจกับภาชนะบรรจุสิ่งตัวอย่างส่งตรวจไม่ตรงกัน', 'The patient name and date of birth, HN., or LAB ID on the test request form do not match the specimen container.'),
        ],
        status: 'Rejected' as const,
      },
      {
        id: 'low-volume',
        paragraphs: [
          text('ปริมาตรของสิ่งตัวอย่างส่งตรวจไม่ได้ตามเกณฑ์ที่กำหนดเช่น การส่งตรวจ PT, PTT หรือ ESR ต้องใส่เลือดให้ได้ปริมาตรตามข้าง tube เป็นต้น', 'The specimen volume does not meet the defined criterion; for example, PT, PTT, or ESR specimens must have blood filled to the volume shown on the tube.'),
        ],
        status: 'Rejected' as const,
        figure: TRANSPORT_WORD_FIGURES.lowVolume,
      },
      {
        id: 'correct-volume',
        paragraphs: [
          text('ใส่เลือดให้ได้ปริมาตรตามข้าง tube', 'Fill the blood to the volume shown on the tube.'),
        ],
        status: 'Accept' as const,
        figure: TRANSPORT_WORD_FIGURES.correctVolume,
      },
      {
        id: 'wrong-container',
        paragraphs: [
          text('ใช้ภาชนะใส่สิ่งตัวอย่างส่งตรวจไม่ถูกต้อง', 'The wrong container was used for the specimen.'),
          text('ใช้ Clotted Blood Tube (จุกสีแดง)เก็บตัวอย่างส่งตรวจ Electrolyte', 'A Clotted Blood Tube (red cap) was used to collect a specimen for Electrolyte testing.'),
        ],
        status: 'Rejected' as const,
      },
      {
        id: 'correct-container',
        paragraphs: [
          text('ใช้ Lithium heparin Tube (จุกสีเขียว) เก็บตัวอย่างส่งตรวจ Electrolyte', 'A Lithium heparin Tube (green cap) was used to collect a specimen for Electrolyte testing.'),
        ],
        status: 'Accept' as const,
      },
      {
        id: 'wrong-urine-container',
        paragraphs: [
          text('ใช้กระป๋องเก็บปัสสาวะ (ฝาเหลือง) ในการเก็บตัวอย่างส่งตรวจ ส่งตรวจ Urine Culture', 'A yellow-cap urine cup was used to collect a specimen for Urine Culture.'),
        ],
        status: 'Rejected' as const,
        figure: TRANSPORT_WORD_FIGURES.wrongUrineContainer,
      },
      {
        id: 'correct-urine-container',
        paragraphs: [
          text('ใช้กระป๋องเก็บปัสสาวะ Sterile (ฝาแดง) ในการเก็บตัวอย่างส่งตรวจ ส่งตรวจ Urine Culture', 'A sterile red-cap urine cup was used to collect a specimen for Urine Culture.'),
        ],
        status: 'Accept' as const,
        figure: TRANSPORT_WORD_FIGURES.correctUrineContainer,
      },
    ] satisfies TransportWordCase[],
    tables: [
      {
        id: 'identification-table',
        intro: text('1. สิ่งส่งตรวจที่ไม่มีฉลาก (Label) หรือ มีรายละเอียดของตัวอย่างไม่ชัดเจน ไม่ครบตามข้อกำหนดในคู่มือการส่งตรวจของแต่ละรายการทดสอบ', '1. A specimen without a label, or with specimen details that are unclear or incomplete according to the requirements in the test manual.'),
        rows: [[
          {
            id: 'identification-rejected',
            paragraphs: [text(': เนื่องจากไม่ติดสติ๊กเกอร์ในการ identified ตัวอย่างผู้ป่วย', ': Because no sticker was attached to identify the patient specimen.')],
            status: 'Rejected',
            figures: [TRANSPORT_WORD_FIGURES.noLabel, TRANSPORT_WORD_FIGURES.rejectedMarkOne],
          },
          {
            id: 'identification-accepted',
            paragraphs: [
              text(': ฉลากที่ติดข้างขวดตัวอย่างต้อง identified ตัวอย่างได้ อย่างน้อย 2 marker ได้แก่', ': The label attached to the specimen container must identify the specimen with at least 2 markers:'),
              text('1. ชื่อ-สกุลผู้ป่วย', '1. Patient name and surname.'),
              text('2. วันเดือนปีเกิด หรือ HN. หรือ LAB ID', '2. Date of birth, HN., or LAB ID.'),
            ],
            status: 'Accept',
            figures: [TRANSPORT_WORD_FIGURES.acceptedLabelPhoto, TRANSPORT_WORD_FIGURES.acceptedMarkOne],
          },
        ]],
      },
      {
        id: 'mismatch-table',
        intro: text('2. ชื่อ-สกุลผู้ป่วย และวันเดือนปีเกิดหรือ HN. หรือ LAB ID ของใบนำส่งตรวจกับภาชนะบรรจุสิ่งตัวอย่างส่งตรวจไม่ตรงกัน', '2. The patient name and date of birth, HN., or LAB ID on the test request form do not match the specimen container.'),
        rows: [[
          {
            id: 'mismatch-rejected',
            paragraphs: [text(': ชื่อ-สกุล, HN ผู้ป่วย ในใบนำส่งตรวจกับหลอดเก็บตัวอย่างไม่ตรงกัน', ': The patient name and HN. on the test request form do not match the specimen tube.')],
            status: 'Rejected',
            figures: [TRANSPORT_WORD_FIGURES.mismatchPhoto, TRANSPORT_WORD_FIGURES.rejectedMarkOne],
          },
        ]],
      },
      {
        id: 'volume-table',
        intro: text('3. ปริมาตรของสิ่งตัวอย่างส่งตรวจไม่ได้ตามเกณฑ์ที่กำหนด เช่น การส่งตรวจ PT, PTT หรือ ESR ต้องใส่เลือดให้ได้ปริมาตรตามข้าง tube เป็นต้น', '3. The specimen volume does not meet the defined criterion; for example, PT, PTT, or ESR specimens must have blood filled to the volume shown on the tube.'),
        rows: [[
          {
            id: 'volume-rejected',
            paragraphs: [text('ปริมาตรต่ำกว่าเกณฑ์ที่กำหนด', 'Volume below the required criterion.')],
            status: 'Rejected',
            figures: [TRANSPORT_WORD_FIGURES.lowVolume, TRANSPORT_WORD_FIGURES.rejectedMarkOne],
          },
          {
            id: 'volume-accepted',
            paragraphs: [text('ใส่เลือดให้ได้ปริมาตรตามข้าง tube', 'Fill the blood to the volume shown on the tube.')],
            status: 'Accept',
            figures: [TRANSPORT_WORD_FIGURES.correctVolume, TRANSPORT_WORD_FIGURES.acceptedMarkOne],
          },
        ]],
      },
      {
        id: 'container-table',
        intro: text('4. ใช้ภาชนะใส่สิ่งตัวอย่างส่งตรวจไม่ถูกต้อง', '4. The wrong container was used for the specimen.'),
        rows: [
          [
            {
              id: 'clotted-electrolyte-rejected',
              paragraphs: [text('ใช้ Clotted Blood Tube (จุกสีแดง) เก็บตัวอย่างส่งตรวจ Electrolyte', 'A Clotted Blood Tube (red cap) was used to collect a specimen for Electrolyte testing.')],
              status: 'Rejected',
              figures: [TRANSPORT_WORD_FIGURES.clottedTube, TRANSPORT_WORD_FIGURES.rejectedMarkOne],
            },
            {
              id: 'lithium-electrolyte-accepted',
              paragraphs: [text('ใช้ Lithium heparin Tube (จุกสีเขียว) เก็บตัวอย่างส่งตรวจ Electrolyte', 'A Lithium heparin Tube (green cap) was used to collect a specimen for Electrolyte testing.')],
              status: 'Accept',
              figures: [TRANSPORT_WORD_FIGURES.lithiumTube, TRANSPORT_WORD_FIGURES.acceptedMarkOne],
            },
          ],
          [
            {
              id: 'yellow-urine-rejected',
              paragraphs: [text('ใช้กระป๋องเก็บปัสสาวะ (ฝาเหลือง) ในการเก็บตัวอย่างส่งตรวจ ส่งตรวจ Urine Culture', 'A yellow-cap urine cup was used to collect a specimen for Urine Culture.')],
              status: 'Rejected',
              figures: [TRANSPORT_WORD_FIGURES.wrongUrineContainer, TRANSPORT_WORD_FIGURES.rejectedMarkOne],
            },
            {
              id: 'sterile-urine-accepted',
              paragraphs: [text('ใช้กระป๋องเก็บปัสสาวะ Sterile (ฝาแดง) ในการเก็บตัวอย่างส่งตรวจ ส่งตรวจ Urine Culture', 'A sterile red-cap urine cup was used to collect a specimen for Urine Culture.')],
              status: 'Accept',
              figures: [TRANSPORT_WORD_FIGURES.correctUrineContainer, TRANSPORT_WORD_FIGURES.acceptedMarkOne],
            },
          ],
        ],
      },
    ] satisfies TransportWordTableSection[],
    unsuitable: {
      title: text('5. สิ่งตัวอย่างส่งตรวจไม่เหมาะสมสำหรับการตรวจวิเคราะห์ *', '5. Specimens unsuitable for analysis *'),
      items: [
        text('5.1 มีการแตกของเม็ดเลือดแดง (Hemolyzed ) ที่ 3+ ขึ้นไป', '5.1 Red-cell hemolysis (Hemolyzed) at 3+ or greater.'),
        text('5.2 ตัวอย่างที่มี Fibrin clot เช่น การส่งตรวจ CBC, PT, INR, PTT, blood gas เป็นต้น', '5.2 A specimen with a Fibrin clot, such as a CBC, PT, INR, PTT, or blood gas specimen.'),
        text('5.3 สิ่งตัวอย่างส่งตรวจที่เก็บไม่ถูกต้อง เช่น การเสมหะแต่เก็บเป็นน้ำลาย', '5.3 A specimen collected incorrectly, such as saliva collected instead of sputum.'),
        text('5.4 สิ่งตัวอย่างส่งตรวจที่หกปนเปื้อนอยู่นอกภาชนะบรรจุ', '5.4 A specimen spilled or contaminated outside the container.'),
        text('5.5 สิ่งตัวอย่างส่งตรวจที่นำส่งไม่ถูกวิธี ได้แก่ ตัวอย่างส่งตรวจ Blood gas ที่ควรใช้ ice pack ในการรักษาอุณหภูมิตัวอย่างตลอดเวลาในการนำส่ง หรือตัวอย่างส่งตรวจ Microbilirubin เด็กที่ควรห่อตัวอย่างส่งตรวจด้วยกระดาษทึบแสงหรือกระดาษฟอยล์ขณะนำส่งตรวจ เป็นต้น', '5.5 A specimen transported incorrectly, including a Blood gas specimen that should be kept with an ice pack throughout transport, or a pediatric Microbilirubin specimen that should be wrapped with opaque paper or foil during transport.'),
        text('5.6 สิ่งตัวอย่างส่งตรวจที่มีลักษณะข้นหรือหนืดมาก ไม่สามารถดูดวัดได้', '5.6 A specimen that is so thick or viscous that it cannot be aspirated and measured.'),
      ],
    },
    note: text('หมายเหตุ : ผู้ใช้บริการสามารถดูรายละเอียดเพิ่มเติมได้ในแต่ละการทดสอบของแต่ละงาน', 'Note: Users can find additional details under each test in each laboratory discipline.'),
  },
} as const
