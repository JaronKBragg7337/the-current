import { useEffect, useId, useState } from 'react';

import { PRESSURE_DIMENSIONS, parseSnapshot } from '../data/schema';
import type {
  CausalSignal,
  ExternalObservation,
  PressureDimension,
  PressureVector,
  SignalSnapshot,
} from '../data/schema';
import { toSimulationSignal } from '../data/to-simulation';
import type { NormalizedSignal } from '../simulation/types';

export interface ExternalSignalsProps {
  currentDay: number;
  effectiveDay: number;
  onSubmitSignal: (signal: NormalizedSignal) => Promise<void>;
  disabled?: boolean;
}

const FIXTURE_URL = `${import.meta.env.BASE_URL}data/signals.v1.json`;

function percentage(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function pressureLabel(dimension: PressureDimension): string {
  return dimension.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function activePressures(vector: PressureVector): readonly (readonly [PressureDimension, number])[] {
  return PRESSURE_DIMENSIONS.flatMap((dimension) =>
    Math.abs(vector[dimension]) < 0.001 ? [] : [[dimension, vector[dimension]] as const],
  );
}

function evidenceForSignal(
  signal: CausalSignal,
  snapshot: SignalSnapshot,
): readonly ExternalObservation[] {
  return snapshot.observations.filter((observation) =>
    signal.observationIds.includes(observation.id),
  );
}

export function ExternalSignals({
  currentDay,
  effectiveDay,
  onSubmitSignal,
  disabled = false,
}: ExternalSignalsProps) {
  const componentId = useId();
  const headingId = `${componentId}-title`;
  const detailHeadingId = `${componentId}-selected-title`;
  const objectiveHeadingId = `${componentId}-objective-title`;
  const beliefHeadingId = `${componentId}-belief-title`;
  const evidenceHeadingId = `${componentId}-evidence-title`;
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingSignalId, setPendingSignalId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submittedSignalIds, setSubmittedSignalIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadFixture(): Promise<void> {
      try {
        const response = await fetch(FIXTURE_URL, {
          credentials: 'same-origin',
          cache: 'force-cache',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Fixture request returned HTTP ${response.status}`);
        const input: unknown = await response.json();
        const loadedSnapshot = parseSnapshot(input);
        if (controller.signal.aborted) return;
        setSnapshot(loadedSnapshot);
        setSelectedSignalId((previous) =>
          loadedSnapshot.signals.some((signal) => signal.id === previous)
            ? previous
            : loadedSnapshot.signals[0]?.id ?? null,
        );
      } catch {
        if (!controller.signal.aborted) {
          setSnapshot(null);
          setLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadFixture();
    return () => controller.abort();
  }, [loadAttempt]);

  const selectedSignal =
    snapshot?.signals.find((signal) => signal.id === selectedSignalId) ?? null;
  const evidence =
    selectedSignal === null || snapshot === null
      ? []
      : evidenceForSignal(selectedSignal, snapshot);
  const objectivePressures =
    selectedSignal === null ? [] : activePressures(selectedSignal.objectivePressure);
  const beliefPressures =
    selectedSignal === null ? [] : activePressures(selectedSignal.beliefPressure);
  const scheduleIsValid =
    Number.isInteger(currentDay) &&
    currentDay >= 0 &&
    Number.isInteger(effectiveDay) &&
    effectiveDay >= currentDay;

  async function submitSelectedSignal(): Promise<void> {
    if (
      disabled ||
      selectedSignal === null ||
      pendingSignalId !== null ||
      submittedSignalIds.has(selectedSignal.id) ||
      !scheduleIsValid
    ) {
      return;
    }

    setPendingSignalId(selectedSignal.id);
    setSubmitError(null);
    setStatus(null);
    try {
      const projected = toSimulationSignal(selectedSignal, {
        timestampDay: currentDay,
        effectiveDay,
      });
      await onSubmitSignal(projected);
      setSubmittedSignalIds((previous) => new Set(previous).add(selectedSignal.id));
      setStatus(
        `${selectedSignal.eventFamily} queued for world day ${effectiveDay}. It remains a pressure, not a scripted outcome.`,
      );
    } catch {
      setSubmitError('The signal could not be queued. The simulation continues without it.');
    } finally {
      setPendingSignalId(null);
    }
  }

  return (
    <section className="external-signals" aria-labelledby={headingId} aria-busy={loading}>
      <header>
        <p className="eyebrow">Optional outside context</p>
        <h2 id={headingId}>External signals</h2>
        <p>
          This panel reads the committed, same-origin synthetic fixture. It never contacts a live
          data provider from the browser, and no signal enters the civilization until you submit it.
        </p>
      </header>

      {loading ? <p role="status">Loading the bundled signal fixture…</p> : null}
      {loadError ? (
        <div role="alert">
          <p>External context is unavailable. The autonomous simulation is unaffected.</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Retry bundled fixture
          </button>
        </div>
      ) : null}

      {snapshot === null || snapshot.signals.length === 0 ? null : (
        <>
          <fieldset disabled={disabled || pendingSignalId !== null}>
            <legend>Choose a derived pressure to inspect</legend>
            <div className="external-signal-choices">
              {snapshot.signals.map((signal) => {
                const inputId = `${componentId}-${signal.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                return (
                  <label key={signal.id} htmlFor={inputId}>
                    <input
                      id={inputId}
                      type="radio"
                      name="external-signal"
                      value={signal.id}
                      checked={selectedSignalId === signal.id}
                      onChange={() => setSelectedSignalId(signal.id)}
                    />
                    <span>
                      <strong>{signal.eventFamily.replaceAll('-', ' ')}</strong>
                      {' · '}{signal.domain} · intensity {percentage(signal.intensity)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selectedSignal === null ? null : (
            <article className="external-signal-detail" aria-labelledby={detailHeadingId}>
              <header>
                <p>{selectedSignal.domain}</p>
                <h3 id={detailHeadingId}>
                  {selectedSignal.eventFamily.replaceAll('-', ' ')}
                </h3>
                <p>{selectedSignal.rationale}</p>
              </header>

              <dl>
                <div>
                  <dt>Intensity</dt>
                  <dd>
                    <meter min={0} max={1} value={selectedSignal.intensity}>
                      {percentage(selectedSignal.intensity)}
                    </meter>{' '}
                    {percentage(selectedSignal.intensity)}
                  </dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>
                    <meter min={0} max={1} value={selectedSignal.confidence}>
                      {percentage(selectedSignal.confidence)}
                    </meter>{' '}
                    {percentage(selectedSignal.confidence)}
                  </dd>
                </div>
                <div><dt>Independent-source agreement</dt><dd>{percentage(selectedSignal.sourceAgreement)}</dd></div>
                <div><dt>Novelty</dt><dd>{percentage(selectedSignal.novelty)}</dd></div>
                <div><dt>Duration</dt><dd>{selectedSignal.durationDays} world days</dd></div>
                <div><dt>Half-life</dt><dd>{selectedSignal.decay.halfLifeDays} world days</dd></div>
              </dl>

              <section aria-labelledby={objectiveHeadingId}>
                <h4 id={objectiveHeadingId}>Objective pressure</h4>
                <p>Material conditions such as capacity, health, infrastructure, or supply.</p>
                {objectivePressures.length === 0 ? (
                  <p>No objective pressure in this signal.</p>
                ) : (
                  <ul>
                    {objectivePressures.map(([dimension, value]) => (
                      <li key={dimension}>
                        {pressureLabel(dimension)}: {value > 0 ? '+' : ''}{value.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby={beliefHeadingId}>
                <h4 id={beliefHeadingId}>Belief pressure</h4>
                <p>Attention, fear, trust, expectations, or interpretation—not an objective fact.</p>
                {beliefPressures.length === 0 ? (
                  <p>No belief pressure in this signal.</p>
                ) : (
                  <ul>
                    {beliefPressures.map(([dimension, value]) => (
                      <li key={dimension}>
                        {pressureLabel(dimension)}: {value > 0 ? '+' : ''}{value.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby={evidenceHeadingId}>
                <h4 id={evidenceHeadingId}>Evidence and lineage</h4>
                <p>
                  {evidence.length} observation{evidence.length === 1 ? '' : 's'} · agreement{' '}
                  {percentage(selectedSignal.sourceAgreement)}
                </p>
                <ul>
                  {evidence.map((observation) => (
                    <li key={observation.id}>
                      <strong>{observation.source.provider}</strong>{' · '}
                      <time dateTime={observation.observedAt}>
                        {new Date(observation.observedAt).toLocaleString()}
                      </time>{' · '}
                      {observation.source.attribution.license}
                    </li>
                  ))}
                </ul>
              </section>

              <p>
                If submitted now, the observation is timestamped on world day {currentDay} and
                becomes effective on world day {effectiveDay}.
              </p>
              {scheduleIsValid ? null : (
                <p role="alert">Effective day must be a whole world day at or after the current day.</p>
              )}
              <button
                type="button"
                disabled={
                  disabled ||
                  pendingSignalId !== null ||
                  submittedSignalIds.has(selectedSignal.id) ||
                  !scheduleIsValid
                }
                onClick={() => {
                  void submitSelectedSignal();
                }}
              >
                {pendingSignalId === selectedSignal.id
                  ? 'Queueing signal…'
                  : submittedSignalIds.has(selectedSignal.id)
                    ? 'Signal queued'
                    : 'Queue selected signal'}
              </button>
            </article>
          )}
        </>
      )}

      {submitError === null ? null : <p role="alert">{submitError}</p>}
      <p aria-live="polite" aria-atomic="true">{status}</p>
    </section>
  );
}
