/// <reference types="node" />

declare module 'pdfkit' {
  const PDFDocument: any;
  export default PDFDocument;
}

declare module '@sendgrid/mail' {
  const sgMail: any;
  export default sgMail;
  export const setApiKey: (key: string) => void;
  export const send: (...args: any[]) => Promise<any>;
}