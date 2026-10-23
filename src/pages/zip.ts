/** Minimal dependency-free ZIP writer (store only, no compression). Enough for a static site. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function createZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);
    // version 20, flags 0x0800 (UTF-8 names), method 0 (store), DOS time/date 1980-01-01
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)];
    const local = new Uint8Array([...u32(0x04034b50), ...common, ...nameBytes]);
    chunks.push(local, data);
    central.push(
      new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes,
      ]),
    );
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
