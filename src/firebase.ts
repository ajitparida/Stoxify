import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AlgoOrderDraft,
  AlgoOrderRecord,
  AlgoRuleCondition,
  AlgoStrategyDraft,
  AlgoStrategyRecord,
  AlgoStrategyStatus,
  BacktestRunFirestoreRecord,
  BacktestRunResult,
  Exchange,
  HoldingRecord,
  HoldingSource,
  MfHoldingSource,
  MfOptionType,
  MfPlanType,
  MutualFundHoldingRecord,
  WatchlistRecord,
} from './types/market';

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      throw new Error(
        `Domain "${currentHost}" is not authorized for Firebase Sign-In. Add "${currentHost}" in Firebase Console (${firebaseConfig.projectId}) → Authentication → Settings → Authorized domains.`
      );
    }
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// Sanitization helpers matching firebase-blueprint.json boundaries
function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

function sanitizeSymbol(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_&.-]/g, '')
    .slice(0, 32);
}

function sanitizeText(raw: string, maxLength: number, fallback = 'Unknown'): string {
  const trimmed = raw.trim().slice(0, maxLength);
  return trimmed || fallback;
}

function sanitizePositiveNumber(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0.01;
  return Math.min(Number(val.toFixed(4)), 10000000);
}

function sanitizeDate(raw?: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

export function subscribeHoldings(
  userId: string,
  onData: (holdings: HoldingRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/holdings`;
  const q = query(collection(db, 'users', userId, 'holdings'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: HoldingRecord[] = snapshot.docs.map((d) => d.data() as HoldingRecord);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createHolding(
  userId: string,
  input: {
    symbol: string;
    companyName: string;
    exchange: Exchange;
    sector: string;
    quantity: number;
    avgBuyPrice: number;
    buyDate: string;
    notes?: string;
    source: HoldingSource;
  }
): Promise<string> {
  const holdingId = sanitizeId(
    `${input.symbol.replace(/\./g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const path = `users/${userId}/holdings/${holdingId}`;

  const payload = {
    id: holdingId,
    userId,
    symbol: sanitizeSymbol(input.symbol),
    companyName: sanitizeText(input.companyName, 120),
    exchange: input.exchange,
    sector: sanitizeText(input.sector, 64, 'Equities'),
    quantity: sanitizePositiveNumber(input.quantity),
    avgBuyPrice: sanitizePositiveNumber(input.avgBuyPrice),
    buyDate: sanitizeDate(input.buyDate),
    notes: input.notes ? input.notes.trim().slice(0, 300) : '',
    source: input.source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', userId, 'holdings', holdingId), payload);
    return holdingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateHolding(
  userId: string,
  holdingId: string,
  patch: {
    quantity: number;
    avgBuyPrice: number;
    buyDate: string;
    sector: string;
    notes?: string;
  }
): Promise<void> {
  const path = `users/${userId}/holdings/${holdingId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'holdings', holdingId), {
      quantity: sanitizePositiveNumber(patch.quantity),
      avgBuyPrice: sanitizePositiveNumber(patch.avgBuyPrice),
      buyDate: sanitizeDate(patch.buyDate),
      sector: sanitizeText(patch.sector, 64, 'Equities'),
      notes: patch.notes ? patch.notes.trim().slice(0, 300) : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHolding(userId: string, holdingId: string): Promise<void> {
  const path = `users/${userId}/holdings/${holdingId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'holdings', holdingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchCreateHoldings(
  userId: string,
  items: Array<{
    symbol: string;
    companyName: string;
    exchange: Exchange;
    sector: string;
    quantity: number;
    avgBuyPrice: number;
    buyDate: string;
    notes?: string;
    source: HoldingSource;
  }>
): Promise<void> {
  if (items.length === 0) return;
  const path = `users/${userId}/holdings`;
  const batch = writeBatch(db);
  const nowStamp = Date.now();

  items.forEach((input, idx) => {
    const holdingId = sanitizeId(
      `${input.symbol.replace(/\./g, '_')}_${nowStamp}_${idx}_${Math.random().toString(36).slice(2, 5)}`
    );
    const ref = doc(db, 'users', userId, 'holdings', holdingId);
    batch.set(ref, {
      id: holdingId,
      userId,
      symbol: sanitizeSymbol(input.symbol),
      companyName: sanitizeText(input.companyName, 120),
      exchange: input.exchange,
      sector: sanitizeText(input.sector, 64, 'Equities'),
      quantity: sanitizePositiveNumber(input.quantity),
      avgBuyPrice: sanitizePositiveNumber(input.avgBuyPrice),
      buyDate: sanitizeDate(input.buyDate),
      notes: input.notes ? input.notes.trim().slice(0, 300) : '',
      source: input.source,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function batchDeleteHoldings(userId: string, holdingIds: string[]): Promise<void> {
  if (holdingIds.length === 0) return;
  const path = `users/${userId}/holdings`;
  for (let i = 0; i < holdingIds.length; i += 400) {
    const chunk = holdingIds.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, 'users', userId, 'holdings', id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export function subscribeWatchlist(
  userId: string,
  onData: (items: WatchlistRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/watchlist`;
  const q = query(collection(db, 'users', userId, 'watchlist'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WatchlistRecord[] = snapshot.docs.map((d) => d.data() as WatchlistRecord);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function upsertWatchlistItem(
  userId: string,
  input: {
    symbol: string;
    companyName: string;
    exchange: Exchange;
    sector: string;
    targetAlertPrice?: number;
  }
): Promise<void> {
  const itemId = sanitizeId(input.symbol.replace(/\./g, '_'));
  const path = `users/${userId}/watchlist/${itemId}`;
  const payload = {
    id: itemId,
    userId,
    symbol: sanitizeSymbol(input.symbol),
    companyName: sanitizeText(input.companyName, 120),
    exchange: input.exchange,
    sector: sanitizeText(input.sector, 64, 'Equities'),
    targetAlertPrice:
      typeof input.targetAlertPrice === 'number' && input.targetAlertPrice >= 0
        ? Math.min(Number(input.targetAlertPrice.toFixed(2)), 10000000)
        : 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', userId, 'watchlist', itemId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeWatchlistItem(userId: string, itemId: string): Promise<void> {
  const path = `users/${userId}/watchlist/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'watchlist', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function sanitizeSchemeCode(raw: string): string {
  const cleaned = raw.replace(/[^0-9]/g, '').slice(0, 16);
  return cleaned || '122639';
}

export function subscribeMutualFunds(
  userId: string,
  onData: (items: MutualFundHoldingRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/mutualFunds`;
  const q = query(collection(db, 'users', userId, 'mutualFunds'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: MutualFundHoldingRecord[] = snapshot.docs.map(
        (d) => d.data() as MutualFundHoldingRecord
      );
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createMutualFundHolding(
  userId: string,
  input: {
    schemeCode: string;
    schemeName: string;
    fundHouse: string;
    category: string;
    planType: MfPlanType;
    optionType: MfOptionType;
    units: number;
    avgNav: number;
    purchaseDate: string;
    isSip: boolean;
    monthlySipAmount?: number;
    folioNumber?: string;
    source: MfHoldingSource;
  }
): Promise<string> {
  const fundHoldingId = sanitizeId(
    `mf_${sanitizeSchemeCode(input.schemeCode)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const path = `users/${userId}/mutualFunds/${fundHoldingId}`;

  const payload = {
    id: fundHoldingId,
    userId,
    schemeCode: sanitizeSchemeCode(input.schemeCode),
    schemeName: sanitizeText(input.schemeName, 180),
    fundHouse: sanitizeText(input.fundHouse, 100, 'Indian Mutual Fund'),
    category: sanitizeText(input.category, 80, 'Equity Scheme'),
    planType: input.planType === 'Regular' ? 'Regular' : 'Direct',
    optionType: input.optionType === 'IDCW' ? 'IDCW' : 'Growth',
    units: sanitizePositiveNumber(input.units),
    avgNav: Math.min(sanitizePositiveNumber(input.avgNav), 1000000),
    purchaseDate: sanitizeDate(input.purchaseDate),
    isSip: Boolean(input.isSip),
    monthlySipAmount:
      typeof input.monthlySipAmount === 'number' && input.monthlySipAmount > 0
        ? Math.min(Number(input.monthlySipAmount.toFixed(2)), 10000000)
        : 0,
    folioNumber: input.folioNumber ? input.folioNumber.trim().slice(0, 40) : '',
    source: input.source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', userId, 'mutualFunds', fundHoldingId), payload);
    return fundHoldingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMutualFundHolding(
  userId: string,
  fundHoldingId: string,
  patch: {
    units: number;
    avgNav: number;
    purchaseDate: string;
    isSip: boolean;
    monthlySipAmount?: number;
    folioNumber?: string;
  }
): Promise<void> {
  const path = `users/${userId}/mutualFunds/${fundHoldingId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'mutualFunds', fundHoldingId), {
      units: sanitizePositiveNumber(patch.units),
      avgNav: Math.min(sanitizePositiveNumber(patch.avgNav), 1000000),
      purchaseDate: sanitizeDate(patch.purchaseDate),
      isSip: Boolean(patch.isSip),
      monthlySipAmount:
        typeof patch.monthlySipAmount === 'number' && patch.monthlySipAmount > 0
          ? Math.min(Number(patch.monthlySipAmount.toFixed(2)), 10000000)
          : 0,
      folioNumber: patch.folioNumber ? patch.folioNumber.trim().slice(0, 40) : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMutualFundHolding(
  userId: string,
  fundHoldingId: string
): Promise<void> {
  const path = `users/${userId}/mutualFunds/${fundHoldingId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'mutualFunds', fundHoldingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchCreateMutualFundHoldings(
  userId: string,
  items: Array<{
    schemeCode: string;
    schemeName: string;
    fundHouse: string;
    category: string;
    planType: MfPlanType;
    optionType: MfOptionType;
    units: number;
    avgNav: number;
    purchaseDate: string;
    isSip: boolean;
    monthlySipAmount?: number;
    folioNumber?: string;
    source: MfHoldingSource;
  }>
): Promise<void> {
  if (items.length === 0) return;
  const path = `users/${userId}/mutualFunds`;
  const batch = writeBatch(db);
  const nowStamp = Date.now();

  items.forEach((input, idx) => {
    const schemeCode = sanitizeSchemeCode(input.schemeCode);
    const fundHoldingId = sanitizeId(
      `mf_${schemeCode}_${nowStamp}_${idx}_${Math.random().toString(36).slice(2, 5)}`
    );
    const ref = doc(db, 'users', userId, 'mutualFunds', fundHoldingId);
    batch.set(ref, {
      id: fundHoldingId,
      userId,
      schemeCode,
      schemeName: sanitizeText(input.schemeName, 180),
      fundHouse: sanitizeText(input.fundHouse, 100, 'Indian Mutual Fund'),
      category: sanitizeText(input.category, 80, 'Equity Scheme'),
      planType: input.planType === 'Regular' ? 'Regular' : 'Direct',
      optionType: input.optionType === 'IDCW' ? 'IDCW' : 'Growth',
      units: sanitizePositiveNumber(input.units),
      avgNav: Math.min(sanitizePositiveNumber(input.avgNav), 1000000),
      purchaseDate: sanitizeDate(input.purchaseDate),
      isSip: Boolean(input.isSip),
      monthlySipAmount:
        typeof input.monthlySipAmount === 'number' && input.monthlySipAmount > 0
          ? Math.min(Number(input.monthlySipAmount.toFixed(2)), 10000000)
          : 0,
      folioNumber: input.folioNumber ? input.folioNumber.trim().slice(0, 40) : '',
      source: input.source,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function batchDeleteMutualFundHoldings(
  userId: string,
  fundHoldingIds: string[]
): Promise<void> {
  if (fundHoldingIds.length === 0) return;
  const path = `users/${userId}/mutualFunds`;
  for (let i = 0; i < fundHoldingIds.length; i += 400) {
    const chunk = fundHoldingIds.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, 'users', userId, 'mutualFunds', id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

function clampAlgoNum(val: number, min: number, max: number, decimals = 2): number {
  if (!Number.isFinite(val)) return min;
  const clamped = Math.max(min, Math.min(max, val));
  return Number(clamped.toFixed(decimals));
}

function sanitizeAlgoConditions(
  raw: AlgoRuleCondition[],
  minCount: number
): AlgoRuleCondition[] {
  const cleaned = (Array.isArray(raw) ? raw : []).slice(0, 6).map((c, idx) => ({
    id: sanitizeId(c?.id || `cond_${idx + 1}`),
    indicator: c?.indicator || 'RSI_14',
    comparator: c?.comparator || 'LT',
    threshold: clampAlgoNum(Number(c?.threshold ?? 35), -1000, 1000, 2),
    label: sanitizeText(c?.label || `${c?.indicator || 'RSI_14'} condition`, 120),
  }));

  if (cleaned.length < minCount) {
    cleaned.push({
      id: 'cond_default_1',
      indicator: 'RSI_14',
      comparator: 'LT',
      threshold: 40,
      label: 'RSI(14) < 40',
    });
  }
  return cleaned;
}

function sanitizeAlgoSymbols(raw: string[]): string[] {
  const list = Array.from(
    new Set(
      (Array.isArray(raw) ? raw : [])
        .map((s) => sanitizeSymbol(String(s || '')))
        .filter((s) => s.length >= 1 && s.length <= 32)
    )
  ).slice(0, 10);
  return list.length > 0 ? list : ['RELIANCE.NS'];
}

function buildAlgoStrategyCorePayload(input: AlgoStrategyDraft) {
  return {
    name: sanitizeText(input.name, 100, 'Custom Algo Strategy'),
    prompt: sanitizeText(input.prompt, 500, 'Systematic NSE equity strategy'),
    summary: sanitizeText(input.summary, 300, 'Rule-based equity strategy with stop-loss and daily cap'),
    symbols: sanitizeAlgoSymbols(input.symbols),
    timeframe: (['1d', '5d', '1mo', '6mo', '1y'] as const).includes(input.timeframe)
      ? input.timeframe
      : '6mo',
    logicOperator: input.logicOperator === 'OR' ? 'OR' : 'AND',
    entryConditions: sanitizeAlgoConditions(input.entryConditions, 1),
    exitConditions: sanitizeAlgoConditions(input.exitConditions, 0),
    virtualCapital: clampAlgoNum(input.virtualCapital, 10000, 100000000, 0),
    allocationPercent: clampAlgoNum(input.allocationPercent, 5, 100, 1),
    stopLossPct: clampAlgoNum(input.stopLossPct, 0.5, 50, 2),
    takeProfitPct: clampAlgoNum(input.takeProfitPct, 0.5, 200, 2),
    trailingStopPct: clampAlgoNum(input.trailingStopPct, 0, 50, 2),
    maxOpenPositions: Math.round(clampAlgoNum(input.maxOpenPositions, 1, 20, 0)),
    dailyLossCapPct: clampAlgoNum(input.dailyLossCapPct, 0.5, 25, 2),
    slippageBps: clampAlgoNum(input.slippageBps, 0, 100, 1),
  };
}

export function subscribeAlgoStrategies(
  userId: string,
  onData: (items: AlgoStrategyRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/algoStrategies`;
  const q = query(collection(db, 'users', userId, 'algoStrategies'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AlgoStrategyRecord[] = snapshot.docs.map(
        (d) => d.data() as AlgoStrategyRecord
      );
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createAlgoStrategy(
  userId: string,
  input: AlgoStrategyDraft & {
    id?: string;
    status?: AlgoStrategyStatus;
    lastBacktestReturnPct?: number;
    lastBacktestSharpe?: number;
    lastBacktestMaxDrawdownPct?: number;
    lastBacktestWinRatePct?: number;
  }
): Promise<string> {
  const strategyId = sanitizeId(
    input.id || `algo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const path = `users/${userId}/algoStrategies/${strategyId}`;
  const core = buildAlgoStrategyCorePayload(input);
  const status: AlgoStrategyStatus = (
    ['DRAFT', 'ACTIVE', 'PAUSED', 'PAUSED_RISK_CAP'] as const
  ).includes(input.status ?? 'DRAFT')
    ? (input.status ?? 'DRAFT')
    : 'DRAFT';

  const payload: Record<string, unknown> = {
    id: strategyId,
    userId,
    ...core,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (typeof input.lastBacktestReturnPct === 'number' && Number.isFinite(input.lastBacktestReturnPct)) {
    payload.lastBacktestReturnPct = clampAlgoNum(input.lastBacktestReturnPct, -100, 10000, 2);
  }
  if (typeof input.lastBacktestSharpe === 'number' && Number.isFinite(input.lastBacktestSharpe)) {
    payload.lastBacktestSharpe = clampAlgoNum(input.lastBacktestSharpe, -20, 50, 2);
  }
  if (
    typeof input.lastBacktestMaxDrawdownPct === 'number' &&
    Number.isFinite(input.lastBacktestMaxDrawdownPct)
  ) {
    payload.lastBacktestMaxDrawdownPct = clampAlgoNum(input.lastBacktestMaxDrawdownPct, 0, 100, 2);
  }
  if (
    typeof input.lastBacktestWinRatePct === 'number' &&
    Number.isFinite(input.lastBacktestWinRatePct)
  ) {
    payload.lastBacktestWinRatePct = clampAlgoNum(input.lastBacktestWinRatePct, 0, 100, 2);
  }

  try {
    await setDoc(doc(db, 'users', userId, 'algoStrategies', strategyId), payload);
    return strategyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAlgoStrategy(
  userId: string,
  strategyId: string,
  patch: AlgoStrategyDraft & {
    status: AlgoStrategyStatus;
    lastBacktestReturnPct?: number;
    lastBacktestSharpe?: number;
    lastBacktestMaxDrawdownPct?: number;
    lastBacktestWinRatePct?: number;
  }
): Promise<void> {
  const path = `users/${userId}/algoStrategies/${strategyId}`;
  const core = buildAlgoStrategyCorePayload(patch);
  const status: AlgoStrategyStatus = (
    ['DRAFT', 'ACTIVE', 'PAUSED', 'PAUSED_RISK_CAP'] as const
  ).includes(patch.status)
    ? patch.status
    : 'DRAFT';

  const payload: Record<string, unknown> = {
    ...core,
    status,
    updatedAt: serverTimestamp(),
  };

  if (typeof patch.lastBacktestReturnPct === 'number' && Number.isFinite(patch.lastBacktestReturnPct)) {
    payload.lastBacktestReturnPct = clampAlgoNum(patch.lastBacktestReturnPct, -100, 10000, 2);
  }
  if (typeof patch.lastBacktestSharpe === 'number' && Number.isFinite(patch.lastBacktestSharpe)) {
    payload.lastBacktestSharpe = clampAlgoNum(patch.lastBacktestSharpe, -20, 50, 2);
  }
  if (
    typeof patch.lastBacktestMaxDrawdownPct === 'number' &&
    Number.isFinite(patch.lastBacktestMaxDrawdownPct)
  ) {
    payload.lastBacktestMaxDrawdownPct = clampAlgoNum(patch.lastBacktestMaxDrawdownPct, 0, 100, 2);
  }
  if (
    typeof patch.lastBacktestWinRatePct === 'number' &&
    Number.isFinite(patch.lastBacktestWinRatePct)
  ) {
    payload.lastBacktestWinRatePct = clampAlgoNum(patch.lastBacktestWinRatePct, 0, 100, 2);
  }

  try {
    await updateDoc(doc(db, 'users', userId, 'algoStrategies', strategyId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateAlgoStrategyStatus(
  userId: string,
  strategyId: string,
  status: AlgoStrategyStatus
): Promise<void> {
  const path = `users/${userId}/algoStrategies/${strategyId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'algoStrategies', strategyId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAlgoStrategy(userId: string, strategyId: string): Promise<void> {
  const path = `users/${userId}/algoStrategies/${strategyId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'algoStrategies', strategyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAlgoOrders(
  userId: string,
  onData: (items: AlgoOrderRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/algoOrders`;
  const q = query(collection(db, 'users', userId, 'algoOrders'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AlgoOrderRecord[] = snapshot.docs
        .map((d) => d.data() as AlgoOrderRecord)
        .sort((a, b) => (b.executedAtIso || '').localeCompare(a.executedAtIso || ''));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function batchCreateAlgoOrders(
  userId: string,
  orders: AlgoOrderDraft[]
): Promise<void> {
  if (orders.length === 0) return;
  const path = `users/${userId}/algoOrders`;
  const nowStamp = Date.now();

  for (let i = 0; i < orders.length; i += 400) {
    const chunk = orders.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((order, idx) => {
      const orderId = sanitizeId(
        `ord_${sanitizeSymbol(order.symbol).replace(/\./g, '_')}_${nowStamp}_${i + idx}_${Math.random()
          .toString(36)
          .slice(2, 5)}`
      );
      const ref = doc(db, 'users', userId, 'algoOrders', orderId);
      batch.set(ref, {
        id: orderId,
        userId,
        strategyId: sanitizeId(order.strategyId),
        strategyName: sanitizeText(order.strategyName, 100, 'Algo Strategy'),
        symbol: sanitizeSymbol(order.symbol),
        side: order.side === 'SELL' ? 'SELL' : 'BUY',
        status: (
          ['FILLED', 'BLOCKED_RISK_CAP', 'BLOCKED_FUNDS', 'CANCELLED'] as const
        ).includes(order.status)
          ? order.status
          : 'FILLED',
        quantity: Math.round(clampAlgoNum(order.quantity, 0, 10000000, 0)),
        price: clampAlgoNum(order.price, 0.01, 10000000, 2),
        notionalValue: clampAlgoNum(order.notionalValue, 0, 1000000000, 2),
        realizedPnl: clampAlgoNum(order.realizedPnl, -1000000000, 1000000000, 2),
        triggerReason: sanitizeText(order.triggerReason, 240, 'Algorithmic signal trigger'),
        executedAtIso: sanitizeText(order.executedAtIso || new Date().toISOString(), 40),
        tradingDate: sanitizeDate(order.tradingDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function batchDeleteAlgoOrders(userId: string, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  const path = `users/${userId}/algoOrders`;
  for (let i = 0; i < orderIds.length; i += 400) {
    const chunk = orderIds.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, 'users', userId, 'algoOrders', id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export function subscribeBacktestRuns(
  userId: string,
  onData: (items: BacktestRunFirestoreRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/backtestRuns`;
  const q = query(collection(db, 'users', userId, 'backtestRuns'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: BacktestRunFirestoreRecord[] = snapshot.docs
        .map((d) => d.data() as BacktestRunFirestoreRecord)
        .sort((a, b) => (b.computedAt || '').localeCompare(a.computedAt || ''));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveBacktestRun(
  userId: string,
  run: BacktestRunResult
): Promise<string> {
  const runId = sanitizeId(
    run.runId || `bt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const path = `users/${userId}/backtestRuns/${runId}`;

  const symbols = Array.from(
    new Set(
      (run.symbolsEvaluated.length > 0 ? run.symbolsEvaluated : run.symbolsRequested)
        .map((s) => sanitizeSymbol(s))
        .filter((s) => s.length >= 1 && s.length <= 32)
    )
  ).slice(0, 30);
  if (symbols.length === 0) symbols.push('RELIANCE.NS');

  const fallbackCal = run.calibrationByHorizon['63'] ?? Object.values(run.calibrationByHorizon)[0];
  const cal1Y = run.calibrationByHorizon['252'] ?? fallbackCal;

  // Compact bounded snapshot well below Firestore's 1MB document limit
  const recentSignals = run.signals.slice(0, 120).map((s) => ({
    ...s,
    outcomes: {
      '21': s.outcomes['21'],
      '63': s.outcomes['63'],
      '126': s.outcomes['126'],
      '252': s.outcomes['252'],
    },
  }));

  const payload = {
    id: runId,
    userId,
    label: sanitizeText(run.label, 120, '10Y Backtest Snapshot'),
    methodology: 'TECH_RECONSTRUCTED_V1' as const,
    universeMode: (['portfolio_plus_flagship', 'flagship', 'portfolio_only'] as const).includes(
      run.universeMode
    )
      ? run.universeMode
      : 'portfolio_plus_flagship',
    samplingFrequency: (['monthly', 'biweekly', 'weekly'] as const).includes(run.samplingFrequency)
      ? run.samplingFrequency
      : 'monthly',
    costBps: clampAlgoNum(run.costBps, 0, 100, 1),
    trainCutoffDate: sanitizeDate(run.trainCutoffDate),
    symbols,
    portfolioMetrics: run.portfolioMetrics,
    horizonSummaries: run.horizonSummaries.slice(0, 6),
    calibration3M: fallbackCal,
    calibration1Y: cal1Y,
    stockScorecards: run.stockScorecards.slice(0, 30),
    equityCurve: run.equityCurve.slice(-140),
    recentSignals,
    totalSignalsGenerated: Math.round(clampAlgoNum(run.totalSignalsGenerated, 0, 200000, 0)),
    dataQuality: run.dataQuality.slice(0, 30),
    computedAt: sanitizeText(run.computedAt || new Date().toISOString(), 40),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', userId, 'backtestRuns', runId), payload);
    return runId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteBacktestRun(userId: string, runId: string): Promise<void> {
  const path = `users/${userId}/backtestRuns/${runId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'backtestRuns', runId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}



