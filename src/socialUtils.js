/**
 * Utilitários de higienização e geração de links diretos para Redes Sociais
 * Suporta formatos de @handle, nome de usuário, links parciais e URLs completas.
 */

export const buildInstagramUrl = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.toLowerCase().includes('instagram.com/')) {
    return `https://${clean.replace(/^https?:\/\//, '')}`;
  }
  const username = clean.replace(/^@/, '').replace(/\/+$/, '').trim();
  return username ? `https://www.instagram.com/${username}/` : '';
};

export const buildFacebookUrl = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.toLowerCase().includes('facebook.com/')) {
    return `https://${clean.replace(/^https?:\/\//, '')}`;
  }
  const username = clean.replace(/^@/, '').replace(/\/+$/, '').trim();
  return username ? `https://www.facebook.com/${username}` : '';
};

export const buildTikTokUrl = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.toLowerCase().includes('tiktok.com/')) {
    return `https://${clean.replace(/^https?:\/\//, '')}`;
  }
  const username = clean.replace(/^@/, '').replace(/\/+$/, '').trim();
  return username ? `https://www.tiktok.com/@${username}` : '';
};

export const buildWhatsAppUrl = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  const full = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
  return `https://wa.me/${full}`;
};

export const formatSocialHandle = (val, prefix = '@') => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const url = new URL(str);
      const pathParts = url.pathname.split('/').filter(Boolean);
      return pathParts.length > 0 ? `${prefix}${pathParts[pathParts.length - 1]}` : str;
    } catch {
      return str;
    }
  }
  return str.startsWith(prefix) ? str : `${prefix}${str}`;
};
