// 🔐 Keys loaded from config.js — DO NOT hardcode here!
// Make sure config.js is in your project and listed in .gitignore
const SUPABASE_URL      = window.__SERENE_CONFIG?.SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = window.__SERENE_CONFIG?.SUPABASE_ANON_KEY || '';
if (!window.supabase) {
  console.error('[Serene] Supabase CDN not loaded!');
}
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const API_BASE            = 'http://localhost:8000';
const SENTIMENT_THRESHOLD = -0.75;

/* ═══════════════ THEME ═══════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-toggle').forEach(b => {
    b.textContent = theme === 'dark' ? '🌙' : '☀️';
  });
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
}
applyTheme(localStorage.getItem('theme') || 'dark');

/* ═══════════════ TOAST ═══════════════ */
function showToast(msg, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ═══════════════ MODAL ═══════════════ */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ═══════════════ AUTH HELPERS ═══════════════ */
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  return session;
}
async function getUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.user ?? null;
}
function getDisplayName(user) {
  return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
}
function getInitial(user) { return getDisplayName(user)[0].toUpperCase(); }
function getTimeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
async function handleLogout() {
  await supabaseClient.auth.signOut();
  showToast('Signed out. Take care! 👋', 'info');
  setTimeout(() => window.location.href = 'index.html', 800);
}
async function handleGoogleAuth() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/chat.html' },
  });
  if (error) showToast(error.message, 'error');
}
function togglePassword(id, btn) {
  const input = document.getElementById(id);
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  btn.textContent = hidden ? '🙈' : '👁';
}

/* ═══════════════ SUPABASE DB ═══════════════ */
async function saveMoodEntry(userId, moodLabel, moodScore) {
  const { error } = await supabaseClient.from('mood_entries').insert({
    user_id: userId, mood_label: moodLabel,
    mood_score: moodScore, created_at: new Date().toISOString(),
  });
  if (error) console.error('[Serene] saveMoodEntry:', error);
}
async function fetchMoodHistory(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabaseClient
    .from('mood_entries')
    .select('mood_score, created_at, mood_label')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .order('created_at');
  if (error) { console.error('[Serene] fetchMoodHistory:', error); return []; }
  return data || [];
}
async function saveChatMessage(userId, sessionId, role, content, sentimentScore = null) {
  const { error } = await supabaseClient.from('chat_messages').insert({
    user_id: userId, session_id: sessionId,
    role, content, sentiment_score: sentimentScore,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('[Serene] saveChatMessage:', error);
}

async function fetchChatSessions(userId) {
  const { data, error } = await supabaseClient
    .from('chat_sessions')
    .select('id, title, created_at, mood_start, mood_end, message_count, duration_min')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.error('[Serene] fetchChatSessions:', error); return []; }
  return data || [];
}

/* ═══════════════ UTILS ═══════════════ */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ═══════════════ ROUTER ═══════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  });

  const page = document.body.dataset.page;
  const routes = {
    landing:   initLanding,
    login:     initLogin,
    signup:    initSignup,
    chat:      initChat,
    dashboard: initDashboard,
    forum:     initForum,
    progress:  initProgress,
    therapist: initTherapist,
  };

  if (routes[page]) routes[page]();
});

/* ═══════════════ LANDING ═══════════════ */
async function initLanding() {
  const user = await getUser();
  if (user) {
    const cta = document.querySelector('.btn-nav-cta');
    if (cta) { cta.textContent = 'Go to Dashboard →'; cta.href = 'dashboard.html'; }
  }
}

/* ═══════════════ LOGIN ═══════════════ */
async function initLogin() {
  const user = await getUser();
  if (user) { window.location.href = 'chat.html'; return; }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn      = document.getElementById('loginBtn');
    btn.textContent = 'Signing in...'; btn.disabled = true;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showToast(error.message, 'error');
      btn.textContent = 'Sign In'; btn.disabled = false; return;
    }
    showToast('Welcome back! ✨', 'success');
    setTimeout(() => window.location.href = 'chat.html', 600);
  });

  document.getElementById('googleBtn')?.addEventListener('click', handleGoogleAuth);
  document.getElementById('passwordToggle')?.addEventListener('click', () => {
    togglePassword('loginPassword', document.getElementById('passwordToggle'));
  });
}

/* ═══════════════ SIGNUP ═══════════════ */
async function initSignup() {
  const user = await getUser();
  if (user) { window.location.href = 'chat.html'; return; }

  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName  = document.getElementById('lastName').value.trim();
    const email     = document.getElementById('signupEmail').value;
    const password  = document.getElementById('signupPassword').value;
    const btn       = document.getElementById('signupBtn');
    btn.textContent = 'Creating account...'; btn.disabled = true;
    const { error } = await supabaseClient.auth.signUp({
      email, password,
      options: {
        data: { full_name: `${firstName} ${lastName}` },
        emailRedirectTo: window.location.origin + '/chat.html',
      },
    });
    if (error) {
      showToast(error.message, 'error');
      btn.textContent = 'Create Account ✦'; btn.disabled = false; return;
    }
    showToast('Account created! Check your email to verify 📧', 'success');
    setTimeout(() => window.location.href = 'login.html', 1500);
  });

  document.getElementById('googleBtn')?.addEventListener('click', handleGoogleAuth);
  document.getElementById('passwordToggle')?.addEventListener('click', () => {
    togglePassword('signupPassword', document.getElementById('passwordToggle'));
  });
}

/* ═══════════════════════════════════════════════════════════════
   💬 CHAT — Core state
═══════════════════════════════════════════════════════════════ */
let _currentUser      = null;
let currentUser       = null;
let _messages         = [];
let _isSending        = false;
let _ttsEnabled       = false;
let _currentSessionId = null;
let currentSessionId  = null;
const GROQ_API_KEY = window.__SERENE_CONFIG?.GROQ_API_KEY || '';

const THERAPIST_SYSTEM = `You are Serene — a warm, real, caring friend who also happens to be trained in CBT and person-centred therapy. You're not a bot, you're a companion.

HOW YOU TALK:
- Sound like a thoughtful friend, not a therapist ticking boxes
- Use natural phrases: "That sounds really hard", "Oh wow, that makes so much sense", "I get that", "Yeah, that tracks"
- Sometimes just validate without asking anything: "That's a lot to carry. I'm glad you told me."
- Be curious, not clinical. Ask ONE question if you do ask — never stack them
- Occasionally use gentle humour if the mood allows. Be human.
- NEVER start with "I understand how you feel" — it sounds robotic
- NEVER say "you are not alone" as your opener — try something more specific
- Vary how you begin every single reply. No two replies start the same way.

WHAT YOU DO:
- Reflect back what the person said, in your own words, before anything else
- Build on the whole conversation — remember what they've shared
- If they mention self-harm or crisis, respond with warmth first, then gently mention 988
- Keep replies SHORT: 2-4 sentences max. Less is more. Silence can be held.
- Don't lecture. Don't give unsolicited advice. Don't be preachy.
- Sometimes just sit with them in the feeling.

You are Serene. You genuinely care.`;

/* ═══════════════ GROQ API CALL ═══════════════ */
async function callChatAPI(message) {
  const messages = [];
  messages.push({ role: 'user', content: THERAPIST_SYSTEM });
  messages.push({ role: 'assistant', content: 'Understood. I am Serene.' });

  _messages.slice(-16).forEach(m => {
    messages.push({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text
    });
  });

  messages.push({ role: 'user', content: message });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      max_tokens: 300,
      temperature: 0.85
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq error ${res.status}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Empty response from Groq');
  return reply.trim();
}

/* ═══════════════ SEND MESSAGE ═══════════════ */
async function sendMessage() {
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const text    = input.value.trim();
  if (!text || _isSending) return;

  document.getElementById('suggestedPrompts')?.remove();
  document.getElementById('moodCheckIn')?.remove();

  appendMessage('user', text);
  input.value = '';
  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  autoResize(input);
  _isSending = true;

  const typingEl = showTypingIndicator();

  try {
    let sentimentScore = 0.5;
    try {
      const sentimentRes = await fetch('http://127.0.0.1:8000/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(2000),
      });
      const sentimentData = await sentimentRes.json();
      sentimentScore = (sentimentData.score + 1) / 2;
      if (sentimentData.score < SENTIMENT_THRESHOLD) openModal('crisisModal');
    } catch (_) { /* FastAPI not running — skip */ }

    updateSentimentBar(sentimentScore);

    const reply = await callChatAPI(text);
    removeTypingIndicator(typingEl);
    appendMessage('ai', reply);

    if (_ttsEnabled) speakText(reply);

    if (_currentUser && _currentSessionId) {
      saveChatMessage(_currentUser.id, _currentSessionId, 'user', text, sentimentScore);
      saveChatMessage(_currentUser.id, _currentSessionId, 'ai', reply);
      const userMsgCount = _messages.filter(m => m.role === 'user').length;
      if (userMsgCount === 1) {
        const title = text.length > 40 ? text.slice(0, 40) + '…' : text;
        supabaseClient.from('chat_sessions')
          .update({ title, message_count: _messages.length })
          .eq('id', _currentSessionId).then(() => loadChatHistory());
      } else {
        supabaseClient.from('chat_sessions')
          .update({ message_count: _messages.length })
          .eq('id', _currentSessionId);
      }
    }

  } catch (err) {
    console.error('[Serene] sendMessage error:', err);
    removeTypingIndicator(typingEl);
    const errMsg = err?.message?.includes('429')
      ? "I'm getting too many requests right now — give it a minute and try again! 🕐"
      : err?.message?.includes('401') || err?.message?.includes('403')
      ? "There's an API authentication issue — please check the API key in script.js."
      : "I'm having trouble reaching my AI backend right now. Please check your internet connection and try again.";
    appendMessage('ai', errMsg);
    showToast('Could not reach AI — ' + (err?.message || 'unknown error'), 'error');
  } finally {
    _isSending = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input)   { input.disabled = false; input.focus(); }
  }
}

