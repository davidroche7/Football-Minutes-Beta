import { useEffect, useState } from 'react';
import {
  fetchAuditEvents,
  formatAuditEventChanges,
  type AuditEvent,
} from '../lib/auditClient';
import { isFeatureEnabled } from '../lib/featureFlags';

interface AuditLogViewProps {
  entityType?: string;
  entityId?: string;
  limit?: number;
  // showFilters?: boolean; // TODO: Implement filters in future iteration
  className?: string;
}

/**
 * Centralized audit log viewer component
 * Replaces inline per-game change logs with a unified audit trail
 */
export function AuditLogView({
  entityType,
  entityId,
  limit = 50,
  className = '',
}: AuditLogViewProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Feature flag check
  const isEnabled = isFeatureEnabled('auditLogCentralized');

  useEffect(() => {
    if (!isEnabled) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function loadEvents() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchAuditEvents({
          entityType,
          entityId,
          limit,
        });

        if (mounted) {
          setEvents(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      mounted = false;
    };
  }, [entityType, entityId, limit, isEnabled]);

  if (!isEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`audit-log-view ${className}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading audit log...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`audit-log-view ${className}`}>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/60 dark:text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`audit-log-view ${className}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No audit entries found. Changes will appear here once made.
        </p>
      </div>
    );
  }

  const toggleExpand = (eventId: string) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  return (
    <div className={`audit-log-view space-y-2 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        Audit Trail
        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
          ({events.length} {events.length === 1 ? 'entry' : 'entries'})
        </span>
      </h3>

      <div className="space-y-2">
        {events.map((event) => {
          const isExpanded = expandedEventId === event.id;
          const changes = formatAuditEventChanges(event);
          const hasChanges = changes.length > 0;

          return (
            <div
              key={event.id}
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-semibold">
                      {event.actorId || 'System'}
                    </span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">
                      {event.eventType.toLowerCase().replace(/_/g, ' ')}
                    </span>{' '}
                    <span className="font-medium">
                      {event.entityType.toLowerCase()}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>

                {hasChanges && (
                  <button
                    onClick={() => toggleExpand(event.id)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    aria-label={isExpanded ? 'Hide details' : 'Show details'}
                  >
                    {isExpanded ? 'Hide' : 'Details'}
                  </button>
                )}
              </div>

              {isExpanded && hasChanges && (
                <div className="mt-2 space-y-1 border-t border-gray-300 pt-2 dark:border-gray-600">
                  {changes.map((change, idx) => (
                    <p key={idx} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                      {change}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
