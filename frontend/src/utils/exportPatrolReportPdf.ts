import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PatrolReportPdfRow = {
  no: number;
  contractCode: string;
  siteName: string;
  shiftLabel: string;
  status: string;
  scheduleDate: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  operator: string;
  contactDetail: string;
  callNote: string;
};

type ExportPatrolReportPdfOptions = {
  title: string;
  fileName: string;
  filterText: string;
  rows: PatrolReportPdfRow[];
};

const PROMPT_FONT_NAME = "Prompt";
const PROMPT_REGULAR_FILE = "Prompt-Regular.ttf";
const PROMPT_SEMIBOLD_FILE = "Prompt-SemiBold.ttf";

const fontCache = new Map<string, Promise<string>>();

function arrayBufferToBinaryString(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  let result = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length),
    );

    let text = "";

    for (let index = 0; index < chunk.length; index += 1) {
      text += String.fromCharCode(chunk[index]);
    }

    result += text;
  }

  return result;
}

async function loadFontBinary(fontFileName: string) {
  const cached = fontCache.get(fontFileName);

  if (cached) {
    return cached;
  }

  const fontPromise = (async () => {
    const fontUrl = `${import.meta.env.BASE_URL}fonts/${fontFileName}`;
    const response = await fetch(fontUrl);

    if (!response.ok) {
      throw new Error(
        `ไม่พบไฟล์ฟอนต์ ${fontFileName} ใน public/fonts`,
      );
    }

    const buffer = await response.arrayBuffer();

    return arrayBufferToBinaryString(buffer);
  })();

  fontCache.set(fontFileName, fontPromise);

  try {
    return await fontPromise;
  } catch (error) {
    fontCache.delete(fontFileName);
    throw error;
  }
}

async function registerPromptFonts(doc: jsPDF) {
  const [regularFont, semiBoldFont] = await Promise.all([
    loadFontBinary(PROMPT_REGULAR_FILE),
    loadFontBinary(PROMPT_SEMIBOLD_FILE),
  ]);

  doc.addFileToVFS(PROMPT_REGULAR_FILE, regularFont);
  doc.addFont(PROMPT_REGULAR_FILE, PROMPT_FONT_NAME, "normal");

  doc.addFileToVFS(PROMPT_SEMIBOLD_FILE, semiBoldFont);
  doc.addFont(PROMPT_SEMIBOLD_FILE, PROMPT_FONT_NAME, "bold");

  doc.setFont(PROMPT_FONT_NAME, "normal");
}

function getExportDateTimeText() {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

export async function exportPatrolReportPdf({
  title,
  fileName,
  filterText,
  rows,
}: ExportPatrolReportPdfOptions) {
  if (rows.length === 0) {
    throw new Error("ไม่มีข้อมูลสำหรับ Export PDF");
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
    compress: true,
  });

  await registerPromptFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 8;

  const filterLines = doc.splitTextToSize(
    filterText,
    pageWidth - marginX * 2,
  );

  const tableStartY = 20 + filterLines.length * 3.5;

  const drawPageHeader = () => {
    doc.setFont(PROMPT_FONT_NAME, "bold");
    doc.setFontSize(15);
    doc.setTextColor(18, 82, 122);
    doc.text(title, marginX, 10);

    doc.setFont(PROMPT_FONT_NAME, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    doc.text(filterLines, marginX, 16);
  };

  drawPageHeader();

  autoTable(doc, {
    startY: tableStartY,
    margin: {
      top: tableStartY,
      right: marginX,
      bottom: 12,
      left: marginX,
    },
    theme: "grid",
    showHead: "everyPage",
    head: [
      [
        "ลำดับ",
        "รหัสสัญญา",
        "ชื่อจุดรักษาการณ์",
        "ผลัด",
        "สถานะ",
        "ตารางแผนงาน",
        "วันเวลาเข้า",
        "วันเวลาออก",
        "ผู้ดำเนินการ",
        "รายละเอียดการติดต่อ",
        "หมายเหตุ",
      ],
    ],
    body: rows.map((row) => [
      String(row.no),
      row.contractCode,
      row.siteName,
      row.shiftLabel,
      row.status,
      row.scheduleDate,
      row.checkInDateTime,
      row.checkOutDateTime,
      row.operator,
      row.contactDetail,
      row.callNote,
    ]),
    styles: {
      font: PROMPT_FONT_NAME,
      fontStyle: "normal",
      fontSize: 6.5,
      cellPadding: 1.2,
      textColor: [35, 45, 55],
      lineColor: [220, 225, 230],
      lineWidth: 0.1,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      font: PROMPT_FONT_NAME,
      fontStyle: "bold",
      fontSize: 6.7,
      halign: "center",
      valign: "middle",
      fillColor: [18, 82, 122],
      textColor: [255, 255, 255],
      minCellHeight: 8,
    },
    alternateRowStyles: {
      fillColor: [249, 251, 253],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 17, halign: "center" },
      2: { cellWidth: 36 },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 35, halign: "center" },
      6: { cellWidth: 31 },
      7: { cellWidth: 31 },
      8: { cellWidth: 37 },
      9: { cellWidth: 72 },
      10: { cellWidth: 100 },
    },
    willDrawPage: () => {
      drawPageHeader();
    },
  });

  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont(PROMPT_FONT_NAME, "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);

    doc.text(
      `ส่งออกเมื่อ ${getExportDateTimeText()}`,
      marginX,
      pageHeight - 5,
    );

    doc.text(
      `หน้า ${page} / ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 5,
      { align: "right" },
    );
  }

  doc.save(fileName);
}