/* ═══════════════ APPEND MESSAGE ═══════════════ */
function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const el        = document.createElement('div');
  el.className    = `message ${role}`;
  const formatted = escapeHtml(text).replace(/\n/g, '<br>');
  el.innerHTML = `
    <div class="msg-avatar">${role === 'ai' ? '🌿' : (getInitial(_currentUser) || '?')}</div>
    <div class="msg-content">
      <div class="msg-bubble">${formatted}</div>
      <div class="msg-time">${now()}</div>
    </div>`;
  container.appendChild(el);
  _messages.push({ role, text });
  container.scrollTop = container.scrollHeight;
}

/* ═══════════════ TYPING INDICATOR ═══════════════ */
function showTypingIndicator() {
  const el     = document.createElement('div');
  el.className = 'message ai';
  el.id        = 'typingIndicator';
  el.innerHTML = `
    <div class="msg-avatar">🌿</div>
    <div class="msg-content">
      <div class="msg-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  const container = document.getElementById('chatMessages');
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}
function removeTypingIndicator(el) { el?.remove(); }

/* ═══════════════ NEW CHAT / CLEAR / EXPORT ═══════════════ */
function newChat() {
  document.getElementById('chatMessages').innerHTML = '';
  _messages         = [];
  _currentSessionId = null;

  if (_currentUser) {
    supabaseClient.from('chat_sessions')
      .insert({ user_id: _currentUser.id, title: 'New Chat', created_at: new Date().toISOString() })
      .select().single()
      .then(({ data }) => {
        _currentSessionId = data?.id || crypto.randomUUID();
        currentSessionId  = _currentSessionId;
      });
  }

  const container = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = 'message ai';
  el.innerHTML = `
    <div class="msg-avatar">🌿</div>
    <div class="msg-content">
      <div class="msg-bubble">Hey 👋 I'm here and I'm listening. What's on your mind today?</div>
      <div class="msg-time">${now()}</div>
    </div>`;
  container.appendChild(el);
  showToast('New session started', 'info');
}
function confirmClearChat() {
  closeModal('clearChatModal');
  newChat();
}
function exportChat() {
  const content = _messages.map(m => `[${m.role.toUpperCase()}] ${m.text}`).join('\n\n');
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([content], { type: 'text/plain' })),
    download: `serene-session-${Date.now()}.txt`,
  });
  a.click();
  showToast('Session exported!', 'success');
}

/* ═══════════════ MOOD SELECT ═══════════════ */
function selectMood(label, score) {
  document.getElementById('moodCheckIn')?.remove();
  if (_currentUser) saveMoodEntry(_currentUser.id, label, score);
  const input = document.getElementById('chatInput');
  if (input) input.value = `I'm feeling ${label.replace(/[^\w\s]/gi, '').trim()}`;
  sendMessage();
  if (input) input.value = '';
}

/* ═══════════════ SENTIMENT BAR ═══════════════ */
function updateSentimentBar(score) {
  const fill = document.getElementById('sentimentFill');
  if (!fill) return;
  fill.style.width      = `${Math.max(0, Math.min(100, score * 100))}%`;
  fill.style.background = score > 0.6 ? 'var(--accent3)' : score > 0.35 ? 'var(--accent)' : 'var(--danger)';
}

/* ═══════════════ LOAD CHAT HISTORY (sidebar) ═══════════════ */
async function loadChatHistory() {
  if (!_currentUser) return;
  const sessions = await fetchChatSessions(_currentUser.id);
  const list = document.getElementById('chatHistoryList');
  if (!sessions.length || !list) return;
  list.innerHTML = sessions.map((s, i) => `
    <div class="chat-history-item ${i === 0 ? 'active' : ''}" onclick="loadSession('${s.id}')">
      <div class="chi-title">${s.title || 'Session'}</div>
      <div class="chi-preview">${s.mood_start ? `Mood: ${s.mood_start}` : 'No mood recorded'}</div>
      <div class="chi-time">${new Date(s.created_at).toLocaleDateString()}</div>
    </div>`).join('');
}
function loadSession(id) {
  _currentSessionId = id;
  currentSessionId  = id;
  showToast('Session selected', 'info');
}

/* ═══════════════ TTS ═══════════════ */
function toggleTTS() {
  _ttsEnabled = !_ttsEnabled;
  document.getElementById('ttsBtn')?.classList.toggle('active', _ttsEnabled);
  showToast(_ttsEnabled ? 'Read aloud enabled 🔊' : 'Read aloud disabled', 'info');
}
function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

/* ═══════════════ VOICE INPUT ═══════════════ */
function startVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice input not supported in this browser', 'error'); return; }
  const r    = new SR();
  const btn  = document.getElementById('voiceBtn');
  r.onresult = e => {
    const input = document.getElementById('chatInput');
    input.value = e.results[0][0].transcript;
    autoResize(input);
    if (btn) btn.textContent = '🎤';
  };
  r.onerror = () => { showToast('Voice input error', 'error'); if (btn) btn.textContent = '🎤'; };
  r.start();
  if (btn) btn.textContent = '🔴';
  showToast('Listening... 🎤', 'info');
}

/* ═══════════════ INIT CHAT ═══════════════ */
async function initChat() {
  const session = await requireAuth();
  if (!session) return;

  _currentUser = session.user;
  currentUser  = session.user;

  const name    = getDisplayName(_currentUser);
  const initial = getInitial(_currentUser);

  const navAvatar     = document.getElementById('navAvatar');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarName   = document.getElementById('sidebarName');
  const welcomeTime   = document.getElementById('welcomeTime');

  if (navAvatar)     navAvatar.textContent     = initial;
  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (sidebarName)   sidebarName.textContent   = name;
  if (welcomeTime)   welcomeTime.textContent   = now();

  if (!_currentSessionId) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabaseClient
        .from('chat_sessions')
        .select('id')
        .eq('user_id', _currentUser.id)
        .eq('title', 'New Chat')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existing?.id) {
        _currentSessionId = existing.id;
        currentSessionId  = existing.id;
      } else {
        const { data } = await supabaseClient
          .from('chat_sessions')
          .insert({ user_id: _currentUser.id, title: 'New Chat', created_at: new Date().toISOString() })
          .select().single();
        _currentSessionId = data?.id || crypto.randomUUID();
        currentSessionId  = _currentSessionId;
      }
    } catch (_) {
      _currentSessionId = crypto.randomUUID();
      currentSessionId  = _currentSessionId;
    }
  }

  await loadChatHistory();
  setupChatListeners();
  setupAccessibilityPanel();
  setTimeout(setupCameraButton, 500);
}

/* ═══════════════ SETUP CHAT LISTENERS ═══════════════ */
function setupChatListeners() {
  const input   = document.getElementById('chatInput');
  const prompts = document.getElementById('suggestedPrompts');

  if (_messages.length > 0 && prompts) prompts.remove();

  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input?.addEventListener('input', () => autoResize(input));

  document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('ttsBtn')?.addEventListener('click', toggleTTS);
  document.getElementById('newChatBtn')?.addEventListener('click', newChat);
  document.getElementById('clearBtn')?.addEventListener('click', () => openModal('clearChatModal'));
  document.getElementById('exportBtn')?.addEventListener('click', exportChat);
  document.getElementById('voiceBtn')?.addEventListener('click', startVoiceInput);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  document.getElementById('crisisFab')?.addEventListener('click', () => openModal('crisisModal'));
  document.getElementById('crisisModalClose')?.addEventListener('click', () => closeModal('crisisModal'));
  document.getElementById('crisisModalDismiss')?.addEventListener('click', () => closeModal('crisisModal'));

  document.getElementById('confirmClearBtn')?.addEventListener('click', confirmClearChat);
  document.getElementById('cancelClearBtn')?.addEventListener('click', () => closeModal('clearChatModal'));
  document.getElementById('clearModalClose')?.addEventListener('click', () => closeModal('clearChatModal'));

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => selectMood(btn.dataset.mood, parseInt(btn.dataset.score)));
  });

  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (input) input.value = chip.textContent;
      sendMessage();
    });
  });
}

