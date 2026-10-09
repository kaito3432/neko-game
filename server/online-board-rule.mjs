import './engine-environment.mjs';
import '../engine.js';

// The queue currently uses one board. Future queues can select another rule ID.
export const ONLINE_BOARD_RULE_ID='challenge_5x6';
export const ONLINE_ENGINE=globalThis.NyanEngine.createForRule(ONLINE_BOARD_RULE_ID);
