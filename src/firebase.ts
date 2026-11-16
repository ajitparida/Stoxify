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
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
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
    .replace(/[^A-Z0-9_.-]/g, '')
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

