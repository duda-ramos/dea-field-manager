import { describe, it, expect } from 'vitest';
import { importExcelFile } from './excel-import';

function makeFile(name: string, content: ArrayBuffer): File {
  return new File([content], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('excel-import basic validation', () => {
  it('rejects non-xlsx files', async () => {
    const file = new File([new Uint8Array([1,2,3])], 'data.csv', { type: 'text/csv' });
    const res = await importExcelFile(file as any);
    expect(res.success).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('handles empty workbook gracefully', async () => {
    const buf = new ArrayBuffer(0);
    const file = makeFile('empty.xlsx', buf);
    const res = await importExcelFile(file);
    expect(res.success).toBe(false);
  });
});
