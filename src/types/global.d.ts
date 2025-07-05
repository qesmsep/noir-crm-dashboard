declare const Buffer: typeof import('buffer').Buffer;

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

declare const process: any;