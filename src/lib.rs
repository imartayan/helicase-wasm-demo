use helicase::input::*;
use helicase::*;
use std::io::{self, Read};

const CONFIG: Config = ParserOptions::default()
    .ignore_headers()
    .ignore_dna()
    .compute_dna_len()
    .config();

#[link(wasm_import_module = "env")]
unsafe extern "C" {
    // Copies the next bytes of the file (at most `len`) to `ptr`, returns how many were copied.
    fn read_file(ptr: *mut u8, len: usize) -> usize;
    // Receives the result as a JSON string.
    fn report(ptr: *const u8, len: usize);
}

struct JsFile;

impl Read for JsFile {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        Ok(unsafe { read_file(buf.as_mut_ptr(), buf.len()) })
    }
}

#[derive(Default)]
struct Stats {
    records: usize,
    bases: usize,
    min_len: usize,
    max_len: usize,
    n50: usize,
}

#[unsafe(no_mangle)]
pub extern "C" fn parse_file() {
    let json = match stats() {
        Ok(s) => format!(
            r#"{{"records":{},"bases":{},"min_len":{},"max_len":{},"n50":{}}}"#,
            s.records, s.bases, s.min_len, s.max_len, s.n50
        ),
        Err(e) => format!(r#"{{"error":{:?}}}"#, e.to_string()),
    };
    unsafe { report(json.as_ptr(), json.len()) }
}

fn stats() -> parser::Result<Stats> {
    let mut parser = FastxParser::<CONFIG>::from_reader(JsFile)?;
    let mut stats = Stats::default();
    let mut lengths = Vec::new();
    while let Some(event) = parser.next() {
        event?;
        lengths.push(parser.get_dna_len() as u32);
    }
    lengths.sort_unstable_by(|a, b| b.cmp(a));
    stats.records = lengths.len();
    stats.bases = lengths.iter().map(|&l| l as usize).sum();
    stats.max_len = lengths.first().map_or(0, |&l| l as usize);
    stats.min_len = lengths.last().map_or(0, |&l| l as usize);
    let mut acc = 0;
    stats.n50 = lengths
        .iter()
        .find(|&&l| {
            acc += l as usize;
            2 * acc >= stats.bases
        })
        .map_or(0, |&l| l as usize);
    Ok(stats)
}
