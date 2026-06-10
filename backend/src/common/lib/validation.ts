// ============================================================
// validation.ts — validações reaproveitáveis (usadas na matrícula).
// ============================================================

/** Mantém só os dígitos de uma string. */
export function onlyDigits(s: string): string {
  return (s ?? '').replace(/\D/g, '');
}

/**
 * Valida um CPF pelos dois dígitos verificadores.
 * Rejeita tamanho errado e sequências repetidas (000…, 111…, etc.).
 */
export function isValidCpf(cpf: string): boolean {
  const c = onlyDigits(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;

  const digito = (base: string, fatorInicial: number) => {
    let soma = 0;
    let fator = fatorInicial;
    for (const ch of base) soma += Number(ch) * fator--;
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = digito(c.slice(0, 9), 10);
  if (d1 !== Number(c[9])) return false;
  const d2 = digito(c.slice(0, 10), 11);
  return d2 === Number(c[10]);
}

/** Formata CPF como 000.000.000-00 (se tiver 11 dígitos). */
export function formatCpf(cpf: string): string {
  const c = onlyDigits(cpf);
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test((email ?? '').trim());
}

/** Converte 'YYYY-MM-DD' ou 'DD/MM/YYYY' (ou ISO) em Date; null se inválida. */
export function parseDate(input: string): Date | null {
  if (!input) return null;
  const s = input.trim();
  let y: number, m: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    [y, m, d] = s.slice(0, 10).split('-').map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    [d, m, y] = s.split('/').map(Number);
  } else {
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Idade em anos a partir de uma data de nascimento. null se inválida. */
export function calcAge(birth: string | Date): number | null {
  const dt = birth instanceof Date ? birth : parseDate(birth);
  if (!dt) return null;
  const now = new Date();
  let age = now.getFullYear() - dt.getFullYear();
  const mDiff = now.getMonth() - dt.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < dt.getDate())) age--;
  return age;
}
