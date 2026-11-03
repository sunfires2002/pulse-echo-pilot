/* Separate, memory-only Supabase recovery client. No matches or admin backend. */
(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = text => { $('status').textContent = text; };
  let input = window.PULSE_RECOVERY_INPUT;
  delete window.PULSE_RECOVERY_INPUT;
  let client, verifiedId = null, busy = false;
  const invalidLink = 'リンクを確認できません。使用済み・期限切れ・不正なリンクの可能性があります。新しい再設定メールを送ってください。';
  const disableRecovery = () => { verifiedId = null; $('save').disabled = true; $('resetSection').hidden = true; $('resetForm').reset(); };
  async function discardSession() {
    try { if (client) await client.auth.signOut({scope:'local'}); return true; } catch { return false; }
  }
  function safeError(error, saving = false) {
    // Never show raw provider messages, URLs, email addresses, or response bodies.
    if (error?.status === 429 || ['over_request_rate_limit','over_email_send_rate_limit'].includes(error?.code)) return '送信・操作の回数制限です。時間を置いてからやり直してください。';
    if (saving && error?.code === 'same_password') return '現在とは異なる新しいパスワードを入力してください。';
    if (saving && error?.code === 'weak_password') return 'パスワードが検証用プロジェクトの条件を満たしていません。別の強いパスワードを入力してください。';
    return saving ? '保存できませんでした。結果は未確認です。再送信せず、新しいパスワードでAuth診断を確認してください。認証期限切れの場合はメールを再発行してください。' : '処理できませんでした。接続先の設定・通信状態を確認し、時間を置いてやり直してください。';
  }
  try {
    if (location.origin !== 'http://127.0.0.1:8082' || !input) throw new Error('CONFIG');
    const cfg = window.PULSE_ADMIN_LAB_CONFIG, url = new URL(cfg.supabaseUrl);
    if (cfg.mode !== 'supabase' || !/^[a-z0-9]{20}$/.test(cfg.testProjectRef) ||
        url.origin !== `https://${cfg.testProjectRef}.supabase.co` || url.href !== url.origin + '/' ||
        url.hostname === 'bxailsvrusrbjmbhlpqh.supabase.co' ||
        !/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(cfg.publishableKey)) throw new Error('CONFIG');
    const guardedFetch = (resource, init) => {
      const target = new URL(typeof resource === 'string' ? resource : resource.url);
      const method = (init?.method || resource.method || 'GET').toUpperCase();
      const allowed = target.origin === url.origin && !target.username && !target.password && (
        (target.pathname === '/auth/v1/recover' && method === 'POST' &&
          target.searchParams.get('redirect_to') === location.origin + location.pathname) ||
        (target.pathname === '/auth/v1/token' && method === 'POST' && target.search === '?grant_type=refresh_token') ||
        (target.pathname === '/auth/v1/user' && ['GET','PUT'].includes(method) && !target.search) ||
        (target.pathname === '/auth/v1/logout' && method === 'POST' && target.search === '?scope=local'));
      if (!allowed) return Promise.reject(new Error('BLOCKED'));
      return fetch(resource, {...init, redirect:'error', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(15000)});
    };
    if (!window.supabase) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.referrerPolicy = 'no-referrer'; script.onload = resolve; script.onerror = () => reject(new Error('SDK'));
      document.head.append(script);
    });
    client = window.supabase.createClient(url.origin, cfg.publishableKey, {
      global:{fetch:guardedFetch},
      auth:{storageKey:'pulse_echo_admin_recovery_memory_v1', persistSession:false,
        autoRefreshToken:false, detectSessionInUrl:false, flowType:'implicit'}
    });
    $('requestSection').hidden = false;
    const fragment = new URLSearchParams(input.hash.replace(/^#/, ''));
    const query = new URLSearchParams(input.search);
    const hasLink = Boolean(input.hash || input.search);
    input = null;
    if (hasLink) {
      status('認証リンクを検証しています。');
      const token = fragment.get('access_token'), refresh = fragment.get('refresh_token');
      if (query.size || fragment.has('error') || fragment.has('error_code') || fragment.get('type') !== 'recovery' || !token || !refresh) {
        fragment.forEach((_v,k) => fragment.set(k, '')); status(invalidLink);
      } else {
        let result;
        try {
          result = await client.auth.setSession({access_token:token, refresh_token:refresh});
          if (result.error || !result.data.session) throw new Error('LINK');
          const checked = await client.auth.getUser();
          if (checked.error || !checked.data.user || checked.data.user.id !== result.data.session.user.id) throw new Error('LINK');
          verifiedId = checked.data.user.id;
          $('resetSection').hidden = false; $('requestSection').hidden = true; $('save').disabled = false;
          status('リンクを確認しました。新しいパスワードを入力してください。'); $('password').focus();
        } catch {
          disableRecovery(); await discardSession(); status(invalidLink);
        } finally { fragment.forEach((_v,k) => fragment.set(k, '')); result = null; }
      }
    } else status('まだ再設定メールを送信していません。検証用アカウントのメールアドレスを入力してください。');
    $('requestForm').addEventListener('submit', async event => {
      event.preventDefault(); if (busy || event.isComposing) return;
      busy = true; $('send').disabled = true;
      try {
        const {error} = await client.auth.resetPasswordForEmail($('email').value.trim(), {redirectTo:location.origin + location.pathname});
        if (error) throw error;
        $('requestForm').reset(); status('送信要求を受け付けました。登録済みアカウントの場合、再設定メールが届きます。最新のメールをこのMacで開いてください。');
      } catch (error) { status(safeError(error)); }
      finally { busy = false; $('send').disabled = false; }
    });
    $('resetForm').addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !verifiedId || event.isComposing) return;
      if ($('password').value !== $('confirm').value) { status('確認用パスワードが一致しません。'); return; }
      busy = true; $('save').disabled = true;
      let saved = false;
      try {
        const checked = await client.auth.getUser();
        if (checked.error || checked.data.user?.id !== verifiedId) {
          disableRecovery(); $('requestSection').hidden = false; await discardSession(); status(invalidLink); return;
        }
        const {data, error} = await client.auth.updateUser({password:$('password').value});
        if (error) throw error;
        if (data.user?.id !== verifiedId) throw new Error('IDENTITY');
        saved = true; disableRecovery();
        const {error:logoutError} = await client.auth.signOut({scope:'local'});
        status(logoutError ? 'パスワードは保存されました。再設定セッションの終了確認に失敗しました。このタブを閉じてからAuth診断を行ってください。' : 'パスワードを保存し、再設定セッションを終了しました。UUIDは維持されています。タブを閉じてAuth診断を実行してください。');
      } catch (error) {
        if (saved) status('パスワードは保存されました。このタブを閉じてからAuth診断を行ってください。');
        else { status(safeError(error, true));
          if (!['weak_password','same_password'].includes(error?.code)) { disableRecovery(); $('requestSection').hidden = false; await discardSession(); }
        }
      } finally { busy = false; $('save').disabled = !verifiedId; }
    });
    // Do not submit an IME conversion Enter as a password-save action.
    for (const form of [$('requestForm'), $('resetForm')]) form.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229)) event.preventDefault();
    });
    addEventListener('pagehide', () => { disableRecovery(); client = null; });
    addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  } catch {
    input = null; disableRecovery(); status('検証用の接続設定を確認できません。8082の専用サーバーとローカル設定を確認してください。接続は停止しました。');
  }
})();
