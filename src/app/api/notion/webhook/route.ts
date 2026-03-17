/**
 * Notion Webhook endpoint
 * POST /api/notion/webhook
 *
 * Notion sends events here when pages change.
 * We re-sync the affected project automatically.
 *
 * Registration (run once in curl or Notion API explorer):
 *   POST https://api.notion.com/v1/webhooks
 *   Headers: Authorization: Bearer <NOTION_KEY>, Notion-Version: 2025-09-03
 *   Body: {
 *     "url": "https://oraia-five.vercel.app/api/notion/webhook",
 *     "event_types": ["page.updated", "page.created", "page.properties_updated"],
 *     "data_sources": [{ "type": "data_source", "id": "207ca51b-74d3-8018-8c76-000be4cf2559" }]
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { syncNotionProject } from '../sync-project/route'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  // Notion verification challenge (sent once when registering the webhook)
  if (body.verification_token) {
    console.log('Notion webhook verification:', body.verification_token)
    return NextResponse.json({ challenge: body.verification_token })
  }

  // Extract page ID from event
  // Notion event shape: { type: "page.updated", entity: { type: "page", id: "page_id" }, ... }
  const pageId = body?.entity?.id || body?.data?.page_id || body?.page_id
  if (!pageId) {
    console.warn('Notion webhook: no page_id in event', JSON.stringify(body).slice(0, 200))
    return NextResponse.json({ ok: true, skipped: true })
  }

  const eventType = body?.type || 'unknown'
  console.log(`Notion webhook: ${eventType} → page ${pageId}`)

  // Sync this specific project
  const result = await syncNotionProject(pageId)
  if (!result.ok) {
    console.error(`Notion webhook sync failed for ${pageId}:`, result.error)
    // Still return 200 so Notion doesn't retry infinitely
    return NextResponse.json({ ok: false, error: result.error })
  }

  console.log(`Notion webhook: synced page ${pageId} ✅`)
  return NextResponse.json({ ok: true, page_id: pageId })
}
