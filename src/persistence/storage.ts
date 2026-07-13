import type { StoragePersistenceResult } from './schema';

export async function requestPersistentStorage(): Promise<StoragePersistenceResult> {
  if (
    typeof navigator === 'undefined' ||
    navigator.storage === undefined ||
    typeof navigator.storage.persist !== 'function'
  ) {
    return 'unsupported';
  }
  try {
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function queryPersistentStorage(): Promise<StoragePersistenceResult> {
  if (
    typeof navigator === 'undefined' ||
    navigator.storage === undefined ||
    typeof navigator.storage.persisted !== 'function'
  ) {
    return 'unsupported';
  }
  try {
    return (await navigator.storage.persisted()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
