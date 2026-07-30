export function passwordResetTransition(response, email) {
  const normalizedEmail = String(email || "").trim();
  return {
    mode: "reset-code",
    resetToken: String(response?.devResetToken || ""),
    route: `/login?mode=reset-code&email=${encodeURIComponent(normalizedEmail)}`
  };
}
