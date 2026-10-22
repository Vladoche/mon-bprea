import { describe, expect, it } from 'vitest';
import { validateAuthConfiguration } from '../../assets/supabase-client.js';

const localPage = 'http://127.0.0.1:4173/mon-bprea/connexion.html';
const configuration = {
  enabled: true, environment: 'development',
  url: 'https://auth-test.supabase.co', publishableKey: 'sb_publishable_fixture_only',
  siteUrl: 'http://127.0.0.1:4173/mon-bprea/',
};

describe('configuration publique du client Supabase', () => {
  it('reste désactivée tant qu’aucun environnement explicite n’est prêt', () => {
    expect(validateAuthConfiguration(null, localPage)).toBe('unconfigured');
    expect(validateAuthConfiguration({ enabled: false }, localPage)).toBe('unconfigured');
  });

  it('accepte le développement local et une production HTTPS sur le préfixe réel', () => {
    expect(validateAuthConfiguration(configuration, localPage)).toBeNull();
    expect(validateAuthConfiguration({ ...configuration, url: 'http://127.0.0.1:54321' }, localPage)).toBeNull();
    expect(validateAuthConfiguration({ ...configuration, environment: 'production', siteUrl: 'https://vladoche.github.io/mon-bprea/' },
      'https://vladoche.github.io/mon-bprea/profil.html')).toBeNull();
  });

  it.each([
    { publishableKey: 'sb_secret_fixture_must_never_be_used' },
    { publishableKey: 'eyJ.fixture-legacy-jwt' },
    { environment: 'unknown' },
    { url: 'http://auth-test.supabase.co' },
    { url: 'https://user:password@auth-test.supabase.co' },
    { url: 'https://auth-test.supabase.co/?access_token=fixture' },
    { url: 'https://auth-test.supabase.co/path' },
    { siteUrl: 'http://127.0.0.1:4173/' },
    { siteUrl: 'http://127.0.0.1:4173/mon-bprea/?next=elsewhere' },
    { siteUrl: 'https://unrelated.example.invalid/mon-bprea/' },
    { environment: 'production' },
  ])('refuse une configuration dangereuse ou un retour hors du site (%j)', patch => {
    expect(validateAuthConfiguration({ ...configuration, ...patch }, localPage)).toBe('invalid');
  });
});
