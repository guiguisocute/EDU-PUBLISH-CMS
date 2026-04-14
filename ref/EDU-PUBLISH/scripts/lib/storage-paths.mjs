const MEDIA_PREFIXES = Object.freeze(['attachments', 'img', 'covers']);

const MEDIA_PREFIX_SET = new Set(MEDIA_PREFIXES);

const safeDecodeUriComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeSitePath = (siteUrl) => {
  const clean = String(siteUrl || '').trim().replace(/\\/g, '/');
  if (!clean.startsWith('/')) {
    throw new Error(`Site URL must start with '/': ${siteUrl}`);
  }

  const segments = clean.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Site URL is empty: ${siteUrl}`);
  }

  const prefix = segments[0];
  if (!MEDIA_PREFIX_SET.has(prefix)) {
    throw new Error(`Unsupported media prefix: ${prefix}`);
  }

  return segments.map((segment) => {
    const decoded = safeDecodeUriComponent(segment);
    if (!decoded || decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
      throw new Error(`Invalid media path segment: ${segment}`);
    }
    return decoded;
  });
};

const normalizePublicBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const siteUrlToStorageKey = (siteUrl) => normalizeSitePath(siteUrl)
  .map((segment) => encodeURIComponent(segment))
  .join('/');

const siteUrlToStoragePublicUrl = (siteUrl, publicBaseUrl) => {
  const base = normalizePublicBaseUrl(publicBaseUrl);
  if (!base) {
    throw new Error('Storage public base URL is required');
  }
  return `${base}/${siteUrlToStorageKey(siteUrl)}`;
};

export {
  MEDIA_PREFIXES,
  normalizePublicBaseUrl,
  siteUrlToStorageKey,
  siteUrlToStoragePublicUrl,
};
