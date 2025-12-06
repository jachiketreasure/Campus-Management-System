# AI Chat Integration Setup Guide

## Overview
This guide explains how to set up the AI-powered support chat system with automatic responses and admin conversation tracking.

## Prerequisites
- Node.js 18+ installed
- MongoDB database (already configured)
- API key from chosen AI provider

## Step 1: Add Database Schema

Add the models from `packages/database/prisma/schema-additions-support-chat.prisma` to your main `schema.prisma` file.

Then run:
```bash
cd packages/database
npx prisma generate
npx prisma migrate dev --name add_support_chat
```

## Step 2: Choose AI Provider

### Option A: OpenAI (Recommended for Production)
1. Sign up at https://platform.openai.com
2. Create an API key
3. Add to `.env`:
```env
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-api-key-here
AI_MODEL=gpt-3.5-turbo
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=500
```

**Cost**: ~$0.001-0.002 per conversation
**Quality**: Excellent
**Setup Time**: 5 minutes

### Option B: Anthropic Claude
1. Sign up at https://console.anthropic.com
2. Create an API key
3. Add to `.env`:
```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-your-anthropic-key-here
AI_MODEL=claude-3-sonnet-20240229
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=500
```

**Cost**: ~$0.003-0.005 per conversation
**Quality**: Excellent
**Setup Time**: 5 minutes

### Option C: Local LLM (Free, Self-Hosted)
1. Install Ollama: https://ollama.ai
2. Download a model: `ollama pull llama2`
3. Add to `.env`:
```env
AI_PROVIDER=local
AI_MODEL=llama2
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=500
```

**Cost**: Free (server costs only)
**Quality**: Good (depends on model)
**Setup Time**: 30 minutes

## Step 3: Environment Variables

Add to your `.env` file:
```env
# AI Chat Configuration
AI_PROVIDER=openai
AI_API_KEY=your-api-key-here
AI_MODEL=gpt-3.5-turbo
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=500
```

## Step 4: Update Chat Widget

The chat widget needs to be updated to use the new API. The current widget in `apps/web/src/components/support/floating-chat-widget.tsx` needs to:

1. Call `/api/support/chat` instead of simulating responses
2. Store conversation ID
3. Handle real-time updates

## Step 5: Add Admin Navigation

Add "Support Conversations" to admin sidebar in:
- `apps/web/src/components/dashboard/dashboard-layout-client.tsx`
- `apps/web/src/app/(dashboard)/layout.tsx`

```typescript
{
  label: "Support Conversations",
  href: "/dashboard/admin/support-conversations",
  description: "View and manage support chats",
  icon: <SupportIcon />
}
```

## Step 6: Test the Integration

1. Start your development server
2. Open the chat widget
3. Send a test message
4. Verify AI response appears
5. Check admin dashboard for conversation

## How It Works

### User Flow:
1. User opens chat widget
2. User sends message → Saved to database
3. Message sent to AI API with conversation history
4. AI generates response → Saved to database
5. Response displayed to user in real-time

### Admin Flow:
1. Admin views conversations list
2. Admin can see all messages (user + AI)
3. Admin can escalate, resolve, or archive
4. Admin can view analytics and metrics

## Features

✅ **Real-time AI Responses**: Instant replies using GPT/Claude
✅ **Conversation History**: All chats stored in database
✅ **Admin Dashboard**: View and manage all conversations
✅ **Context Awareness**: AI knows user role and previous messages
✅ **Escalation**: Hand off to human support when needed
✅ **Analytics**: Track common issues and response quality

## Cost Estimates

**OpenAI GPT-3.5 Turbo:**
- 1,000 conversations/month: ~$1-2
- 10,000 conversations/month: ~$10-20
- 100,000 conversations/month: ~$100-200

**Anthropic Claude:**
- 1,000 conversations/month: ~$3-5
- 10,000 conversations/month: ~$30-50

## Security Considerations

1. **Rate Limiting**: Implement rate limits to prevent abuse
2. **Input Validation**: Sanitize all user inputs
3. **API Key Security**: Never expose API keys in client code
4. **User Authentication**: Verify user identity for each request
5. **Conversation Privacy**: Only user and admin can view conversations

## Troubleshooting

### AI not responding?
- Check API key is correct
- Verify API key has credits/quota
- Check network connectivity
- Review error logs in console

### Conversations not saving?
- Verify database connection
- Check Prisma schema is migrated
- Review API route logs

### Admin can't see conversations?
- Verify user has ADMIN role
- Check authentication is working
- Review API route permissions

## Next Steps

1. Customize system prompt for your use case
2. Add knowledge base integration
3. Implement analytics dashboard
4. Add conversation export feature
5. Set up monitoring and alerts

## Support

For issues or questions:
- Email: jachiketreasure@gmail.com
- Phone: 09135663829

