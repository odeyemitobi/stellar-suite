export function corruptJson(): string {
  return '{"broken": true,,,}';
}

export function tamperCiphertext(payload: any) {
  return {
    ...payload,
    ciphertext: payload.ciphertext.slice(0, -4) + 'abcd'
  };
}

export function removeRequiredField(state: any, field: string) {
  const copy = { ...state };
  delete copy[field];
  return copy;
}