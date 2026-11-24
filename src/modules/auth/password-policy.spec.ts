import { validate } from 'class-validator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

function validateForAllFlows(password: string) {
  const register = Object.assign(new RegisterDto(), {
    fullName: 'Test User',
    email: 'tester@example.test',
    password,
  });
  const reset = Object.assign(new ResetPasswordDto(), {
    token: 'a'.repeat(64),
    newPassword: password,
  });
  const change = Object.assign(new ChangePasswordDto(), {
    currentPassword: 'legacy',
    newPassword: password,
  });
  return Promise.all([validate(register), validate(reset), validate(change)]);
}

describe('New password policy', () => {
  it.each(['abcd12!x', 'ABCD12!X', 'đấtrồi1!', `${'ế'.repeat(25)}1!`])(
    'accepts the same valid password in all three flows: %s',
    async (password) => {
      await expect(validateForAllFlows(password)).resolves.toEqual([
        [],
        [],
        [],
      ]);
    },
  );

  it.each([
    'abc12!x',
    'abcdefgh!',
    '12345678!',
    'abc12345 ',
    'abcd1234',
    `${'a'.repeat(127)}1!`,
  ])(
    'rejects the same invalid password in every flow: %s',
    async (password) => {
      const errors = await validateForAllFlows(password);
      expect(
        errors.map((fields) => fields.map((field) => field.property)),
      ).toEqual([['password'], ['newPassword'], ['newPassword']]);
    },
  );
});
