import { getAuthService } from './auth-service.js';

export async function initAuthHeader(root) {
  if (!root) return;
  root.innerHTML = '<a class="account-link" href="connexion.html">Connexion</a>';
  const service = await getAuthService();
  service.subscribe(state => {
    root.replaceChildren();
    const link = document.createElement('a');
    link.className = 'account-link';
    link.href = state.status === 'authenticated' ? 'profil.html' : 'connexion.html';
    link.textContent = state.status === 'authenticated' ? 'Mon profil' : 'Connexion';
    root.append(link);
    if (state.status === 'authenticated') {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'account-signout'; button.textContent = 'Déconnexion';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await service.signOut(); }
        catch (error) { button.disabled = false; output.textContent = error.message; }
      });
      root.append(button);
    }
    const output = document.createElement('span');
    output.className = 'account-feedback'; output.setAttribute('role', 'alert');
    root.append(output);
  });
}
