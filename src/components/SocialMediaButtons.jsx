import React, { useState } from 'react';
import { ExternalLink, Search, Copy, Check, Plus, MessageCircle } from 'lucide-react';
import { 
  buildInstagramUrl, 
  buildInstagramSearchUrl,
  buildFacebookUrl, 
  buildFacebookSearchUrl,
  buildTikTokUrl, 
  buildTikTokSearchUrl,
  buildWhatsAppUrl, 
  formatSocialHandle 
} from '../socialUtils';

// Ícone oficial Instagram
export const InstagramIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

// Ícone oficial Facebook
export const FacebookIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// Ícone oficial TikTok
export const TikTokIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

// Ícone oficial WhatsApp
export const WhatsAppIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/**
 * Componente de Botões de Redes Sociais no Perfil do Cliente
 * Suporta o modo 'pills' (para o cabeçalho) e 'cards' (para a seção de detalhes)
 */
export const SocialMediaButtons = ({ client = {}, variant = 'pills', onEditSocial }) => {
  const [copiedKey, setCopiedKey] = useState(null);

  const rawInsta = client['Instagram'] || client['INSTAGRAM'] || '';
  const rawFace = client['Facebook'] || client['FACEBOOK'] || '';
  const rawTikTok = client['TikTok'] || client['TIKTOK'] || '';
  const rawWhats = client['WhatsApp'] || client['TELEFONE'] || client['TELEFONE CLIENTE'] || client['Celular'] || '';

  const clientName = client['Nome Completo'] || client['NOME'] || '';

  const instaUrl = buildInstagramUrl(rawInsta);
  const instaSearchUrl = buildInstagramSearchUrl(rawInsta || clientName);

  const faceUrl = buildFacebookUrl(rawFace);
  const faceSearchUrl = buildFacebookSearchUrl(rawFace || clientName);

  const tikTokUrl = buildTikTokUrl(rawTikTok);
  const tikTokSearchUrl = buildTikTokSearchUrl(rawTikTok || clientName);

  const whatsUrl = buildWhatsAppUrl(rawWhats);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch (e) {
      console.warn('Erro ao copiar URL:', e);
    }
  };

  const hasAnySocial = Boolean(instaUrl || faceUrl || tikTokUrl || whatsUrl);

  if (!hasAnySocial) {
    if (variant === 'pills') {
      return (
        <button
          type="button"
          onClick={onEditSocial}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-slate-400 bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 transition-all"
          title="Cadastrar redes sociais do cliente"
        >
          <Plus size={12} className="text-pink-400" />
          <span>Cadastrar Redes Sociais</span>
        </button>
      );
    }
    return (
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
        <p className="text-xs text-slate-500 italic">Nenhuma rede social cadastrada para este cliente.</p>
        {onEditSocial && (
          <button
            type="button"
            onClick={onEditSocial}
            className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1"
          >
            <Plus size={13} /> Adicionar Redes
          </button>
        )}
      </div>
    );
  }

  // Modo 'pills' (para o cabeçalho)
  if (variant === 'pills') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {instaUrl && (
          <a
            href={instaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-amber-500/20 hover:from-pink-500/30 hover:via-purple-500/30 hover:to-amber-500/30 text-pink-300 border border-pink-500/40 hover:border-pink-400 shadow-sm transition-all hover:scale-105 active:scale-95 group"
            title={`Abrir perfil no Instagram: ${rawInsta}`}
          >
            <InstagramIcon size={14} className="text-pink-400 group-hover:rotate-6 transition-transform" />
            <span>Instagram</span>
            <span className="text-[10px] text-pink-200/80 font-normal">
              {formatSocialHandle(rawInsta, '@')}
            </span>
            <ExternalLink size={11} className="text-pink-400/80 ml-0.5" />
          </a>
        )}

        {faceUrl && (
          <a
            href={faceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 hover:border-blue-400 shadow-sm transition-all hover:scale-105 active:scale-95 group"
            title={`Abrir perfil no Facebook: ${rawFace}`}
          >
            <FacebookIcon size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
            <span>Facebook</span>
            <span className="text-[10px] text-blue-200/80 font-normal truncate max-w-[100px]">
              {formatSocialHandle(rawFace, '')}
            </span>
            <ExternalLink size={11} className="text-blue-400/80 ml-0.5" />
          </a>
        )}

        {tikTokUrl && (
          <a
            href={tikTokUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-black/60 hover:bg-black/80 text-rose-300 border border-rose-500/40 hover:border-cyan-400/50 shadow-sm transition-all hover:scale-105 active:scale-95 group"
            title={`Abrir perfil no TikTok: ${rawTikTok}`}
          >
            <TikTokIcon size={14} className="text-rose-400 group-hover:text-cyan-400 transition-colors" />
            <span>TikTok</span>
            <span className="text-[10px] text-rose-200/80 font-normal">
              {formatSocialHandle(rawTikTok, '@')}
            </span>
            <ExternalLink size={11} className="text-rose-400/80 ml-0.5" />
          </a>
        )}

        {whatsUrl && (
          <a
            href={whatsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 shadow-sm transition-all hover:scale-105 active:scale-95 group"
            title={`Conversar com o cliente no WhatsApp: ${rawWhats}`}
          >
            <WhatsAppIcon size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>WhatsApp</span>
            <ExternalLink size={11} className="text-emerald-400/80 ml-0.5" />
          </a>
        )}
      </div>
    );
  }

  // Modo 'cards' (painel detalhado com link simplificado e busca integrada)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      
      {/* ─── CARD INSTAGRAM ─── */}
      {instaUrl ? (
        <div className="bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-transparent border border-pink-500/30 hover:border-pink-500/60 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                <InstagramIcon size={15} className="text-pink-400" /> Instagram
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(instaUrl, 'insta')}
                title="Copiar link do perfil"
                className="text-[10px] text-pink-300/80 hover:text-white flex items-center gap-1 bg-pink-500/10 hover:bg-pink-500/20 px-1.5 py-0.5 rounded transition-all"
              >
                {copiedKey === 'insta' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                <span>{copiedKey === 'insta' ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
            <p className="text-sm font-black text-white truncate mb-1">
              {formatSocialHandle(rawInsta, '@')}
            </p>
            <p className="text-[10px] text-pink-300/80 font-mono truncate mb-3 select-all bg-black/40 px-2 py-1 rounded-lg border border-pink-500/20" title={instaUrl}>
              {instaUrl}
            </p>
          </div>

          <div className="space-y-1.5">
            <a
              href={instaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-gradient-to-r from-pink-500/30 to-purple-500/30 hover:from-pink-500/40 hover:to-purple-500/40 text-white border border-pink-500/50 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <span>Acessar Perfil Direto</span>
              <ExternalLink size={12} />
            </a>
            {instaSearchUrl && (
              <a
                href={instaSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                title="Buscar no Instagram caso o perfil tenha mudado"
              >
                <Search size={11} className="text-pink-400" />
                <span>Buscar no Instagram</span>
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-4 flex flex-col justify-between opacity-60">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mb-2">
            <InstagramIcon size={14} /> Instagram
          </div>
          <p className="text-xs text-slate-500 italic mb-3">Não informado</p>
          {onEditSocial && (
            <button
              type="button"
              onClick={onEditSocial}
              className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-all"
            >
              + Adicionar
            </button>
          )}
        </div>
      )}

      {/* ─── CARD FACEBOOK ─── */}
      {faceUrl ? (
        <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 hover:border-blue-500/60 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <FacebookIcon size={15} className="text-blue-400" /> Facebook
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(faceUrl, 'face')}
                title="Copiar link do perfil"
                className="text-[10px] text-blue-300/80 hover:text-white flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded transition-all"
              >
                {copiedKey === 'face' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                <span>{copiedKey === 'face' ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
            <p className="text-sm font-black text-white truncate mb-1">
              {formatSocialHandle(rawFace, '')}
            </p>
            <p className="text-[10px] text-blue-300/80 font-mono truncate mb-3 select-all bg-black/40 px-2 py-1 rounded-lg border border-blue-500/20" title={faceUrl}>
              {faceUrl}
            </p>
          </div>

          <div className="space-y-1.5">
            <a
              href={faceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-blue-500/25 hover:bg-blue-500/35 text-white border border-blue-500/50 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <span>Acessar Perfil Direto</span>
              <ExternalLink size={12} />
            </a>
            {faceSearchUrl && (
              <a
                href={faceSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                title="Pesquisar este nome no Facebook"
              >
                <Search size={11} className="text-blue-400" />
                <span>Buscar no Facebook</span>
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-4 flex flex-col justify-between opacity-60">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mb-2">
            <FacebookIcon size={14} /> Facebook
          </div>
          <p className="text-xs text-slate-500 italic mb-3">Não informado</p>
          {onEditSocial && (
            <button
              type="button"
              onClick={onEditSocial}
              className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-all"
            >
              + Adicionar
            </button>
          )}
        </div>
      )}

      {/* ─── CARD TIKTOK ─── */}
      {tikTokUrl ? (
        <div className="bg-gradient-to-br from-rose-500/10 via-cyan-500/5 to-transparent border border-rose-500/30 hover:border-cyan-400/50 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <TikTokIcon size={15} className="text-rose-400" /> TikTok
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(tikTokUrl, 'tiktok')}
                title="Copiar link do perfil"
                className="text-[10px] text-rose-300/80 hover:text-white flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded transition-all"
              >
                {copiedKey === 'tiktok' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                <span>{copiedKey === 'tiktok' ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
            <p className="text-sm font-black text-white truncate mb-1">
              {formatSocialHandle(rawTikTok, '@')}
            </p>
            <p className="text-[10px] text-rose-300/80 font-mono truncate mb-3 select-all bg-black/40 px-2 py-1 rounded-lg border border-rose-500/20" title={tikTokUrl}>
              {tikTokUrl}
            </p>
          </div>

          <div className="space-y-1.5">
            <a
              href={tikTokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-gradient-to-r from-rose-500/25 to-cyan-500/20 hover:from-rose-500/35 hover:to-cyan-500/30 text-white border border-rose-500/50 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <span>Acessar Perfil Direto</span>
              <ExternalLink size={12} />
            </a>
            {tikTokSearchUrl && (
              <a
                href={tikTokSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                title="Pesquisar este usuário no TikTok"
              >
                <Search size={11} className="text-rose-400" />
                <span>Buscar no TikTok</span>
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-4 flex flex-col justify-between opacity-60">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mb-2">
            <TikTokIcon size={14} /> TikTok
          </div>
          <p className="text-xs text-slate-500 italic mb-3">Não informado</p>
          {onEditSocial && (
            <button
              type="button"
              onClick={onEditSocial}
              className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-all"
            >
              + Adicionar
            </button>
          )}
        </div>
      )}

    </div>
  );
};

export default SocialMediaButtons;
