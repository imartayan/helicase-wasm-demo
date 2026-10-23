use helicase::input::*;
use helicase::parallel::find_record_start_in_window;
use helicase::parser::Format;
use helicase::*;
use std::io::{self, Read};

const CONFIG: Config = ParserOptions::default()
    .ignore_headers()
    .ignore_dna()
    .compute_dna_len()
    .config();

#[link(wasm_import_module = "env")]
unsafe extern "C" {
    // Copies the next bytes of the current range (at most `len`) to `ptr`, returns how many were copied.
    fn read_file(ptr: *mut u8, len: usize) -> usize;
    fn report_lengths(ptr: *const u32, count: usize);
    fn report_error(ptr: *const u8, len: usize);
}

struct JsFile;

impl Read for JsFile {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        Ok(unsafe { read_file(buf.as_mut_ptr(), buf.len()) })
    }
}

/// Offset of the first record start in the current range, or -1 if there is none.
#[unsafe(no_mangle)]
pub extern "C" fn find_record_start(first_byte: u8) -> isize {
    let mut window = Vec::new();
    let _ = JsFile.read_to_end(&mut window);
    Format::from_byte(first_byte)
        .and_then(|format| find_record_start_in_window(&window, format))
        .map_or(-1, |start| start as isize)
}

/// Parses the current range and reports the length of each record.
#[unsafe(no_mangle)]
pub extern "C" fn parse_range() {
    let mut lengths = Vec::new();
    match record_lengths(&mut lengths) {
        Ok(()) => unsafe { report_lengths(lengths.as_ptr(), lengths.len()) },
        Err(e) => {
            let msg = e.to_string();
            unsafe { report_error(msg.as_ptr(), msg.len()) }
        }
    }
}

fn record_lengths(lengths: &mut Vec<u32>) -> parser::Result<()> {
    let mut parser = FastxParser::<CONFIG>::from_reader(JsFile)?;
    while let Some(event) = parser.next() {
        event?;
        lengths.push(parser.get_dna_len() as u32);
    }
    Ok(())
}
