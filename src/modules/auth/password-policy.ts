import { Matches } from 'class-validator';

// Count Unicode code points; whitespace is not a special character.
const PASSWORD_PATTERN =
  /^(?=[^\r\n]*\p{L})(?=[^\r\n]*\p{Nd})(?=[^\r\n]*[\p{P}\p{S}])[^\r\n]{8,128}$/u;

export const NewPasswordPolicy = () =>
  Matches(PASSWORD_PATTERN, {
    message: 'Mật khẩu cần 8–128 ký tự, gồm chữ cái, chữ số và ký tự đặc biệt.',
  });