/* ═══════════════ ACCESSIBILITY PANEL ═══════════════ */
function setupAccessibilityPanel() {
  document.getElementById('a11yToggle')?.addEventListener('click', () => {
    document.getElementById('a11yBar')?.classList.toggle('open');
  });
  document.getElementById('a11yTTS')?.addEventListener('click', toggleTTS);
  document.getElementById('a11yHighContrast')?.addEventListener('click', function () {
    this.classList.toggle('active');
    document.body.style.filter = this.classList.contains('active') ? 'contrast(1.4)' : '';
  });
  document.getElementById('a11yFontSize')?.addEventListener('click', function () {
    const sizes = ['14px', '16px', '18px', '20px'];
    const cur   = parseInt(document.body.style.fontSize) || 14;
    const idx   = sizes.findIndex(s => parseInt(s) > cur);
    document.body.style.fontSize = sizes[idx === -1 ? 0 : idx];
  });
  document.getElementById('a11yMorse')?.addEventListener('click', openMorseInput);
}

/* ═══════════════════════════════════════════════════════════════
   📊 DASHBOARD
═══════════════════════════════════════════════════════════════ */
async function initDashboard() {
  const session = await requireAuth();
  if (!session) return;

  const user = session.user;
  const name = getDisplayName(user);

  const navAvatar    = document.getElementById('navAvatar');
  const dashGreeting = document.getElementById('dashGreeting');
  const dashDate     = document.getElementById('dashDate');

  if (navAvatar)    navAvatar.textContent    = getInitial(user);
  if (dashGreeting) dashGreeting.textContent = `Good ${getTimeOfDay()}, ${name.split(' ')[0]} 🌤`;
  if (dashDate)     dashDate.textContent     = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('moodLogBtn')?.addEventListener('click', () => openModal('moodLogModal'));
  document.getElementById('moodLogModalClose')?.addEventListener('click', () => closeModal('moodLogModal'));

  let _selectedMoodScore = null;
  let _selectedMoodLabel = null;

  document.querySelectorAll('.mood-log-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-log-opt').forEach(b => {
        b.style.borderColor = 'transparent';
        b.style.background  = 'var(--bg2)';
      });
      btn.style.borderColor = 'var(--accent)';
      btn.style.background  = 'rgba(94,183,255,0.1)';
      _selectedMoodScore = parseInt(btn.dataset.score);
      _selectedMoodLabel = btn.dataset.mood;
      const saveBtn = document.getElementById('moodLogSaveBtn');
      if (saveBtn) saveBtn.disabled = false;
    });
  });

  document.getElementById('moodLogSaveBtn')?.addEventListener('click', async () => {
    if (!_selectedMoodScore) return;
    await saveMoodEntry(user.id, _selectedMoodLabel, _selectedMoodScore);
    showToast(`Mood logged: ${_selectedMoodLabel} 😊`, 'success');
    closeModal('moodLogModal');
    document.querySelectorAll('.mood-log-opt').forEach(b => {
      b.style.borderColor = 'transparent';
      b.style.background  = 'var(--bg2)';
    });
    const noteEl  = document.getElementById('moodLogNote');
    const saveBtn = document.getElementById('moodLogSaveBtn');
    if (noteEl)  noteEl.value    = '';
    if (saveBtn) saveBtn.disabled = true;
    _selectedMoodScore = null;
    _selectedMoodLabel = null;

    /* ═══ FIX #2a: Mood log ke baad dashboard stats re-render karo ═══ */
    const [freshSessions, freshMoods] = await Promise.all([
      fetchChatSessions(user.id),
      fetchMoodHistory(user.id, 30),
    ]);
    updateDashboardStats(freshMoods, freshSessions);
    buildHeatmap(freshMoods);
    buildCharts(freshMoods, freshSessions);
    buildRecentSessions(freshSessions);
  });

  const [sessions, moods] = await Promise.all([
    fetchChatSessions(user.id),
    fetchMoodHistory(user.id, 30),
  ]);

  updateDashboardStats(moods, sessions);
  buildHeatmap(moods);
  buildCharts(moods, sessions);
  buildRecentSessions(sessions);
}


function updateDashboardStats(moods, sessions) {
  const statSessions = document.getElementById('statSessions');
  const statMood     = document.getElementById('statMood');
  const statStreak   = document.getElementById('statStreak');
  const statCheckins = document.getElementById('statCheckins');

  if (statSessions) statSessions.textContent = sessions.length || '0';

  if (statMood) {
    if (moods.length) {
      const avg = (moods.reduce((s, m) => s + m.mood_score, 0) / moods.length).toFixed(1);
      statMood.textContent = avg;
    } else {
      statMood.textContent = '—';
    }
  }

  /* Streak calculate karo */
  if (statStreak) {
    const streak = calcStreak(moods);
    statStreak.textContent = streak > 0 ? `${streak} days` : '—';
  }

  /* Total check-ins count */
  if (statCheckins) statCheckins.textContent = moods.length || '0';
}

