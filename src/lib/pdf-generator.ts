import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

interface OvertimeLog {
  date: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number;
  overtime_hours: number;
  notes: string | null;
}

interface PDFGeneratorParams {
  employeeName: string;
  empId: string;
  logs: OvertimeLog[];
  monthName?: string; // Optional: e.g. "June 2026"
}

export const generateOvertimePDF = ({
  employeeName,
  empId,
  logs,
  monthName,
}: PDFGeneratorParams) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const titleMonth = monthName ? ` - ${monthName.toUpperCase()}` : '';

  // Theme colors
  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [6, 182, 212]; // Cyan 500
  const textColor = [51, 65, 85]; // Slate 700
  const lightBg = [248, 250, 252]; // Slate 50

  // 1. Document Header
  // Top decorative accent bar
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, 210, 4, 'F');

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('OVERTIME TRACKER PRO', 14, 15);

  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(`OFFICIAL WORK & OVERTIME LOG REPORT${titleMonth}`, 14, 20);

  // Metadata Card (Right side)
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('REPORT DETAILS', 140, 15);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm')}`, 140, 20);
  doc.text(`Status: Verified`, 140, 24);

  // Divider Line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(14, 28, 196, 28);

  // Employee details card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(14, 32, 182, 18, 2, 2, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('EMPLOYEE NAME:', 18, 39);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(employeeName, 55, 39);

  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('EMPLOYEE ID:', 18, 45);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(empId, 55, 45);

  // 2. Table of Logs
  // Prepare Table Data
  const tableHeaders = [['Date', 'Clock In', 'Clock Out', 'Total Hours', 'OT Hours', 'Notes']];
  
  // Sort logs by date ascending
  const sortedLogs = [...logs].sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());

  let accumulatedTotalHours = 0;
  let accumulatedOvertimeHours = 0;

  const tableRows = sortedLogs.map((log) => {
    accumulatedTotalHours += Number(log.total_hours || 0);
    accumulatedOvertimeHours += Number(log.overtime_hours || 0);

    const clockInStr = log.check_in ? dayjs(log.check_in).format('hh:mm A') : '-';
    const clockOutStr = log.check_out ? dayjs(log.check_out).format('hh:mm A') : '-';
    
    return [
      dayjs(log.date).format('YYYY-MM-DD'),
      clockInStr,
      clockOutStr,
      Number(log.total_hours || 0).toFixed(2),
      Number(log.overtime_hours || 0).toFixed(2),
      log.notes || '',
    ];
  });

  // Append a summary row
  tableRows.push([
    'TOTALS',
    '',
    '',
    accumulatedTotalHours.toFixed(2),
    accumulatedOvertimeHours.toFixed(2),
    'Accumulated summary for the period',
  ]);

  autoTable(doc, {
    startY: 55,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Date
      1: { cellWidth: 25 }, // Clock In
      2: { cellWidth: 25 }, // Clock Out
      3: { cellWidth: 22, halign: 'right' }, // Total Hours
      4: { cellWidth: 22, halign: 'right' }, // OT Hours
      5: { cellWidth: 'auto' }, // Notes
    },
    didParseCell: (data) => {
      // Style the summary row
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249]; // Slate 100
        data.cell.styles.textColor = [15, 23, 42]; // Slate 900
        
        if (data.column.index === 3 || data.column.index === 4) {
          data.cell.styles.textColor = [6, 182, 212]; // Cyan for values
        }
      }
    },
  });

  // 3. Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    
    // Line at bottom
    doc.setDrawColor(241, 245, 249);
    doc.line(14, 280, 196, 280);

    // Footer text
    doc.text('Overtime Tracker Pro - Confidential Document', 14, 285);
    doc.text(`Page ${i} of ${pageCount}`, 180, 285);
  }

  // Save the PDF
  const filename = `${employeeName.replace(/\s+/g, '_')}_Overtime_Report_${dayjs().format('YYYY_MM')}.pdf`;
  doc.save(filename);
};
