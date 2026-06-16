import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

interface OvertimeLog {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number;
  overtime_hours: number;
  notes: string | null;
}

interface PDFData {
  employeeName: string;
  empId: string;
  logs: OvertimeLog[];
  hourlyRate: number;
  currencySymbol: string;
  currencyCode: string;
}

export const generateOvertimePDF = (data: PDFData) => {
  const doc = new jsPDF();
  
  const totalOvertime = data.logs.reduce((sum, log) => sum + log.overtime_hours, 0);
  const totalAmount = (totalOvertime * data.hourlyRate).toFixed(2);

  // Header
  doc.setFontSize(20);
  doc.text('Overtime Report', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Employee: ${data.employeeName}`, 14, 32);
  doc.text(`Employee ID: ${data.empId}`, 14, 38);
  doc.text(`Generated: ${dayjs().format('DD MMM YYYY, hh:mm A')}`, 14, 44);
  doc.text(`Currency: ${data.currencyCode} (${data.currencySymbol})`, 14, 50);

  // Table
  const tableColumn = ['Date', 'Check In', 'Check Out', 'Total Hours', 'Overtime', 'Notes'];
  const tableRows: any[] = [];

  data.logs.forEach((log) => {
    const logData = [
      dayjs(log.date).format('DD MMM YYYY'),
      log.check_in ? dayjs(log.check_in).format('hh:mm A') : '-',
      log.check_out ? dayjs(log.check_out).format('hh:mm A') : '-',
      log.total_hours.toFixed(2),
      log.overtime_hours.toFixed(2),
      log.notes || '-',
    ];
    tableRows.push(logData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 58,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [139, 92, 246] },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY || 58;
  doc.setFontSize(12);
  doc.text(`Total Overtime Hours: ${totalOvertime.toFixed(2)}`, 14, finalY + 10);
  doc.text(`Hourly Rate: ${data.currencySymbol}${data.hourlyRate.toFixed(2)}`, 14, finalY + 17);
  doc.setFontSize(14);
  doc.text(`Total Amount: ${data.currencySymbol}${totalAmount}`, 14, finalY + 26);

  doc.save(`Overtime_${data.empId}_${dayjs().format('YYYYMMDD')}.pdf`);
};