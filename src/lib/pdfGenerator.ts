// Temporarily disable jsPDF imports to troubleshoot Next.js startup issue
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
const jsPDF = {} as any; // Temporary placeholder

export interface Transaction {
  date: string;
  note: string;
  type: string;
  amount: number;
  running_balance: number;
}

export interface ReceiptData {
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  membership: string;
  transactions: Transaction[];
  generatedDate: string;
}

/**
 * Generate a PDF receipt for member transactions
 */
export function generateTransactionReceipt(data: ReceiptData): any {
  const doc = new jsPDF();

  // Noir brand colors
  const cork = [165, 148, 128]; // #A59480
  const nightSky = [31, 31, 31]; // #1F1F1F
  const weddingDay = [236, 237, 232]; // #ECEDE8

  // Add Noir logo/header
  doc.setFillColor(nightSky[0], nightSky[1], nightSky[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('NOIR', 20, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Member Transaction Receipt', 20, 33);

  // Member Information
  doc.setTextColor(nightSky[0], nightSky[1], nightSky[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Member Information', 20, 55);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${data.memberName}`, 20, 62);
  doc.text(`Email: ${data.memberEmail}`, 20, 68);
  doc.text(`Phone: ${data.memberPhone}`, 20, 74);
  doc.text(`Membership: ${data.membership}`, 20, 80);

  // Receipt details
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${data.generatedDate}`, 20, 90);

  // Transactions table
  const tableData = data.transactions.map(t => [
    new Date(t.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    t.note || '-',
    t.type.charAt(0).toUpperCase() + t.type.slice(1),
    t.type === 'charge' || t.type === 'refund'
      ? `-$${Math.abs(t.amount).toFixed(2)}`
      : `$${t.amount.toFixed(2)}`,
    `$${t.running_balance.toFixed(2)}`,
  ]);

  // autoTable(doc, {
  //   startY: 100,
  //   head: [['Date', 'Description', 'Type', 'Amount', 'Balance']],
  //   body: tableData,
  //   theme: 'grid',
  //   headStyles: {
  //     fillColor: cork,
  //     textColor: [255, 255, 255],
  //     fontStyle: 'bold',
  //     fontSize: 10,
  //   },
  //   bodyStyles: {
  //     textColor: nightSky,
  //     fontSize: 9,
  //   },
  //   alternateRowStyles: {
  //     fillColor: weddingDay,
  //   },
  //   columnStyles: {
  //     0: { cellWidth: 30 }, // Date
  //     1: { cellWidth: 70 }, // Description
  //     2: { cellWidth: 25 }, // Type
  //     3: { cellWidth: 30, halign: 'right' }, // Amount
  //     4: { cellWidth: 30, halign: 'right' }, // Balance
  //   },
  //   margin: { left: 20, right: 20 },
  // });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const currentBalance = data.transactions[data.transactions.length - 1]?.running_balance || 0;

  doc.setFillColor(weddingDay[0], weddingDay[1], weddingDay[2]);
  doc.rect(130, finalY, 60, 20, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(nightSky[0], nightSky[1], nightSky[2]);
  doc.text('Current Balance:', 135, finalY + 8);

  doc.setFontSize(14);
  doc.setTextColor(cork[0], cork[1], cork[2]);
  const balanceText = currentBalance >= 0
    ? `$${currentBalance.toFixed(2)} CR`
    : `$${Math.abs(currentBalance).toFixed(2)} DR`;
  doc.text(balanceText, 135, finalY + 16);

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for being a Noir member', 105, pageHeight - 20, {
    align: 'center',
  });
  doc.text('For questions, contact us at (619) 971-3730', 105, pageHeight - 15, {
    align: 'center',
  });

  return doc;
}

/**
 * Download a transaction receipt as PDF
 */
export function downloadTransactionReceipt(data: ReceiptData) {
  const doc = generateTransactionReceipt(data);
  const fileName = `noir-receipt-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Generate PDF for a single transaction
 */
export function generateSingleTransactionReceipt(
  transaction: Transaction,
  memberData: Omit<ReceiptData, 'transactions' | 'generatedDate'>
): any {
  return generateTransactionReceipt({
    ...memberData,
    transactions: [transaction],
    generatedDate: new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  });
}
