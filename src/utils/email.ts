/**
 * Permissive email check for signup/login UX.
 * Allows multi-part TLDs (.co.uk, .org.uk, .gov.uk) and longer ones (.email).
 * Not a full RFC 5322 parser — intentionally practical over restrictive.
 */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > 254) {
    return false;
  }

  // local@label(.label)+ — requires at least one dot in the domain so
  // example.co.uk / something.email are accepted; rejects "a@b".
  return /^[^\s@]+@[^\s@]+(\.[^\s@]+)+$/.test(email);
}