function buildRecentSessions(sessions = []) {
  const container = document.getElementById('recentSessionsList');
  if (!container) return;

  const icons = ['💬','🌅','🧘','📝','🌿','💙','🌸'];

  if (!sessions.length) {
    container.innerHTML = '<div style="color:var(--text3);font-size:0.88rem;padding:16px 0">No sessions yet — start your first chat!</div>';
    return;
  }

  const nowDate = new Date();
  function relativeDate(d) {
    const date     = new Date(d);
    const diffDays = Math.floor((nowDate - date) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  container.innerHTML = sessions.slice(0, 5).map((s, i) => `
    <div class="session-item">
      <div class="session-icon">${icons[i % icons.length]}</div>
      <div class="session-info">
        <div class="session-title">${s.title || 'Chat session'}</div>
        <div class="session-meta">
          ${relativeDate(s.created_at)}
          ${s.duration_min  ? ' · ' + s.duration_min  + ' min'      : ''}
          ${s.message_count ? ' · ' + s.message_count + ' messages' : ''}
        </div>
      </div>
    </div>`).join('');
}

function buildHeatmap(moods = []) {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;

  const nowDate   = new Date();
  const year      = nowDate.getFullYear();
  const month     = nowDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = nowDate.toLocaleString('default', { month: 'long' });

  const heading = document.querySelector('.heatmap-section h3');
  if (heading) heading.textContent = `Mood Heatmap · ${monthName} ${year}`;

  const moodByDay = {};
  moods.forEach(m => {
    const d = new Date(m.created_at);
    if (d.getMonth() === month && d.getFullYear() === year) {
      moodByDay[d.getDate()] = m.mood_score;
    }
  });

  grid.innerHTML = '';
  for (let i = 1; i <= daysInMonth; i++) {
    const cell  = document.createElement('div');
    cell.className = 'heatmap-cell';
    const score = moodByDay[i] || 0;
    if (score) cell.setAttribute('data-mood', score);
    cell.title = `${monthName} ${i}${score ? ` · Mood: ${score}/5` : ' · No entry'}`;
    if (i > nowDate.getDate()) cell.style.opacity = '0.3';
    grid.appendChild(cell);
  }
}

function buildCharts(moods = [], sessions = []) {
  const nowDate = new Date();

  const moodData    = Array(7).fill(null);
  const sessionData = Array(7).fill(0);

  for (let i = 6; i >= 0; i--) {
    const d       = new Date(nowDate);
    d.setDate(nowDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayIdx  = 6 - i;

    const dayMoods = moods.filter(m => m.created_at?.slice(0, 10) === dateStr);
    if (dayMoods.length) {
      moodData[dayIdx] = dayMoods.reduce((s, m) => s + m.mood_score, 0) / dayMoods.length;
    }

    const daySessions  = sessions.filter(s => s.created_at?.slice(0, 10) === dateStr);
    sessionData[dayIdx] = daySessions.length;
  }

  const dayLabels = Array(7).fill(null).map((_, i) => {
    const d = new Date(nowDate);
    d.setDate(nowDate.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });

  function renderBars(elId, data, c1, c2) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '';
    const validData = data.map(v => v ?? 0);
    const max       = Math.max(...validData, 1);
    validData.forEach((v, i) => {
      const bar = document.createElement('div');
      bar.className  = 'chart-bar';
      bar.style.height     = `${(v / max) * 85}%`;
      bar.style.background = v > 0
        ? `linear-gradient(180deg, ${c1}, ${c2})`
        : 'var(--bg3)';
      bar.style.minHeight  = '4px';
      bar.title = `${dayLabels[i]}: ${v > 0 ? v.toFixed(1) : 'No data'}`;
      el.appendChild(bar);
    });
  }

  renderBars('moodChart',    moodData,    'var(--accent)',  'rgba(94,183,255,0.3)');
  renderBars('sessionChart', sessionData, 'var(--accent2)', 'rgba(167,139,250,0.3)');
}

/* ═══════════════════════════════════════════════════════════════
   🌐 FORUM
═══════════════════════════════════════════════════════════════ */
let _forumUser    = null;
let _activeFilter = 'All';
let _posts        = [
  { id: 1, author: 'Maya S.',   time: '2 hours ago', flair: 'Anxiety',
    title: 'Finally understood my panic triggers!',
    body:  'After 3 months of tracking with Serene, I noticed my worst anxiety spikes always happen Sunday evenings. The AI helped me see the pattern before I ever noticed it myself.',
    upvotes: 47, comments: 12, online: true },
  { id: 2, author: 'Anon User', time: '5 hours ago', flair: 'Self-care',
    title: 'Gentle reminder: you survived 100% of your bad days',
    body:  "Just wanted to share a little encouragement for anyone who needs it today. Some days are really hard, but you're still here, still trying. That counts for everything.",
    upvotes: 134, comments: 28, online: false },
  { id: 3, author: 'Ravi K.',   time: 'Yesterday',   flair: 'Wins 🎉',
    title: '30-day streak on mood logging!',
    body:  "Hit my 30-day streak today. I never thought I'd be consistent about anything mental-health related, but the daily check-ins with Serene made it feel easy and natural.",
    upvotes: 89, comments: 19, online: true },
  { id: 4, author: 'Sam T.',    time: '2 days ago',  flair: 'Depression',
    title: 'Looking for people who understand sleep depression',
    body:  "Does anyone else sleep way too much when they're depressed? Not looking for solutions, just want to feel less alone in this.",
    upvotes: 62, comments: 34, online: false },
  { id: 5, author: 'Priya M.',  time: '3 hours ago', flair: 'Anxiety',
    title: 'Breathing exercises that actually helped me',
    body:  "Tried box breathing for the first time yesterday during a panic attack. Genuinely surprised — it actually worked. 4 counts in, hold 4, out 4, hold 4. Sharing in case it helps anyone.",
    upvotes: 38, comments: 8, online: true },
];

const ONLINE_COUNT = Math.floor(Math.random() * 40) + 15;

async function initForum() {
  const session = await requireAuth();
  if (!session) return;
  _forumUser = session.user;

  const navAvatar = document.getElementById('navAvatar');
  if (navAvatar) navAvatar.textContent = getInitial(_forumUser);

  const onlineEl = document.getElementById('forumOnlineCount');
  if (onlineEl) onlineEl.textContent = `${ONLINE_COUNT} online now`;

  const lastVisit = parseInt(localStorage.getItem('forum_last_visit') || '0');
  localStorage.setItem('forum_last_visit', Date.now().toString());

  const newCount = _posts.filter(p => {
    if (!lastVisit) return true;
    return p.time === 'Just now' || p.time.includes('hour') || p.time.includes('minute');
  }).length;

  document.querySelectorAll('.dash-badge').forEach(badge => {
    if (newCount > 0) {
      badge.textContent = newCount;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  });

  renderPosts();

  document.getElementById('newPostForm')?.addEventListener('submit', submitPost);
  document.getElementById('newPostBtn')?.addEventListener('click', () => openModal('newPostModal'));
  document.getElementById('newPostModalClose')?.addEventListener('click', () => closeModal('newPostModal'));
  document.getElementById('cancelPostBtn')?.addEventListener('click', () => closeModal('newPostModal'));

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => filterPosts(tab.dataset.filter));
  });
}

function filterPosts(flair) {
  _activeFilter = flair;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === flair);
  });
  renderPosts();
}

function renderPosts() {
  const filtered = _activeFilter === 'All'
    ? _posts
    : _posts.filter(p => p.flair === _activeFilter);

  const container = document.getElementById('forumPosts');
  if (!container) return;

  container.innerHTML = filtered.map(post => `
    <div class="forum-post">
      <div class="post-header">
        <div class="post-avatar" style="position:relative">
          ${post.author[0]}
          ${post.online ? '<span style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:var(--accent3);border:2px solid var(--surface)"></span>' : ''}
        </div>
        <div class="post-meta">
          <div class="post-author">${post.author} ${post.online ? '<span style="font-size:0.7rem;color:var(--accent3);font-weight:400">· online</span>' : ''}</div>
          <div class="post-time">${post.time || new Date(post.created_at).toLocaleDateString()}</div>
        </div>
        <div class="post-flair">${post.flair}</div>
      </div>
      <div class="post-title">${post.title}</div>
      <div class="post-body">${post.body}</div>
      <div class="post-actions">
        <button class="post-action-btn" data-post-id="${post.id}" data-action="upvote">▲ ${post.upvotes}</button>
        <button class="post-action-btn" data-post-id="${post.id}" data-action="reply">💬 ${post.comments} replies</button>
        <button class="post-action-btn" onclick="copyPostLink(${post.id})">🔗 Share</button>
        <button class="post-action-btn" style="margin-left:auto">⚑ Report</button>
      </div>
    </div>`).join('');

  container.querySelectorAll('[data-action="upvote"]').forEach(btn => {
    btn.addEventListener('click', () => upvotePost(btn, parseInt(btn.dataset.postId)));
  });
}

function upvotePost(btn, postId) {
  const post = _posts.find(p => p.id === postId);
  if (!post) return;
  post.upvotes++;
  btn.textContent = `▲ ${post.upvotes}`;
  btn.style.color = 'var(--accent)';
}

function copyPostLink(postId) {
  navigator.clipboard?.writeText(window.location.href + '#post-' + postId)
    .then(() => showToast('Link copied!', 'success'))
    .catch(() => showToast('Could not copy link', 'error'));
}

