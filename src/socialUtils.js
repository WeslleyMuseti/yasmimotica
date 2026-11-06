/**
 * Utilitários de higienização e geração de links diretos para Redes Sociais
 * Suporta formatos de @handle, nome de usuário, links parciais, URLs completas e busca por nome.
 */

export const buildInstagramUrl = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    if (clean.includes('instagram.com/') && !clean.includes('www.instagram.com/')) {
      return clean.replace('instagram.com/', 'www.instagram.com/');
    }
    return clean;
  }
  if (clean.toLowerCase().includes('instagram.com/')) {
    const path = clean.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^instagram\.com\/?/i, '');
    return `https://www.instagram.com/${path}`;
  }
  if (clean.includes(' ')) {
    return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(clean)}`;
  }
  const username = clean.replace(/^@/, '').replace(/\/+$/, '').trim();
  return username ? `https://www.instagram.com/${username}/` : '';
};

export const buildInstagramSearchUrl = (query) => {
  if (!query) return '';
  const clean = String(query).replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, '').replace(/^@/, '').replace(/\/+$/, '').trim();
  return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(clean)}`;
};

export const buildFacebookUrl = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    if (clean.includes('facebook.com/') && !clean.includes('www.facebook.com/')) {
      return clean.replace('facebook.com/', 'www.facebook.com/');
    }
    return clean;
  }
  if (clean.toLowerCase().includes('facebook.com/')) {
    const path = clean.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^facebook\.com\/?/i, '');
    return `https://www.facebook.com/${path}`;
  }
  if (clean.includes(' ')) {
    return `https://www.facebook.com/search/people/?q=${encodeURIComponent(clean)}`;
  }
  const username = clean.replace(/^@/, '').replace(/\/+$/, '').trim();
  return username ? `https://www.facebook.com/${username}` : '';
};

export const buildFacebookSearchUrl = (query) => {
  if (!query) return '';
  const clean = String(query).replace(/^https?:\/\/(www\.)?facebook\.com\/?/i, '').replace(/^@/, '').replace(/\/+$/, '').trim();
  return `https://www.facebook.com/search/people/?q=${encodeURIComponent(clean)}`;
};

export const buildTikTokUrl = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim();
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    if (clean.includes('tiktok.com/') && !clean.includes('www.tiktok.com/')) {
      return clean.replace('tiktok.com/', 'www.tiktok.com/');
    }
    return clean;
  }
  if (clean.toLowerCase().includes('tiktok.com/')) {
    const path = clean.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^tiktok\.com\/?/i, '');
    const formatted = path.startsWith('@') ? path : `@${path}`;
    return `https://www.tiktok.com/${formatted}`;
  }
  if (clean.includes(' ')) {
    return `https://www.tiktok.com/search/user?q=${encodeURIComponent(clean)}`;
  }
  const username = clean.replace(/^@/, '').replace(/\/+$/, '').trim();
  return username ? `https://www.tiktok.com/@${username}` : '';
};

export const buildTikTokSearchUrl = (query) => {
  if (!query) return '';
  const clean = String(query).replace(/^https?:\/\/(www\.)?tiktok\.com\/?/i, '').replace(/^@/, '').replace(/\/+$/, '').trim();
  return `https://www.tiktok.com/search/user?q=${encodeURIComponent(clean)}`;
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
