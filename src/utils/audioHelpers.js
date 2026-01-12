/**
 * Audio Helper Utilities
 *
 * Note: createWavHeader function removed - OGG_OPUS format is self-contained
 * and does not require manual header creation like WAV format.
 */

/**
 * Convert base64 string to Uint8Array
 * Used for parsing Gemini API audio responses
 * @param {string} base64 - Base64 encoded string
 * @returns {Uint8Array} Decoded bytes
 */
export const base64ToBytes = base64 => {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};
