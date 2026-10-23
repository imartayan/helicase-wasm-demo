// Runs the parser off the main thread. FileReaderSync (workers only) lets the wasm
// `Read` implementation pull the file synchronously, slice by slice.
// Bytes fetched per FileReaderSync call, much larger than the parser's reads.
const FETCH_LEN = 16 << 20;

let wasm, file, offset, result, lastProgress;
let pending = new Uint8Array();

const ready = WebAssembly.instantiateStreaming(fetch("helicase_wasm_demo.wasm"), {
  env: {
    read_file(ptr, len) {
      if (pending.length === 0) {
        const end = Math.min(offset + FETCH_LEN, file.size);
        if (end <= offset) return 0;
        pending = new Uint8Array(new FileReaderSync().readAsArrayBuffer(file.slice(offset, end)));
        offset = end;
        if (offset - lastProgress > file.size / 100) {
          lastProgress = offset;
          postMessage({ progress: offset / file.size });
        }
      }
      const count = Math.min(len, pending.length);
      new Uint8Array(wasm.memory.buffer, ptr >>> 0, count).set(pending.subarray(0, count));
      pending = pending.subarray(count);
      return count;
    },
    report(ptr, len) {
      const bytes = new Uint8Array(wasm.memory.buffer, ptr >>> 0, len >>> 0);
      result = JSON.parse(new TextDecoder().decode(bytes));
    },
  },
}).then(({ instance }) => (wasm = instance.exports));

onmessage = async ({ data }) => {
  await ready;
  file = data;
  offset = 0;
  lastProgress = 0;
  pending = new Uint8Array();
  const start = performance.now();
  try {
    wasm.parse_file();
  } catch (err) {
    result = { error: String(err) };
  }
  result.seconds = (performance.now() - start) / 1000;
  result.size = file.size;
  postMessage({ result });
};
