import { httpRouter } from 'convex/server'

import { clerkUsersWebhook } from './webhooks/clerk'

const http = httpRouter()

http.route({
  path: '/webhooks/clerk',
  method: 'POST',
  handler: clerkUsersWebhook,
})

export default http
