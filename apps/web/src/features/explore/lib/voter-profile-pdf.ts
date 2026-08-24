/** Port of bdcat globalPrintModalToPDF — opens browser print dialog for PDF save. */
export function printVoterProfilePdf(root: HTMLElement, title = "voters") {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((el) => el.outerHTML)
    .join("\n");

  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  ${styles}
  <style>
    body { font-family: Verdana, Arial, sans-serif; font-size: 13px; color: #111; }
    .no-print { display: none !important; }
    @page { margin: 8mm; }
    @media print {
      html, body { height: auto; }
      .page-break { page-break-after: always; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px; vertical-align: top; }
      .profile-section-title {
        background: #000 !important;
        color: #fff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sikap-putih { background: #fff !important; color: #000 !important; border: 1px solid #000 !important; }
      .sikap-kelabu { background: #777 !important; color: #fff !important; }
      .sikap-hitam { background: #000 !important; color: #fff !important; }
      .voter-whatsapp-print {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .voter-whatsapp-print img {
        max-width: 100%;
        max-height: 280px;
        object-fit: contain;
        border: 1px solid #ccc;
      }
    }
  </style>
</head>
<body>
  <div class="print-root">${root.innerHTML}</div>
</body>
</html>`);
  doc.close();

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }

    const imgs = Array.from(
      doc.querySelectorAll<HTMLImageElement>(".print-root img"),
    );
    const waitForImages = imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    );

    void Promise.all(waitForImages).then(() => {
      win.focus();
      win.print();
      window.setTimeout(() => iframe.remove(), 1000);
    });
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
