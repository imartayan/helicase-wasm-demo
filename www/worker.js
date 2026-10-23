// Runs the parser off the main thread. FileReaderSync (workers only) lets the wasm
// `Read` implementation pull the file synchronously, slice by slice.
let wasm, file, offset, result, lastProgress;

const ready = WebAssembly.instantiateStreaming(fetch("helicase_wasm_demo.wasm"), {
  env: {
    read_file(ptr, len) {
      const end = Math.min(offset + len, file.size);
      if (end <= offset) return 0;
      const chunk = new FileReaderSync().readAsArrayBuffer(file.slice(offset, end));
      new Uint8Array(wasm.memory.buffer, ptr >>> 0, chunk.byteLength).set(new Uint8Array(chunk));
      offset = end;
      if (offset - lastProgress > file.size / 100) {
        lastProgress = offset;
        postMessage({ progress: offset / file.size });
      }
      return chunk.byteLength;
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
