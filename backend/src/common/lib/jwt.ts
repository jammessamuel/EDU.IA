export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatória em produção. Configure no arquivo .env');
  }
  return secret ?? 'dev-jwt-secret-not-for-production';
}
