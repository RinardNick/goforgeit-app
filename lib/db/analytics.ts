import { query } from './client';

export interface PageView {
  id: string;
  sessionId: string;
  url: string;
  title: string;
  timestamp: string;
  timeOnPage: number | null;
  scrollDepth: number | null;
  engaged: boolean;
}

export interface VisitorSession {
  id: string;
  userAgent: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  sessionStart: string;
  lastSeenAt: string;
  identifiedEmail: string | null;
  identifiedName: string | null;
}

export interface SessionWithPageViews extends VisitorSession {
  pageViews: PageView[];
}

export async function getSessionsWithPageViews(): Promise<SessionWithPageViews[]> {
  // Fetch all sessions (ordered by lastSeenAt for most recent activity first)
  const sessions = await query<VisitorSession>(
    `SELECT * FROM "VisitorSession" ORDER BY "lastSeenAt" DESC LIMIT 100`
  );

  // Fetch page views for each session
  const sessionsWithPageViews: SessionWithPageViews[] = [];

  for (const session of sessions) {
    const pageViews = await query<PageView>(
      `SELECT * FROM "PageView" WHERE "sessionId" = $1 ORDER BY timestamp ASC`,
      [session.id]
    );

    sessionsWithPageViews.push({
      ...session,
      pageViews
    });
  }

  return sessionsWithPageViews;
}
