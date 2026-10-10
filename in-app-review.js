(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.install(root);
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const KEY = 'nyanRoomReviewV1';
  const QA_KEY = 'nyanRoomReviewQaV1';
  const DAY = 24 * 60 * 60 * 1000;
  const empty = () => ({ roomCompletedCount: 0, reviewRequestStage: 0, lastReviewRequestAt: 0, completedMatchIds: [] });
  function normalize(value) {
    const state = value && typeof value === 'object' ? value : {};
    return {
      roomCompletedCount: Number.isSafeInteger(state.roomCompletedCount) && state.roomCompletedCount >= 0 ? state.roomCompletedCount : 0,
      reviewRequestStage: Number.isInteger(state.reviewRequestStage) && state.reviewRequestStage >= 0 && state.reviewRequestStage <= 3 ? state.reviewRequestStage : 0,
      lastReviewRequestAt: Number.isFinite(state.lastReviewRequestAt) && state.lastReviewRequestAt >= 0 ? state.lastReviewRequestAt : 0,
      completedMatchIds: Array.isArray(state.completedMatchIds) ? state.completedMatchIds.filter(id => typeof id === 'string').slice(-32) : []
    };
  }
  function nextStage(state, now) {
    if (state.reviewRequestStage === 0 && state.roomCompletedCount >= 3) return 1;
    if (state.reviewRequestStage === 1 && state.roomCompletedCount >= 15 && now - state.lastReviewRequestAt >= 7 * DAY) return 2;
    if (state.reviewRequestStage === 2 && state.roomCompletedCount >= 50 && now - state.lastReviewRequestAt >= 30 * DAY) return 3;
    return 0;
  }
  function completed(state, matchId, result) {
    const current = normalize(state);
    if (!matchId || current.completedMatchIds.includes(matchId) ||
        result?.status === 'invalid' || result?.status === 'cancelled' ||
        result?.finishReason || !['cat', 'police'].includes(result?.winner)) return current;
    return { ...current, roomCompletedCount: current.roomCompletedCount + 1,
      completedMatchIds: [...current.completedMatchIds, matchId].slice(-32) };
  }
  function createController(storage, native, now = Date.now) {
    let qa = false;
    let pending = null;
    let connectionProblem = false;
    let recoveredMatchId = null;
    let requesting = false;
    const key = () => qa ? QA_KEY : KEY;
    const read = () => { try { return normalize(JSON.parse(storage.getItem(key()))); } catch (_) { return empty(); } };
    const write = state => storage.setItem(key(), JSON.stringify(normalize(state)));
    return {
      getState: read,
      connection(status) { if (['reconnecting', 'checking'].includes(status)) connectionProblem = true; },
      matched() { pending = null; connectionProblem = false; },
      recovered(matchId) { recoveredMatchId = matchId; },
      ended(session, result) {
        pending = null;
        if (session?.matchType !== 'roomMatch') return;
        const before = read();
        const after = completed(before, session.matchId, result);
        if (after.roomCompletedCount === before.roomCompletedCount) return;
        write(after);
        if (!connectionProblem && recoveredMatchId !== session.matchId) pending = session.matchId;
        recoveredMatchId = null;
      },
      async resultClosed() {
        if (!pending || requesting) return false;
        pending = null;
        if (connectionProblem) return false;
        const state = read();
        const stage = nextStage(state, now());
        if (!stage || !native) return false;
        requesting = true;
        try {
          await native.requestReview();
          write({ ...state, reviewRequestStage: stage, lastReviewRequestAt: now() });
          return true;
        } catch (_) { return false; }
        finally { requesting = false; }
      },
      enableQA() { qa = true; pending = null; connectionProblem = false; },
      disableQA() { qa = false; pending = null; },
      setQAState(state) { if (!qa) throw new Error('QA unavailable'); write(state); },
      resetQAState() { if (!qa) throw new Error('QA unavailable'); storage.removeItem(QA_KEY); }
    };
  }
  function install(win) {
    const plugin = win.Capacitor?.registerPlugin?.('NyanReview');
    const controller = createController(win.localStorage, plugin);
    win.NyanRoomReview = controller;
    win.addEventListener('nyan-online-matched', () => controller.matched());
    win.addEventListener('nyan-online-connection', event => controller.connection(event.detail?.status));
    win.addEventListener('nyan-online-ended', event => controller.ended(win.NyanOnline?.getSession(), event.detail));
    // No production control surface or production-state mutation. Available in native Debug builds only.
    plugin?.getEnvironment().then(environment => {
      if (environment?.debug !== true) return;
      controller.enableQA();
      win.NyanRoomReviewQA = {
        getState: () => controller.getState(),
        setState: state => controller.setQAState(state),
        reset: () => controller.resetQAState(),
        disable: () => { controller.disableQA(); delete win.NyanRoomReviewQA; }
      };
    }).catch(() => {});
  }
  return { empty, normalize, nextStage, completed, createController, install };
});
