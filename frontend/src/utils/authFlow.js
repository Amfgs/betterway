export function passwordResetTransition(response, email) {
  const normalizedEmail = String(email || "").trim();
  return {
    mode: "reset",
    resetToken: String(response?.devResetToken || ""),
    route: `/login?mode=reset&email=${encodeURIComponent(normalizedEmail)}`
  };
}
