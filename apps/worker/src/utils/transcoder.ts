const ULAW_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let mu = ~i;
  let sign = (mu & 0x80) ? -1 : 1;
  let exponent = (mu & 0x70) >> 4;
  let data = mu & 0x0f;
  let sample = (data << 3) + 132;
  sample <<= exponent;
  sample -= 132;
  ULAW_TABLE[i] = sign * sample;
}

export function decodeUlawToPcm16(ulawData: Uint8Array): Int16Array {
  // Decode 8kHz ulaw to 8kHz PCM
  const pcm8k = new Int16Array(ulawData.length);
  for (let i = 0; i < ulawData.length; i++) {
    pcm8k[i] = ULAW_TABLE[ulawData[i]];
  }
  
  // Upsample 8kHz to 16kHz
  const pcm16k = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length; i++) {
    pcm16k[i * 2] = pcm8k[i];
    pcm16k[i * 2 + 1] = pcm8k[i];
  }
  
  return pcm16k;
}

export function encodePcm16ToUlaw(pcm16kData: Int16Array): Uint8Array {
  // Downsample 16kHz to 8kHz
  const pcm8k = new Int16Array(pcm16kData.length / 2);
  for (let i = 0; i < pcm8k.length; i++) {
    pcm8k[i] = pcm16kData[i * 2];
  }

  // Encode PCM to ulaw
  const ulaw = new Uint8Array(pcm8k.length);
  for (let i = 0; i < pcm8k.length; i++) {
    let sample = pcm8k[i];
    
    if (sample > 32767) sample = 32767;
    else if (sample < -32768) sample = -32768;
    
    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > 32635) sample = 32635;
    
    sample += 132;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    
    let mantissa = (sample >> (exponent === 0 ? 4 : exponent + 3)) & 0x0f;
    let ulawByte = ~(sign | (exponent << 4) | mantissa);
    
    ulaw[i] = ulawByte;
  }
  
  return ulaw;
}
