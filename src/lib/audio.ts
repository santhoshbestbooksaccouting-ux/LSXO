/**
 * Audio Synthesizer (Disabled as requested: "Sound also No Need")
 */

export function getAudioMuted(): boolean {
  return true;
}

export function setAudioMuted(_muted: boolean): void {
  // no-op
}

export function playMoveSound(_symbol: 'X' | 'O'): void {
  // disabled
}

export function playWinSound(): void {
  // disabled
}

export function playDrawSound(): void {
  // disabled
}

export function playClickSound(): void {
  // disabled
}

export function playFriendJoinedSound(): void {
  // disabled
}

export function playMessageSound(): void {
  // disabled
}
