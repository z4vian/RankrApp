// Error details stay in process memory until the user submits feedback.
let pendingError: { name: string } | undefined;
export function rememberDiagnostic(error: Error) {
  // Error messages, stacks, URLs and component props may contain user data.
  const allowed = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'];
  pendingError = { name: allowed.includes(error.name) ? error.name : 'Error' };
}
export function takeDiagnostic() {
  const value = pendingError;
  pendingError = undefined;
  return value;
}
