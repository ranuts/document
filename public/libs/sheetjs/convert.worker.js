/* Local-only SheetJS conversion. One request per worker; the owner terminates it. */
self.onmessage = function (event) {
  try {
    var request = event.data;
    if (
      !request ||
      !['csv-to-xlsx', 'html-to-xlsx', 'xlsx-to-csv'].includes(request.operation) ||
      (request.operation === 'xlsx-to-csv' ? !(request.data instanceof ArrayBuffer) : typeof request.data !== 'string')
    )
      throw new Error('Invalid spreadsheet conversion request');
    importScripts(new URL('./xlsx.full.min.js', self.location.href).href);
    var binary = request.operation === 'xlsx-to-csv';
    var workbook = XLSX.read(binary ? new Uint8Array(request.data) : request.data, {
      type: binary ? 'array' : 'string',
      ...(binary ? {} : { raw: false }),
    });
    if (!workbook.SheetNames || !workbook.SheetNames.length) throw new Error('no table found');
    var output;
    if (binary) {
      var text = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
      var bytes = new TextEncoder().encode(text);
      var csv = new Uint8Array(bytes.length + 3);
      csv.set([0xef, 0xbb, 0xbf]);
      csv.set(bytes, 3);
      output = csv.buffer;
    } else output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    self.postMessage({ ok: true, data: output }, [output]);
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Spreadsheet conversion failed' });
  }
};