async function submitPost(e) {
  e.preventDefault();
  const title = document.getElementById('postTitle').value.trim();
  const flair = document.getElementById('postFlair').value;
  const body  = document.getElementById('postBody').value.trim();
  if (!title || !body) return;
  _posts.unshift({
    id: Date.now(), author: 'You', time: 'Just now',
    flair, title, body, upvotes: 1, comments: 0, online: true,
  });
  renderPosts();
  closeModal('newPostModal');
  document.getElementById('newPostForm').reset();
  showToast('Post published! 🎉', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   📈 PROGRESS PAGE
═══════════════════════════════════════════════════════════════ */
async function initProgress() {
  const session = await requireAuth();
  if (!session) return;

  const user = session.user;
  const navAvatar = document.getElementById('navAvatar');
  if (navAvatar) navAvatar.textContent = getInitial(user);

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  const [moods, sessions] = await Promise.all([
    fetchMoodHistory(user.id, 30),
    fetchChatSessions(user.id),
  ]);

  renderProgressCharts(moods);
  renderProgressInsights(moods);
  syncProgressStats(moods, sessions);
  syncSessionTable(sessions);
}

function syncProgressStats(moods, sessions) {
  const totalSessions = sessions.length;

  const avgMood = moods.length
    ? (moods.reduce((s, m) => s + m.mood_score, 0) / moods.length).toFixed(1)
    : null;

  const uniqueDays = new Set(moods.map(m => m.created_at?.slice(0, 10))).size;

  const nowTs = Date.now();
  const week1 = moods.filter(m => nowTs - new Date(m.created_at) < 7 * 86400000);
  const week2 = moods.filter(m => {
    const age = nowTs - new Date(m.created_at);
    return age >= 7 * 86400000 && age < 14 * 86400000;
  });
  const avg1   = week1.length ? week1.reduce((s, m) => s + m.mood_score, 0) / week1.length : 0;
  const avg2   = week2.length ? week2.reduce((s, m) => s + m.mood_score, 0) / week2.length : avg1;
  const wowPct = avg2 ? (((avg1 - avg2) / avg2) * 100).toFixed(0) : '0';
  const wowStr = wowPct >= 0 ? `↑ ${wowPct}%` : `↓ ${Math.abs(wowPct)}%`;

  const setEl = (id, text, color = null) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  };

  setEl('ps-sessions',    String(totalSessions));

  if (avgMood) {
    const moodColor = parseFloat(avgMood) >= 3.5 ? 'var(--accent3)'
      : parseFloat(avgMood) >= 2.5 ? 'var(--accent)'
      : 'var(--danger)';
    setEl('ps-avg-mood', `${avgMood} / 5`, moodColor);
  } else {
    setEl('ps-avg-mood', '— / 5');
  }

  setEl('ps-days-logged', `${uniqueDays} / 30`);
  setEl('ps-wow', wowStr, wowPct >= 0 ? 'var(--accent3)' : 'var(--danger)');
}


function syncSessionTable(sessions) {
  /* ID-based — zyada reliable */
  const tbody = document.getElementById('reportTableBody')
             || document.querySelector('.reports-table tbody');
  if (!tbody || !sessions.length) return;

  tbody.innerHTML = sessions.slice(0, 10).map(s => {
    const date    = new Date(s.created_at);
    const dateStr = isToday(date)     ? 'Today'
                  : isYesterday(date) ? 'Yesterday'
                  : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const moodScore  = s.mood_end || s.mood_start || null;
    const badgeClass = moodScore >= 4 ? 'badge-good'
                     : moodScore >= 3 ? 'badge-neutral'
                     : moodScore      ? 'badge-low'
                     : '';
    const moodDisplay = moodScore
      ? `<span class="badge-pill ${badgeClass}">${moodScore} / 5</span>`
      : '—';

    return `
      <tr>
        <td>${dateStr}</td>
        <td>${s.duration_min  ? s.duration_min  + ' min' : '—'}</td>
        <td>${s.message_count ?? '—'}</td>
        <td>${moodDisplay}</td>
        <td>${s.title || 'Session'}</td>
      </tr>`;
  }).join('');
}

function isToday(date) {
  const t = new Date();
  return date.getDate() === t.getDate()
      && date.getMonth() === t.getMonth()
      && date.getFullYear() === t.getFullYear();
}
function isYesterday(date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return date.getDate() === y.getDate()
      && date.getMonth() === y.getMonth()
      && date.getFullYear() === y.getFullYear();
}

function renderProgressCharts(moods) {
  const weeklyEl = document.getElementById('weeklyMoodChart');
  if (!weeklyEl) return;

  const dayLabels = [];
  const weekData  = [];
  const nowDate   = new Date();

  for (let i = 6; i >= 0; i--) {
    const d       = new Date(nowDate);
    d.setDate(nowDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    const dayMoods = moods.filter(m => m.created_at?.slice(0, 10) === dateStr);
    weekData.push(dayMoods.length
      ? dayMoods.reduce((s, m) => s + m.mood_score, 0) / dayMoods.length
      : null);
  }

  weeklyEl.innerHTML = '';
  weekData.forEach((v, i) => {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;flex:1';
    const heightPct = v !== null ? (v / 5) * 100 : 0;
    const color = v === null    ? 'var(--bg3)'
      : v >= 4  ? 'linear-gradient(180deg,var(--accent3),rgba(52,211,153,0.3))'
      : v >= 3  ? 'linear-gradient(180deg,var(--accent),rgba(94,183,255,0.3))'
      : 'linear-gradient(180deg,var(--danger),rgba(248,113,113,0.3))';
    col.innerHTML = `
      <div style="flex:1;width:100%;display:flex;align-items:flex-end">
        <div style="width:100%;height:${heightPct}%;background:${color};border-radius:4px 4px 0 0;transition:height 0.6s ease;min-height:4px" title="${dayLabels[i]}: ${v !== null ? v.toFixed(1)+'/5' : 'No data'}"></div>
      </div>
      <div style="font-size:0.7rem;color:var(--text3)">${dayLabels[i]}</div>
    `;
    weeklyEl.appendChild(col);
  });

  const donutEl  = document.getElementById('moodDonut');
  const legendEl = document.querySelector('.donut-legend');
  if (!donutEl) return;

  if (!moods.length) {
    donutEl.style.background = `conic-gradient(var(--accent3) 0% 35%,var(--accent) 35% 60%,var(--accent2) 60% 75%,var(--danger) 75% 100%)`;
    return;
  }

  const total  = moods.length;
  const counts = { great: 0, good: 0, okay: 0, low: 0, bad: 0 };
  moods.forEach(m => {
    if      (m.mood_score >= 5) counts.great++;
    else if (m.mood_score >= 4) counts.good++;
    else if (m.mood_score >= 3) counts.okay++;
    else if (m.mood_score >= 2) counts.low++;
    else                        counts.bad++;
  });

  const greatPct = ((counts.great + counts.good) / total * 100).toFixed(0);
  const okayPct  = (counts.okay / total * 100).toFixed(0);
  const lowPct   = (counts.low  / total * 100).toFixed(0);
  const badPct   = (counts.bad  / total * 100).toFixed(0);

  const g = parseFloat(greatPct);
  const o = g + parseFloat(okayPct);
  const l = o + parseFloat(lowPct);

  donutEl.style.background = `conic-gradient(
    var(--accent3) 0% ${g}%,
    var(--accent)  ${g}% ${o}%,
    var(--accent2) ${o}% ${l}%,
    var(--danger)  ${l}% 100%
  )`;

  if (legendEl) {
    const items = legendEl.querySelectorAll('.donut-item span:last-child');
    if (items[0]) items[0].textContent = `Great / Good — ${greatPct}%`;
    if (items[1]) items[1].textContent = `Okay — ${okayPct}%`;
    if (items[2]) items[2].textContent = `Low — ${lowPct}%`;
    if (items[3]) items[3].textContent = `Bad — ${badPct}%`;
  }
}

function renderProgressInsights(moods) {
  const insightsEl = document.getElementById('progressInsights');
  if (!insightsEl) return;

  if (!moods.length) {
    insightsEl.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;display:flex;gap:16px;align-items:flex-start">
        <div style="font-size:1.6rem;flex-shrink:0">💡</div>
        <div>
          <div style="font-weight:600;font-size:0.92rem;margin-bottom:4px">Start logging to see insights</div>
          <div style="font-size:0.85rem;color:var(--text2);line-height:1.6">Once you log a few moods and have some chat sessions, Serene will surface patterns and insights here.</div>
        </div>
      </div>`;
    return;
  }

  const insights = [];
  const nowTs    = Date.now();

  const week1 = moods.filter(m => nowTs - new Date(m.created_at) < 7 * 86400000);
  const week2 = moods.filter(m => {
    const age = nowTs - new Date(m.created_at);
    return age >= 7 * 86400000 && age < 14 * 86400000;
  });
  const avg1 = week1.length ? week1.reduce((s, m) => s + m.mood_score, 0) / week1.length : null;
  const avg2 = week2.length ? week2.reduce((s, m) => s + m.mood_score, 0) / week2.length : null;
  if (avg1 !== null && avg2 !== null) {
    const pct = (((avg1 - avg2) / avg2) * 100).toFixed(0);
    insights.push(pct >= 0
      ? { icon: '📈', title: 'Improving trend',     body: `Your mood scores are ${pct}% higher this week compared to last week. Keep it up!` }
      : { icon: '📉', title: 'Slight dip this week', body: `Your average mood dropped ${Math.abs(pct)}% vs last week. Be kind to yourself — it's okay.` });
  }

  const streak = calcStreak(moods);
  if (streak >= 3) {
    insights.push({ icon: '🔥', title: `${streak}-day streak!`, body: `You've logged your mood ${streak} days in a row. Consistency is the foundation of self-awareness.` });
  }

  const morningMoods = moods.filter(m => new Date(m.created_at).getHours() < 12);
  const eveningMoods = moods.filter(m => new Date(m.created_at).getHours() >= 17);
  if (morningMoods.length >= 3 && eveningMoods.length >= 3) {
    const mornAvg = morningMoods.reduce((s, m) => s + m.mood_score, 0) / morningMoods.length;
    const evenAvg = eveningMoods.reduce((s, m) => s + m.mood_score, 0) / eveningMoods.length;
    if (mornAvg > evenAvg + 0.5)      insights.push({ icon: '🌅', title: 'Morning person',  body: `Your mood is typically ${(mornAvg - evenAvg).toFixed(1)} points higher in the mornings. Try tackling harder things early!` });
    else if (evenAvg > mornAvg + 0.5) insights.push({ icon: '🌙', title: 'Evening peak',    body: `You tend to feel better later in the day. Plan activities you enjoy for the evenings.` });
  }

  const dayScores = Array(7).fill(null).map(() => []);
  moods.forEach(m => { const day = new Date(m.created_at).getDay(); dayScores[day].push(m.mood_score); });
  const dayAvgs      = dayScores.map(arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const lowestDayIdx = dayAvgs.reduce((best, v, i) => (v !== null && (best === -1 || v < dayAvgs[best])) ? i : best, -1);
  const dayNames     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  if (lowestDayIdx !== -1 && dayAvgs[lowestDayIdx] < 3) {
    insights.push({ icon: '🌊', title: `${dayNames[lowestDayIdx]} dip noticed`, body: `${dayNames[lowestDayIdx]}s tend to be lower mood days for you. A small self-care ritual on ${dayNames[lowestDayIdx]}s might help.` });
  }

  const overall = moods.reduce((s, m) => s + m.mood_score, 0) / moods.length;
  if (overall >= 4) insights.push({ icon: '✨', title: 'Doing really well', body: `Your average mood this month is ${overall.toFixed(1)}/5 — that's genuinely great. Whatever you're doing, keep going.` });

  if (!insights.length) insights.push({ icon: '🌱', title: 'Building your baseline', body: 'Keep logging daily — after a week of data, Serene will start surfacing meaningful patterns for you.' });

  insightsEl.innerHTML = insights.map(i => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;display:flex;gap:16px;align-items:flex-start">
      <div style="font-size:1.6rem;flex-shrink:0">${i.icon}</div>
      <div>
        <div style="font-weight:600;font-size:0.92rem;margin-bottom:4px">${i.title}</div>
        <div style="font-size:0.85rem;color:var(--text2);line-height:1.6">${i.body}</div>
      </div>
    </div>`).join('');
}

function calcStreak(moods) {
  const sortedDates = [...new Set(moods.map(m => m.created_at?.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < sortedDates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (sortedDates[i] === expected.toISOString().slice(0, 10)) streak++;
    else break;
  }
  return streak;
}

/* ═══════════════════════════════════════════════════════════════
   🩺 THERAPIST PAGE
═══════════════════════════════════════════════════════════════ */
async function initTherapist() {
  const session = await requireAuth();
  if (!session) return;

  const user = session.user;
  const navAvatar = document.getElementById('navAvatar');
  if (navAvatar) navAvatar.textContent = getInitial(user);

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  document.getElementById('connectTherapistForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('therapistCode').value.trim();
    if (!code) return;
    showToast('Connecting to therapist... 🩺', 'info');
    setTimeout(() => {
      showToast('Therapist connected successfully! They can now view your shared reports.', 'success');
      document.getElementById('connectSection').style.display = 'none';
      document.getElementById('therapistConnected').style.display = 'block';
    }, 1500);
  });

  document.getElementById('shareToggle')?.addEventListener('change', function () {
    showToast(
      this.checked
        ? 'Session sharing enabled — your therapist will see summaries'
        : 'Session sharing disabled',
      'info'
    );
  });

  document.getElementById('downloadReportBtn')?.addEventListener('click', () => {
    const content = `SERENE WELLNESS REPORT\nGenerated: ${new Date().toLocaleDateString()}\n\nMood Trend: Improving (+12% this week)\nSessions This Month: 14\nAverage Mood Score: 3.8/5\nStreak: 12 days\n\nKey Insights:\n- Best mood time: mornings\n- Anxiety pattern: Sunday evenings\n- Coping strategies used: breathing, journaling\n\nThis report was generated by Serene AI for therapeutic reference.`;
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([content], { type: 'text/plain' })),
      download: `serene-report-${new Date().toISOString().slice(0, 10)}.txt`,
    });
    a.click();
    showToast('Report downloaded!', 'success');
  });
}

/* ═══════════════════════════════════════════════════════════════
   🔴 MORSE CODE INPUT
═══════════════════════════════════════════════════════════════ */
const MORSE_MAP = {
  '.-':'A','-.-.':'C','-..':'D','.':'E','..-.':'F','--.':'G',
  '....':'H','..':'I','.---':'J','-.-':'K','.-..':'L','--':'M',
  '-.':'N','---':'O','.--.':'P','--.-':'Q','.-.':'R','...':'S',
  '-':'T','..-':'U','...-':'V','.--':'W','-..-':'X','-.--':'Y',
  '--..':'Z','-----':'0','.----':'1','..---':'2','...--':'3',
  '....-':'4','.....':'5','-....':'6','--...':'7','---..':'8',
  '----.':'9','.-.-.-':'.','--..--':',','..--..':'?',
  '-..-.':'/','...---...':'SOS',' ':' '
};

let _morseBuffer    = '';
let _morseWord      = '';
let _morseTimeout   = null;
let _morseHoldStart = null;
let _morseModal     = null;

function openMorseInput() {
  if (_morseModal) _morseModal.remove();
  _morseModal = document.createElement('div');
  _morseModal.className = 'modal-overlay open';
  _morseModal.id = 'morseModal';
  _morseModal.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div class="modal-title">·− Morse Code Input</div>
        <button class="modal-close" id="morseClose">✕</button>
      </div>
      <p style="color:var(--text2);font-size:0.85rem;margin-bottom:16px;line-height:1.6">
        <strong>Tap</strong> = dot (·) &nbsp;|&nbsp; <strong>Hold 500ms</strong> = dash (−)<br>
        <strong>Pause 1s</strong> = next letter &nbsp;|&nbsp; <strong>Pause 2s</strong> = space<br>
        Or use keyboard: <strong>Space</strong> = dot, <strong>F</strong> = dash
      </p>
      <div id="morseDisplay" style="font-family:monospace;font-size:1.8rem;letter-spacing:4px;background:var(--bg2);border-radius:10px;padding:16px;min-height:60px;text-align:center;color:var(--accent);margin-bottom:12px;word-break:break-all">·−</div>
      <div id="morseDecoded" style="font-size:1.1rem;font-weight:600;text-align:center;color:var(--text);margin-bottom:16px;min-height:28px;background:var(--bg3);border-radius:8px;padding:8px"></div>
      <div id="morseBuilt" style="font-size:0.9rem;color:var(--text2);text-align:center;margin-bottom:20px">Output: <span id="morseOutput" style="color:var(--accent3);font-weight:600"></span></div>
      <button id="morseTapBtn" style="width:100%;height:100px;border-radius:16px;background:var(--surface);border:2px solid var(--accent);color:var(--accent);font-size:1.1rem;font-weight:600;cursor:pointer;user-select:none;transition:all 0.1s;touch-action:none">
        HOLD HERE<br><span style="font-size:0.8rem;opacity:0.7">Tap = · | Hold = −</span>
      </button>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-ghost" id="morseBackspace" style="flex:1">⌫ Delete</button>
        <button class="btn btn-ghost" id="morseSpace"     style="flex:1">Space</button>
        <button class="btn btn-ghost" id="morseClear"     style="flex:1">Clear</button>
        <button class="btn btn-primary" id="morseSend"    style="flex:1.5">Send ➤</button>
      </div>
    </div>`;
  document.body.appendChild(_morseModal);
  _morseBuffer = ''; _morseWord = '';
  _updateMorseDisplay();

  document.getElementById('morseClose').onclick = closeMorseInput;
  const tapBtn = document.getElementById('morseTapBtn');
  tapBtn.addEventListener('pointerdown', morsePointerDown);
  tapBtn.addEventListener('pointerup',   morsePointerUp);
  tapBtn.addEventListener('pointerleave', morsePointerUp);
  document.addEventListener('keydown', morseKeyDown);
  document.addEventListener('keyup',   morseKeyUp);
  document.getElementById('morseBackspace').onclick = morseBackspace;
  document.getElementById('morseSpace').onclick     = () => { _morseWord += ' '; _updateMorseDisplay(); };
  document.getElementById('morseClear').onclick     = () => { _morseBuffer = ''; _morseWord = ''; _updateMorseDisplay(); };
  document.getElementById('morseSend').onclick      = morseSendToChat;
  _morseModal.addEventListener('click', e => { if (e.target === _morseModal) closeMorseInput(); });
}

function closeMorseInput() {
  document.removeEventListener('keydown', morseKeyDown);
  document.removeEventListener('keyup',   morseKeyUp);
  clearTimeout(_morseTimeout);
  _morseModal?.remove();
  _morseModal = null;
}

function morsePointerDown(e) {
  e.preventDefault();
  _morseHoldStart = Date.now();
  const btn = document.getElementById('morseTapBtn');
  if (btn) { btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; }
}
function morsePointerUp(e) {
  if (!_morseHoldStart) return;
  const duration  = Date.now() - _morseHoldStart;
  _morseHoldStart = null;
  const btn = document.getElementById('morseTapBtn');
  if (btn) { btn.style.background = 'var(--surface)'; btn.style.color = 'var(--accent)'; }
  _morseAddSymbol(duration < 500 ? '.' : '-');
}

let _morseKeyHeld = false;
function morseKeyDown(e) {
  if (_morseKeyHeld) return;
  if (e.key === ' ' || e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    _morseKeyHeld   = true;
    _morseHoldStart = Date.now();
  }
}
function morseKeyUp(e) {
  if (!_morseKeyHeld) return;
  if (e.key === ' ' || e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    _morseKeyHeld   = false;
    const duration  = Date.now() - _morseHoldStart;
    _morseHoldStart = null;
    _morseAddSymbol(duration < 500 ? '.' : '-');
  }
}

function _morseAddSymbol(sym) {
  clearTimeout(_morseTimeout);
  _morseBuffer += sym;
  _updateMorseDisplay();
  _morseTimeout = setTimeout(() => {
    _morseCommitLetter();
    _morseTimeout = setTimeout(() => {
      if (_morseWord.length && _morseWord[_morseWord.length - 1] !== ' ') {
        _morseWord += ' '; _updateMorseDisplay();
      }
    }, 1000);
  }, 1000);
}

function _morseCommitLetter() {
  if (!_morseBuffer) return;
  _morseWord  += MORSE_MAP[_morseBuffer] || '?';
  _morseBuffer = '';
  _updateMorseDisplay();
}

function morseBackspace() {
  if (_morseBuffer) _morseBuffer = _morseBuffer.slice(0, -1);
  else              _morseWord   = _morseWord.slice(0, -1);
  _updateMorseDisplay();
}

function _updateMorseDisplay() {
  const disp = document.getElementById('morseDisplay');
  const dec  = document.getElementById('morseDecoded');
  const out  = document.getElementById('morseOutput');
  if (!disp) return;
  disp.textContent = _morseBuffer || '·−';
  if (dec) dec.textContent = _morseBuffer ? (MORSE_MAP[_morseBuffer] || '?') : '';
  if (out) out.textContent = _morseWord;
}

function morseSendToChat() {
  _morseCommitLetter();
  const text  = _morseWord.trim();
  if (!text) { showToast('Nothing to send — tap some morse!', 'info'); return; }
  const input = document.getElementById('chatInput');
  if (input) { input.value = text; autoResize(input); }
  closeMorseInput();
  showToast(`Morse decoded: "${text}" ✓`, 'success');
}

/* ═══════════════════════════════════════════════════════════════
   📷 CAMERA EMOTION DETECTION
═══════════════════════════════════════════════════════════════ */
const EMOTION_TO_MOOD = {
  happy:     { label: '😊 Great',      score: 5 },
  surprised: { label: '😲 Surprised',  score: 4 },
  neutral:   { label: '😐 Okay',       score: 3 },
  fearful:   { label: '😰 Anxious',    score: 2 },
  disgusted: { label: '😤 Frustrated', score: 2 },
  sad:       { label: '😔 Low',        score: 1 },
  angry:     { label: '😠 Angry',      score: 1 },
};

let _faceApiLoaded       = false;
let _cameraStream        = null;
let _cameraModal         = null;
let _detectInterval      = null;
let _lastDetectedEmotion = null;

async function loadFaceApi() {
  if (_faceApiLoaded) return true;
  return new Promise(resolve => {
    const script   = document.createElement('script');
    script.src     = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.onload  = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        _faceApiLoaded = true;
        resolve(true);
      } catch (err) {
        console.error('[Serene] face-api model load failed:', err);
        resolve(false);
      }
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function openCameraEmotion() {
  showToast('Loading emotion detection... 📷', 'info');
  const loaded = await loadFaceApi();
  if (!loaded) {
    showToast('Could not load face detection models. Check your connection.', 'error');
    return;
  }

  if (_cameraModal) _cameraModal.remove();
  _cameraModal = document.createElement('div');
  _cameraModal.className = 'modal-overlay open';
  _cameraModal.id = 'cameraModal';
  _cameraModal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <div class="modal-title">📷 Emotion Detection</div>
        <button class="modal-close" id="cameraClose">✕</button>
      </div>
      <p style="color:var(--text2);font-size:0.85rem;margin-bottom:14px">
        Look at the camera — Serene detects your emotion and logs your mood automatically.
        Everything runs locally in your browser. No data is sent anywhere.
      </p>
      <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;margin-bottom:14px">
        <video id="cameraFeed" autoplay muted playsinline style="width:100%;display:block;border-radius:12px;transform:scaleX(-1);min-height:240px;object-fit:cover"></video>
        <canvas id="cameraCanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1)"></canvas>
        <div id="emotionOverlay" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;padding:6px 18px;border-radius:50px;font-size:0.9rem;font-weight:600;backdrop-filter:blur(8px);white-space:nowrap;transition:all 0.3s ease">Detecting...</div>
      </div>
      <div id="emotionResult" style="text-align:center;font-size:1.5rem;font-weight:700;color:var(--accent);margin-bottom:16px;min-height:40px"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="cameraCancel" style="flex:1">Cancel</button>
        <button class="btn btn-primary" id="cameraLogMood" style="flex:1.5" disabled>Log This Mood ✓</button>
      </div>
    </div>`;
  document.body.appendChild(_cameraModal);

  document.getElementById('cameraClose').onclick  = closeCameraEmotion;
  document.getElementById('cameraCancel').onclick = closeCameraEmotion;
  _cameraModal.addEventListener('click', e => { if (e.target === _cameraModal) closeCameraEmotion(); });

  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    const video   = document.getElementById('cameraFeed');
    video.srcObject = _cameraStream;
    video.addEventListener('loadeddata', () => {
      const canvas  = document.getElementById('cameraCanvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      _startEmotionDetection(video, canvas);
    });
  } catch (err) {
    showToast('Camera access denied. Please allow camera permissions.', 'error');
    closeCameraEmotion();
  }
}

function _startEmotionDetection(video, canvas) {
  const ctx            = canvas.getContext('2d');
  let emotionHistory   = [];

  _detectInterval = setInterval(async () => {
    if (!video.videoWidth) return;
    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
        .withFaceExpressions();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const overlay = document.getElementById('emotionOverlay');
      const result  = document.getElementById('emotionResult');
      const logBtn  = document.getElementById('cameraLogMood');

      if (!detections.length) {
        if (overlay) overlay.textContent = 'No face detected — move closer 👤';
        return;
      }

      const det      = detections[0];
      const exps     = det.expressions;
      const dominant = Object.entries(exps).reduce((a, b) => a[1] > b[1] ? a : b);
      const [emotion, confidence] = dominant;

      emotionHistory.push(emotion);
      if (emotionHistory.length > 5) emotionHistory.shift();
      const freq = {};
      emotionHistory.forEach(e => freq[e] = (freq[e] || 0) + 1);
      const smoothedEmotion = Object.entries(freq).reduce((a, b) => a[1] > b[1] ? a : b)[0];

      const mood = EMOTION_TO_MOOD[smoothedEmotion] || EMOTION_TO_MOOD.neutral;
      _lastDetectedEmotion = mood;

      const box = det.detection.box;
      ctx.strokeStyle = 'rgba(94,183,255,0.8)';
      ctx.lineWidth   = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      if (overlay) overlay.textContent = `${mood.label} · ${(confidence * 100).toFixed(0)}%`;
      if (result)  result.textContent  = `Detected: ${mood.label}`;
      if (logBtn) {
        logBtn.disabled    = false;
        logBtn.textContent = `Log "${mood.label}" ✓`;
        logBtn.onclick     = () => logEmotionMood(mood);
      }
    } catch (_) { /* silent */ }
  }, 500);
}

async function logEmotionMood(mood) {
  if (_currentUser) await saveMoodEntry(_currentUser.id, mood.label, mood.score);
  updateSentimentBar(mood.score / 5);
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = `I'm feeling ${mood.label.replace(/[^\w\s]/gi, '').trim()} right now`;
    autoResize(input);
  }
  closeCameraEmotion();
  showToast(`Mood logged: ${mood.label} 😊`, 'success');
}

function closeCameraEmotion() {
  clearInterval(_detectInterval);
  _detectInterval = null;
  if (_cameraStream) { _cameraStream.getTracks().forEach(t => t.stop()); _cameraStream = null; }
  _cameraModal?.remove();
  _cameraModal = null;
}

function setupCameraButton() {
  const a11yBar = document.getElementById('a11yBar');
  if (!a11yBar) return;

  if (!document.getElementById('a11yCamera')) {
    const btn       = document.createElement('button');
    btn.className   = 'a11y-btn';
    btn.id          = 'a11yCamera';
    btn.title       = 'Detect emotion from camera';
    btn.textContent = '📷';
    btn.addEventListener('click', openCameraEmotion);
    a11yBar.appendChild(btn);
  }

  if (!document.getElementById('a11ySign')) {
    const signBtn       = document.createElement('button');
    signBtn.className   = 'a11y-btn';
    signBtn.id          = 'a11ySign';
    signBtn.title       = 'Sign language input';
    signBtn.textContent = '🤟';
    signBtn.addEventListener('click', openSignLanguage);
    a11yBar.appendChild(signBtn);
  }
}

/* ═══════════════════════════════════════════════════════════════
   🤟 SIGN LANGUAGE INPUT
═══════════════════════════════════════════════════════════════ */
let _signStream = null, _signHands = null, _signCamera = null;
let _signModal = null, _signTyped = '', _signLast = '', _signHold = 0;
const SIGN_HOLD = 20;

async function openSignLanguage() {
  if (_signModal) _signModal.remove();
  _signModal = document.createElement('div');
  _signModal.className = 'modal-overlay open';
  _signModal.innerHTML = `
    <div class="modal" style="max-width:780px;width:95vw">
      <div class="modal-header">
        <div class="modal-title">🤟 Sign Language Input</div>
        <button class="modal-close" id="signClose">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px">
        <div>
          <div style="font-size:0.78rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">📷 Camera Feed</div>
          <div style="position:relative;border-radius:12px;overflow:hidden;background:#111;aspect-ratio:4/3">
            <video id="signVideo" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
            <canvas id="signCanvas" style="position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1)"></canvas>
            <div id="signBadge" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.65);color:#fff;padding:4px 12px;border-radius:50px;font-size:12px;backdrop-filter:blur(8px)">Loading...</div>
            <div id="signDetected" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;padding:4px 20px;border-radius:50px;font-size:1.8rem;font-weight:700;backdrop-filter:blur(8px);white-space:nowrap">—</div>
          </div>
          <p style="font-size:0.8rem;color:var(--text3);margin-top:8px;line-height:1.5">
            Hold a sign steady for <strong style="color:var(--text2)">${SIGN_HOLD} frames</strong> to type it.
          </p>
        </div>
        <div>
          <div style="font-size:0.78rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">✋ ASL Reference</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:320px;overflow-y:auto">
            ${[
              ['A','Fist, thumb to side'],['B','All fingers up, thumb in'],
              ['D','Index up, others curled'],['E','All curled, thumb close'],
              ['H','Index + middle sideways'],['I','Pinky only up'],
              ['K','Index + middle + ring up'],['L','Index + thumb L-shape'],
              ['O','Thumb touches index tip'],['U','Index + middle up together'],
              ['Y','Pinky + thumb out'],
            ].map(([letter, desc]) => `
              <div style="background:var(--bg2);padding:8px 10px;border-radius:8px;border:1px solid var(--border)">
                <span style="font-size:1.1rem;font-weight:700;color:var(--accent)">${letter}</span>
                <span style="color:var(--text3);display:block;font-size:0.72rem;margin-top:2px;line-height:1.3">${desc}</span>
              </div>`).join('')}
            <div style="background:var(--bg3);padding:8px 10px;border-radius:8px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center">
              <span style="color:var(--text3);font-size:0.72rem;text-align:center">More letters<br>coming soon!</span>
            </div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px 16px;margin-bottom:12px;min-height:48px">
        <span style="color:var(--text3);font-size:0.75rem;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Typed Text</span>
        <span id="signOutput" style="font-size:1.15rem;letter-spacing:3px;font-weight:600;color:var(--text)">_</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="signAddSpace()" style="flex:1">Space</button>
        <button class="btn btn-ghost" onclick="signDelete()"   style="flex:1">⌫ Delete</button>
        <button class="btn btn-ghost" onclick="signClear()"    style="flex:1">Clear</button>
        <button class="btn btn-primary" onclick="signSend()"   style="flex:1.5">Send ➤</button>
      </div>
    </div>`;

  document.body.appendChild(_signModal);
  document.getElementById('signClose').onclick = closeSignLanguage;
  _signModal.addEventListener('click', e => { if (e.target === _signModal) closeSignLanguage(); });
  _signTyped = ''; _signLast = ''; _signHold = 0;

  try {
    await _loadMediaPipe();
    await _startSignCamera();
  } catch (e) {
    console.error('[Serene] MediaPipe failed:', e);
    showToast('Could not load hand detection. Check your internet!', 'error');
    closeSignLanguage();
  }
}

async function _loadMediaPipe() {
  if (window._mpLoaded) return;

  return new Promise((resolve, reject) => {
    const badge = document.getElementById('signBadge');
    if (badge) badge.textContent = 'Loading MediaPipe...';

    let loaded  = 0;
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    ];

    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) {
        loaded++;
        if (loaded === scripts.length) { window._mpLoaded = true; resolve(); }
        return;
      }
      const s    = document.createElement('script');
      s.src      = src;
      s.onload   = () => { loaded++; if (loaded === scripts.length) { window._mpLoaded = true; resolve(); } };
      s.onerror  = (e) => reject(new Error('MediaPipe load failed — check internet connection'));
      document.head.appendChild(s);
    });
  });
}

async function _startSignCamera() {
  const video = document.getElementById('signVideo');
  const badge = document.getElementById('signBadge');

  if (!video) { showToast('Camera element not found!', 'error'); return; }

  try {
    _signStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    });

    video.srcObject = _signStream;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => { video.play().then(resolve).catch(reject); };
      setTimeout(reject, 8000);
    });

    if (badge) badge.textContent = 'Show your hand ✋';

    _signHands = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });

    _signHands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    _signHands.onResults(_onSignResults);

    const processFrame = async () => {
      if (!_signHands || !video || video.paused || video.ended) return;
      try { await _signHands.send({ image: video }); } catch (_) {}
      _signCamera = requestAnimationFrame(processFrame);
    };
    _signCamera = requestAnimationFrame(processFrame);

  } catch (e) {
    console.error('[Serene] Sign camera error:', e);
    if (badge) badge.textContent = 'Camera error!';
    showToast('Camera permission required! Please allow camera access.', 'error');
    closeSignLanguage();
  }
}

