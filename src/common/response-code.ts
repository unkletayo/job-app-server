/** Business-level response codes — a defined, controlled vocabulary. Not the HTTP status number. */
export const ResponseCode = {
  SUCCESS: '00',
  VALIDATION_ERROR: '01',
  UNAUTHORIZED: '02',
  FORBIDDEN: '03',
  NOT_FOUND: '04',
  CONFLICT: '05',
  INTERNAL_ERROR: '99',
} as const;

export type ResponseCode = (typeof ResponseCode)[keyof typeof ResponseCode];
