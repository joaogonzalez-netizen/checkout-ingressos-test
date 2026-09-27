// Política de senha do backoffice. Roda na tela (medidor ao vivo) e no servidor (fonte da verdade).

export const PASSWORD_MIN_LENGTH = 12;

/** Senhas e padrões muito usados (checados por "contém", sem diferenciar maiúsculas). */
const COMMON = [
  "123456", "12345678", "123456789", "1234567890", "password", "senha", "qwerty", "abc123", "111111",
  "iloveyou", "admin", "welcome", "letmein", "brasil", "mudar123", "trocar", "teste", "default", "000000",
  "654321", "asdfgh", "zxcvbn", "qwe123", "senha123", "master", "dragon", "monkey", "football", "futebol",
];

export type PasswordCheck = { id: string; label: string; ok: boolean };

function normalize(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function passwordChecks(password: string, ctx: { name?: string; email?: string } = {}): PasswordCheck[] {
  const p = normalize(password);
  // Partes do nome e do e-mail com 3+ letras não podem aparecer na senha.
  const personal = [
    ...(ctx.name ? normalize(ctx.name).split(/\s+/) : []),
    ...(ctx.email ? normalize(ctx.email.split("@")[0]).split(/[._\-+]/) : []),
  ].filter((part) => part.length >= 3);

  return [
    { id: "length", label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { id: "upper", label: "Uma letra maiúscula", ok: /[A-ZÀ-Ý]/.test(password) },
    { id: "lower", label: "Uma letra minúscula", ok: /[a-zß-ÿ]/.test(password) },
    { id: "digit", label: "Um número", ok: /\d/.test(password) },
    { id: "symbol", label: "Um símbolo (ex.: ! @ # $ % & *)", ok: /[^A-Za-zÀ-ÿ0-9\s]/.test(password) },
    { id: "repeat", label: "Sem o mesmo caractere 3 vezes seguidas", ok: password.length > 0 && !/(.)\1\1/.test(password) },
    { id: "personal", label: "Não contém o nome nem o e-mail", ok: password.length > 0 && !personal.some((part) => p.includes(part)) },
    { id: "common", label: "Não é uma senha comum", ok: password.length > 0 && !COMMON.some((c) => p.includes(c)) },
  ];
}

export function isStrongPassword(password: string, ctx: { name?: string; email?: string } = {}) {
  return passwordChecks(password, ctx).every((c) => c.ok);
}

/** Senha aleatória de 16 caracteres que sempre passa na política (crypto.getRandomValues). */
export function generatePassword(): string {
  const sets = ["ABCDEFGHJKMNPQRSTUVWXYZ", "abcdefghjkmnpqrstuvwxyz", "23456789", "!@#$%&*?-_+="];
  const all = sets.join("");
  const rand = (n: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  };
  for (;;) {
    const chars = sets.map((s) => s[rand(s.length)]);
    while (chars.length < 16) chars.push(all[rand(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const pwd = chars.join("");
    if (isStrongPassword(pwd)) return pwd;
  }
}
