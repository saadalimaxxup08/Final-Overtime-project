import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

interface PDFData {
  employeeName: string;
  empId: string;
  logs: any[];
  hourlyRate: number;
  currencySymbol: string;
  currencyCode: string;
}

export const generateOvertimePDF = ({
  employeeName,
  empId,
  logs,
  hourlyRate,
  currencySymbol,
  currencyCode,
}: PDFData) => {
  const doc = new jsPDF();

  const safeCurrencyText = ['$', '€', '£'].includes(currencySymbol)
   ? currencySymbol
    : currencyCode;

  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('OVERTIME REPORT', 14, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Employee Timesheet & Invoice', 14, 29);

  doc.setTextColor(0, 0, 0);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, 42, 182, 28, 2, 2, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Details', 18, 48);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${employeeName}`, 18, 54);
  doc.text(`Employee ID: ${empId}`, 18, 59);
  doc.text(`Generated: ${dayjs().format('DD MMM YYYY, hh:mm A')}`, 18, 64);
  doc.text(`Currency: ${currencyCode}`, 120, 54);
  doc.text(`Hourly Rate: ${safeCurrencyText} ${hourlyRate.toFixed(2)}`, 120, 59);

  // CHANGE: Ab total_hours aur overtime_hours same hain
  const totalOvertime = logs.reduce((sum, log) => sum + Number(log.overtime_hours || 0), 0);
  const totalAmount = totalOvertime * hourlyRate;

  // CHANGE: Table se Total Hours column hataya
  const tableData = logs.map((log) => [
    dayjs(log.date).format('DD MMM YYYY'),
    log.check_in? dayjs(log.check_in).format('hh:mm A') : '-',
    log.check_out? dayjs(log.check_out).format('hh:mm A') : 'Active',
    Number(log.overtime_hours).toFixed(2), // Sirf Overtime
    log.notes || '-',
  ]);

  autoTable(doc, {
    startY: 78,
    head: [['Date', 'Check In', 'Check Out', 'Overtime Hours', 'Notes']], // Total Hours hata diya
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [139, 92, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [55, 65, 81],
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 30, halign: 'right' }, // Overtime Hours
      4: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14, bottom: 50 },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 10;

  if (finalY > 240) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFillColor(236, 254, 255);
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, finalY, 182, 30, 2, 2, 'FD'); // Height kam ki kyunki Total Hours nahi hai

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(8, 145, 178);
  doc.text('Summary', 18, finalY + 7);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  // CHANGE: Total Working Hours hataya, sirf Overtime rakha
  doc.text(`Total Overtime Hours:`, 18, finalY + 14);
  doc.text(`Hourly Rate:`, 18, finalY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text(`${totalOvertime.toFixed(2)} hrs`, 70, finalY + 14);
  doc.text(`${safeCurrencyText} ${hourlyRate.toFixed(2)}`, 70, finalY + 20);

  doc.setFillColor(16, 185, 129);
  doc.roundedRect(120, finalY + 8, 72, 18, 2, 2, 'F'); // Position adjust ki
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('TOTAL AMOUNT', 124, finalY + 14);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${safeCurrencyText} ${totalAmount.toFixed(2)}`, 124, finalY + 22);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'This is a computer-generated document. No signature required.',
      14,
      285
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
  }

  doc.save(`Overtime_${empId}_${dayjs().format('YYYY-MM-DD')}.pdf`);
};
