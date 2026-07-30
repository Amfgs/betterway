import assert from "node:assert/strict";
import test from "node:test";
import { passwordResetTransition } from "../src/utils/authFlow.js";

test("abre a etapa do código mesmo quando a API não devolve token de desenvolvimento", () => {
  const transition = passwordResetTransition(
    { message: "Se o e-mail estiver cadastrado, enviaremos um código de redefinição." },
    "pessoa@example.com"
  );

  assert.deepEqual(transition, {
    mode: "reset-code",
    resetToken: "",
    route: "/login?mode=reset-code&email=pessoa%40example.com"
  });
});

test("preenche automaticamente apenas o código devolvido no ambiente local", () => {
  const transition = passwordResetTransition({ devResetToken: "12345678" }, "local@example.com");
  assert.equal(transition.mode, "reset-code");
  assert.equal(transition.resetToken, "12345678");
});