function _classifyASL(L) {
  if (!L || L.length < 21) return null;
  const ext        = i => L[i].y < L[i - 2].y;
  const idx        = ext(8), mid = ext(12), rng = ext(16), pnk = ext(20);
  const thumbExt   = L[4].x < L[3].x;
  const thumbClose = Math.hypot(L[4].x - L[8].x, L[4].y - L[8].y) < 0.06;
  const allCurled  = !idx && !mid && !rng && !pnk;

  if (allCurled && !thumbExt)                       return 'A';
  if (idx && mid && rng && pnk && thumbExt)         return 'B';
  if (thumbClose && allCurled)                      return 'O';
  if (idx && !mid && !rng && !pnk && !thumbExt)     return 'D';
  if (allCurled && thumbClose)                      return 'E';
  if (idx && mid && !rng && !pnk)                   return 'H';
  if (!idx && !mid && !rng && pnk)                  return 'I';
  if (idx && !mid && rng && pnk)                    return 'K';
  if (idx && !mid && !rng && !pnk && thumbExt)      return 'L';
  if (idx && mid && !rng && !pnk && thumbExt)       return 'U';
  if (!idx && !mid && !rng && pnk && thumbExt)      return 'Y';
  return null;
}

function _onSignResults(results) {
  const canvas = document.getElementById('signCanvas');
  const video  = document.getElementById('signVideo');
  if (!canvas || !video) return;

  if (canvas.width !== video.videoWidth) {
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
  }

  const ctx      = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const badge    = document.getElementById('signBadge');
  const detected = document.getElementById('signDetected');

  if (!results.multiHandLandmarks?.length) {
    if (detected) detected.textContent = '—';
    if (badge)    badge.textContent    = 'No hand detected — move closer ✋';
    _signHold = 0;
    return;
  }

  const lm = results.multiHandLandmarks[0];
  drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: '#5e9bff', lineWidth: 2 });
  drawLandmarks(ctx,  lm, { color: '#ffffff', lineWidth: 1, radius: 3 });

  const letter = _classifyASL(lm);
  if (detected) detected.textContent = letter || '?';

  if (letter) {
    if (letter === _signLast) {
      _signHold++;
      if (badge) badge.textContent = `"${letter}" — hold for ${SIGN_HOLD - _signHold} more frames`;
      if (_signHold >= SIGN_HOLD) {
        _signTyped += letter;
        const out = document.getElementById('signOutput');
        if (out) out.textContent = _signTyped || '_';
        showToast(`"${letter}" typed! 🤟`, 'success');
        _signHold = 0;
        _signLast = '';
      }
    } else {
      _signLast = letter;
      _signHold = 1;
    }
  } else {
    _signHold = 0;
    if (badge) badge.textContent = 'Sign not recognized — try again';
  }
}

function signAddSpace() {
  _signTyped += ' ';
  document.getElementById('signOutput').textContent = _signTyped || '_';
}
function signDelete() {
  _signTyped = _signTyped.slice(0, -1);
  document.getElementById('signOutput').textContent = _signTyped || '_';
}
function signClear() {
  _signTyped = '';
  document.getElementById('signOutput').textContent = '_';
}
function signSend() {
  const text = _signTyped.trim();
  if (!text) { showToast('Nothing typed yet!', 'info'); return; }
  const input = document.getElementById('chatInput');
  if (input) { input.value = text; autoResize(input); }
  closeSignLanguage();
  showToast('Sign language text sent to chat! 🤟', 'success');
}
function closeSignLanguage() {
  if (_signCamera) { cancelAnimationFrame(_signCamera); _signCamera = null; }
  if (_signStream) { _signStream.getTracks().forEach(t => t.stop()); _signStream = null; }
  if (_signHands)  { _signHands.close(); _signHands = null; }
  _signModal?.remove();
  _signModal = null;
}