const EMAIL_REGEX = /^[A-Z0-9_+-]+(\.[A-Z0-9_+-]+)*@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email);
