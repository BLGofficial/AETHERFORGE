//! AETHER FORGE — Local Rust Offline Audio Engine (ADR-0008)
//! Implements deterministic WAV metadata inspection and gain normalization
//! to a new atomic output file inside an explicitly granted workspace.

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

pub fn gain_normalize_pcm16_wav(bytes: &[u8], target_peak_dbfs: f64) -> Result<(Vec<u8>, f64), &'static str> {
    let (meta, data_offset, data_bytes) = parse_pcm16_wav_header(bytes)?;
    let gain_db = if meta.peak_dbfs <= -120.0 {
        0.0
    } else {
        target_peak_dbfs - meta.peak_dbfs
    };
    let linear_gain = 10.0_f64.powf(gain_db / 20.0);

    let mut out = bytes.to_vec();
    let mut out_max_abs: i32 = 0;

    for chunk in out[data_offset..data_offset + data_bytes].chunks_exact_mut(2) {
        let sample = i16::from_le_bytes([chunk[0], chunk[1]]) as f64;
        let scaled = (sample * linear_gain).round() as i32;
        let clamped = scaled.clamp(-32767, 32767);
        if clamped.abs() > out_max_abs {
            out_max_abs = clamped.abs();
        }
        let le = (clamped as i16).to_le_bytes();
        chunk[0] = le[0];
        chunk[1] = le[1];
    }

    let out_peak_dbfs = if out_max_abs == 0 {
        -120.0
    } else {
        20.0 * ((out_max_abs as f64) / 32767.0).log10()
    };

    Ok((out, out_peak_dbfs))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_golden_pcm16_gain_normalize() {
        let mut wav = vec![0u8; 44 + 4];
        wav[0..4].copy_from_slice(b"RIFF");
        wav[4..8].copy_from_slice(&40u32.to_le_bytes());
        wav[8..12].copy_from_slice(b"WAVE");
        wav[12..16].copy_from_slice(b"fmt ");
        wav[16..20].copy_from_slice(&16u32.to_le_bytes());
        wav[20..22].copy_from_slice(&1u16.to_le_bytes());
        wav[22..24].copy_from_slice(&1u16.to_le_bytes());
        wav[24..28].copy_from_slice(&48000u32.to_le_bytes());
        wav[28..32].copy_from_slice(&96000u32.to_le_bytes());
        wav[32..34].copy_from_slice(&2u16.to_le_bytes());
        wav[34..36].copy_from_slice(&16u16.to_le_bytes());
        wav[36..40].copy_from_slice(b"data");
        wav[40..44].copy_from_slice(&4u32.to_le_bytes());
        wav[44..46].copy_from_slice(&16384i16.to_le_bytes());
        wav[46..48].copy_from_slice(&(-16384i16).to_le_bytes());

        let (_, out_peak) = gain_normalize_pcm16_wav(&wav, -1.0).unwrap();
        assert!((out_peak - -1.0).abs() < 0.01);
    }
}
