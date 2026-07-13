interface LoadingScreenProps {
  error: string | null;
}

export function LoadingScreen({ error }: LoadingScreenProps) {
  return (
    <main className="loading-screen">
      <span className="loading-mark" aria-hidden="true"><i /><i /><i /></span>
      <p className="eyebrow">The Current</p>
      <h1>{error === null ? 'Restoring the world…' : 'The world could not begin'}</h1>
      <p>{error ?? 'Loading the last deterministic snapshot and waking the simulation worker.'}</p>
    </main>
  );
}
