// Parses one range of the file. FileReaderSync (workers only) lets the wasm
// `Read` implementation pull the range synchronously, slice by slice.
// Bytes fetched per FileReaderSync call, much larger than the parser's reads.
const FETCH_LEN = 16 << 20;

let wasm, file, offset, end, parsing, unreported, result;
let pending = new Uint8Array();

const ready = WebAssembly.instantiateStreaming(fetch("helicase_wasm_demo.wasm"), {
  env: {
    read_file(ptr, len) {
      if (pending.length === 0) {
        const stop = Math.min(offset + FETCH_LEN, end);
        if (stop <= offset) return 0;
        pending = new Uint8Array(new FileReaderSync().readAsArrayBuffer(file.slice(offset, stop)));
        offset = stop;
      }
      const count = Math.min(len, pending.length);
      new Uint8Array(wasm.memory.buffer, ptr >>> 0, count).set(pending.subarray(0, count));
      pending = pending.subarray(count);
      if (parsing && (unreported += count) > file.size / 200) {
        postMessage({ progress: unreported });
        unreported = 0;
      }
      return count;
    },
    report_lengths(ptr, count) {
      result = { lengths: new Uint32Array(wasm.memory.buffer, ptr >>> 0, count >>> 0).slice() };
    },
    report_error(ptr, len) {
      const bytes = new Uint8Array(wasm.memory.buffer, ptr >>> 0, len >>> 0);
      result = { error: new TextDecoder().decode(bytes) };
    },
  },
}).then(({ instance }) => (wasm = instance.exports));

// First record start at or after split `i` of `count`. The window starts one byte
// before the split and doubles until it contains a record start.
function splitAt(i, count, firstByte) {
  if (i === 0) return 0;
  if (i === count) return file.size;
  const pos = Math.floor((i * file.size) / count);
  for (let window = 1 << 16; ; window *= 2) {
    offset = pos - 1;
    end = Math.min(offset + window, file.size);
    pending = new Uint8Array();
    const found = wasm.find_record_start(firstByte);
    if (found >= 0) return pos - 1 + found;
    if (end === file.size) return file.size;
  }
}

onmessage = async ({ data }) => {
  await ready;
  file = data.file;
  parsing = false;
  unreported = 0;
  result = { lengths: new Uint32Array() };
  try {
    const start = splitAt(data.index, data.count, data.firstByte);
    const stop = splitAt(data.index + 1, data.count, data.firstByte);
    [offset, end, parsing] = [start, stop, true];
    pending = new Uint8Array();
    if (start < stop) wasm.parse_range();
  } catch (err) {
    result = { error: String(err) };
  }
  postMessage(result, result.lengths ? [result.lengths.buffer] : []);
};
