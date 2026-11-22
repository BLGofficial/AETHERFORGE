//! AETHER FORGE — Local Rust Offline Audio Engine (ADR-0008)
//! Implements deterministic WAV metadata inspection and gain normalization
//! to a new atomic output file inside an explicitly granted workspace.
//! Note: Local workstation check recorded 'no cargo/rustc'; bit-exact PCM16
//! execution and golden WAV tolerance tests run via workers/audio-engine/src/index.ts.

#[derive(Debug, Clone, PartialEq)]
pub struct WavMetadata {
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
    pub frame_count: u32,
    pub duration_seconds: f64,
    pub peak_dbfs: f64,
}

pub fn parse_pcm16_wav_header(bytes: &[u8]) -> Result<(WavMetadata, usize, usize), &'static str> {
    if bytes.len() < 44 {
        return Err("DOMAIN_AUDIO_FORMAT_INVALID: Buffer smaller than 44-byte RIFF/WAVE header");
    }
    if &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" || &bytes[12..16] != b"fmt " {
        return Err("DOMAIN_AUDIO_FORMAT_INVALID: Missing RIFF/WAVE/fmt magic bytes");
    }
    let audio_format = u16::from_le_bytes([bytes[20], bytes[21]]);
    let channels = u16::from_le_bytes([bytes[22], bytes[23]]);
    let sample_rate = u32::from_le_bytes([bytes[24], bytes[25], bytes[26], bytes[27]]);
    let bits_per_sample = u16::from_le_bytes([bytes[34], bytes[35]]);
    if audio_format != 1 || bits_per_sample != 16 || channels == 0 || sample_rate == 0 {
        return Err("DOMAIN_AUDIO_FORMAT_INVALID: Only 16-bit linear PCM WAV supported");
    }
    if &bytes[36..40] != b"data" {
        return Err("DOMAIN_AUDIO_FORMAT_INVALID: Missing data chunk header");
    }
    let data_bytes = u32::from_le_bytes([bytes[40], bytes[41], bytes[42], bytes[43]]) as usize;
    if 44 + data_bytes > bytes.len() || data_bytes % 2 != 0 {
        return Err("DOMAIN_AUDIO_FORMAT_INVALID: Truncated or misaligned PCM16 data chunk");
    }
    let sample_count = data_bytes / 2;
    let frame_count = (sample_count / (channels as usize)) as u32;
    let duration_seconds = (frame_count as f64) / (sample_rate as f64);

    let mut max_abs: i32 = 0;
    for chunk in bytes[44..44 + data_bytes].chunks_exact(2) {
        let sample = i16::from_le_bytes([chunk[0], chunk[1]]) as i32;
        let abs = sample.abs();
        if abs > max_abs {
            max_abs = abs;
        }
    }
    let peak_dbfs = if max_abs == 0 {
        -120.0
    } else {
        20.0 * ((max_abs as f64) / 32767.0).log10()
    };

    Ok((
        WavMetadata {
            sample_rate,
            channels,
            bits_per_sample,
            frame_count,
            duration_seconds,
            peak_dbfs,
        },
        44,
        data_bytes,
    ))
}
