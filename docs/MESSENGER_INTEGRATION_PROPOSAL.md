# Messenger Integration Proposal for ServeTrack Poll Voting System

**Document Version:** 1.0  
**Date:** March 7, 2026  
**Prepared for:** Project Manager and Client  
**Project:** New Life Community Care Foundation - ServeTrack Volunteer Management System

---

## Executive Summary

This document proposes solutions for integrating messaging functionality into the ServeTrack Volunteer Management System's Poll Voting feature. Currently, the organization manually shares poll links via Facebook Messenger group chats. This proposal evaluates two platforms—Facebook Messenger and Telegram—to automate and streamline the poll notification process while maintaining accessibility for volunteers across all age groups.

After comprehensive research, **Telegram Bot API** emerges as the recommended primary solution due to its superior developer experience, cost-effectiveness, and full group messaging support. A **hybrid approach** combining Telegram automation with Facebook Messenger as a fallback is also presented.

---

## 1. Current Problem Statement

### 1.1 Existing Workflow

The organization currently uses the following manual process:

1. Admin creates a poll using Facebook's native poll feature
2. Admin copies the poll link manually
3. Admin pastes the link into the Facebook Messenger group chat
4. Volunteers respond to the poll through Facebook

### 1.2 Pain Points

- **Manual Copy-Paste:** Repeated effort for each poll
- **No Centralized Tracking:** Poll responses scattered across Facebook
- **Limited Automation:** Cannot programmatically send poll links
- **Data Silos:** Volunteer responses not integrated with ServeTrack
- **No Real-time Notifications:** Admin cannot send automated reminders

---

## 2. Platform Evaluation

### 2.1 Facebook Messenger

#### Capabilities Analysis

| Feature | Status | Notes |
|---------|--------|-------|
| Send individual messages (DMs) | ✅ Supported | Via Send API |
| Send messages to group chats | ❌ Not Supported | API limitation confirmed |
| Bot can be added to groups | ✅ Possible | Can read but not send |
| Poll creation via API | ❌ Not Available | Removed from Graph API |
| Free to use | ✅ Yes | No per-message costs |

#### Key Limitations

1. **No Group Messaging via API:** The Messenger Send API only supports 1-on-1 conversations between a Page and individual users. Even though bots can be added to group chats, they cannot programmatically send messages to groups.

2. **24-Hour Messaging Window:** Messages can only be sent to users who have messaged the Page within the last 24 hours, unless using subscription messaging.

3. **Marketing Messages Deprecation:** Recurring Notifications (marketing messages) will be deprecated on **February 10, 2026**, with restrictions effective September 2025.

4. **Complex Setup:** Requires Facebook App approval, Page access tokens, webhook configuration, and ongoing compliance.

#### Implementation Requirements

```
Prerequisites:
├── Facebook Developer Account
├── Facebook App with Messenger Product
├── Facebook Page for organization
├── HTTPS-enabled webhook server
└── App Review (for permissions)
```

#### Estimated Costs

- **Development Time:** 15-20 hours
- **Ongoing Costs:** Free (API is free, but limited)
- **Maintenance:** High (API changes, policy compliance)

---

### 2.2 Telegram Bot API

#### Capabilities Analysis

| Feature | Status | Notes |
|---------|--------|-------|
| Send individual messages | ✅ Fully Supported | Via sendMessage API |
| Send messages to groups | ✅ Fully Supported | Bot must be admin |
| Send messages to channels | ✅ Fully Supported | Bot must be admin |
| Create polls | ✅ Supported | Native poll creation |
| Cost | ✅ Free | No per-message fees |
| Setup Complexity | ✅ Low | BotFather-based |

#### Key Advantages

1. **Full Group/Channel Support:** Bots can send messages to groups and channels where they are added as administrators.

2. **Instant Setup:** Create a bot in minutes via @BotFather—no approval process, no app review.

3. **Excellent Developer Experience:** Comprehensive REST API, well-documented endpoints, multiple PHP/Laravel SDKs available.

4. **No Messaging Windows:** No restrictions on when messages can be sent.

5. **Native Poll Support:** Telegram has built-in poll functionality that can be created and managed via the Bot API.

6. **Free Forever:** No per-message costs, no subscription fees.

#### Implementation Requirements

```
Prerequisites:
├── Telegram Account (for BotFather)
├── Create bot via @BotFather (2 minutes)
├── Add bot to group/channel
└── Make bot an admin (for groups)
```

#### Estimated Costs

- **Development Time:** 8-12 hours
- **Ongoing Costs:** Free
- **Maintenance:** Low (stable API)

---

## 3. Proposed Solutions

### 3.1 Option A: Telegram-First Solution (Recommended)

**Overview:** Implement Telegram Bot as the primary messaging channel for poll notifications.

**Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│                  ServeTrack Admin Panel                      │
├─────────────────────────────────────────────────────────────┤
│  1. Admin creates poll in ServeTrack                        │
│                                                              │
│  2. Admin clicks "Send Poll via Telegram"                    │
│                                                              │
│  3. System automatically:                                   │
│     → Sends poll link to Telegram Group                      │
│     → Sends individual DMs to volunteers (optional)          │
│     → Creates inline poll in Telegram (optional)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Telegram Group/Channel                     │
├─────────────────────────────────────────────────────────────┤
│  Volunteers receive:                                         │
│  "New Poll: Disaster Response Team                           │
│   👉 [Vote Here: link]                                      │
│   📅 Deadline: March 15, 2026                              │
│   👥 Slots: 20/50 filled"                                   │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Components:**

| Component | Description |
|-----------|-------------|
| Telegram Bot | Created via @BotFather |
| Laravel Service | Handles API communication |
| Angular Frontend | Admin UI for sending polls |
| Database Tables | Store chat IDs, preferences |

**Code Example (Laravel):**

```php
// Using irazasyed/telegram-bot-sdk
Telegram::sendMessage([
    'chat_id' => $chatId,           // Group or user chat ID
    'text' => "📢 *New Poll Available!*\n\n"
             . "*Event:* {$poll->title}\n"
             . "*Deadline:* {$poll->deadline}\n\n"
             . "[Click here to vote](" . $poll->url . ")",
    'parse_mode' => 'Markdown',
]);

// For inline keyboard with button
Telegram::sendMessage([
    'chat_id' => $chatId,
    'text' => 'New poll available!',
    'reply_markup' => json_encode([
        'inline_keyboard' => [[
            ['text' => 'Vote Now', 'url' => $poll->url]
        ]]
    ]),
]);
```

---

### 3.2 Option B: Hybrid Approach (Facebook + Telegram)

**Overview:** Use Telegram as the primary automation channel while maintaining Facebook Messenger as a secondary notification method for volunteers who prefer it.

**Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│                  ServeTrack Admin Panel                      │
├─────────────────────────────────────────────────────────────┤
│  Two notification options:                                   │
│                                                              │
│  1. [Send via Telegram] - Automated, instant              │
│     → Posts to Telegram Group/Channel                       │
│                                                              │
│  2. [Copy Facebook Link] - One-click copy                 │
│     → Copies formatted message for manual paste             │
│     → Admin pastes in Facebook Messenger group              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Components:**

| Component | Description |
|-----------|-------------|
| Telegram Bot | Primary automated channel |
| Facebook Integration | One-click copy for manual posting |
| Message Templates | Pre-formatted messages for both platforms |

---

### 3.3 Option C: Facebook-First (Limited Automation)

**Overview:** Stay with Facebook but add limited automation improvements.

**Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│                  ServeTrack Admin Panel                      │
├─────────────────────────────────────────────────────────────┤
│  1. [Copy Poll Link] - One-click copy                     │
│     → Copies formatted message                              │
│     → Admin pastes in Messenger group                      │
│                                                              │
│  2. [Send Individual DMs] - Optional                        │
│     → Sends poll to each volunteer via DM                  │
│     → Requires volunteers to have messaged Page            │
└─────────────────────────────────────────────────────────────┘
```

**Limitations:**

- Cannot programmatically post to group chats
- Requires manual copy-paste for group announcements
- 24-hour messaging window restriction
- Deprecated marketing messages feature

---

## 4. Technical Implementation Plan

### 4.1 Telegram Bot Integration

#### Step 1: Bot Creation (2 minutes)

1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Follow prompts to set name and username
4. Copy the bot token

#### Step 2: Laravel Backend Implementation

**Install Package:**

```bash
composer require irazasyed/telegram-bot-sdk
```

**Configuration (.env):**

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

**Service Implementation:**

```php
// app/Services/TelegramService.php
namespace App\Services;

use Telegram\Bot\Api;

class TelegramService
{
    protected Api $telegram;

    public function __construct()
    {
        $this->telegram = new Api(config('services.telegram.bot_token'));
    }

    public function sendToGroup(int $chatId, string $message, ?array $buttons = null): array
    {
        $params = [
            'chat_id' => $chatId,
            'text' => $message,
            'parse_mode' => 'HTML',
        ];

        if ($buttons) {
            $params['reply_markup'] = json_encode([
                'inline_keyboard' => $buttons
            ]);
        }

        return $this->telegram->sendMessage($params);
    }

    public function sendPoll(int $chatId, string $question, array $options): array
    {
        return $this->telegram->sendPoll([
            'chat_id' => $chatId,
            'question' => $question,
            'options' => json_encode($options),
            'is_anonymous' => false,
        ]);
    }
}
```

#### Step 3: Database Schema

```php
// Database migration
Schema::create('telegram_chats', function (Blueprint $table) {
    $table->id();
    $table->foreignId('volunteer_id')->constrained()->onDelete('cascade');
    $table->string('chat_id');  // User or group chat ID
    $table->string('chat_type'); // 'private', 'group', 'channel'
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

#### Step 4: Angular Frontend

```typescript
// poll.service.ts
sendViaTelegram(pollId: number): Observable<any> {
  return this.http.post(`/api/polls/${pollId}/send-telegram`, {});
}
```

```html
<!-- Admin poll list component -->
<button (click)="sendToTelegram(poll.id)" class="btn-primary">
  <i class="fab fa-telegram"></i> Send via Telegram
</button>
```

---

### 4.2 Facebook Integration (Optional Enhancement)

#### Step 1: Facebook App Setup

1. Create Facebook Developer account
2. Create new App (type: Business)
3. Add Messenger product
4. Configure Page access token
5. Set up webhook

#### Step 2: Laravel Service

```php
// app/Services/FacebookService.php
class FacebookService
 string{
    protected $pageAccessToken;
    protected string $pageId;

    public function sendDirectMessage(string $psid, string $message): array
    {
        $url = "https://graph.facebook.com/v18.0/{$this->pageId}/messages";

        return Http::post($url, [
            'recipient' => ['id' => $psid],
            'message' => ['text' => $message],
            'messaging_type' => 'MESSAGE_TAG',
            'tag' => 'CONFIRMED_EVENT_UPDATE',
        ]);
    }
}
```

---

## 5. User Experience Considerations

### 5.1 Volunteer Onboarding

| Platform | Onboarding Steps |
|----------|-----------------|
| **Telegram** | 1. Download Telegram app<br>2. Search for bot username<br>3. Click "Start"<br>4. (Optional) Join group/channel |
| **Facebook** | 1. Message the Page (for DM capability)<br>2. Join group chat |

### 5.2 Age-Group Accessibility

| Age Group | Recommendation |
|-----------|----------------|
| **Teens (13-19)** | Telegram or Facebook both familiar |
| **Young Adults (20-35)** | Both platforms widely used |
| **Middle Age (36-55)** | Facebook more familiar |
| **Older Adults (55+)** | Facebook typically preferred |

### 5.3 Recommendation by Age

Given the volunteer demographic (teens to older adults):

- **Primary:** Telegram for automated notifications
- **Secondary:** Facebook for those who prefer it
- **Fallback:** In-app notifications for all users

---

## 6. Cost Comparison

| Item | Facebook | Telegram |
|------|----------|----------|
| API Access | Free | Free |
| Bot Hosting | Required | Required |
| Development Cost | Medium | Low |
| Maintenance Cost | High | Low |
| Per-Message Cost | $0 | $0 |
| Monthly Subscription | $0 | $0 |
| **Total First Year** | **$0* | **$0** |

*Facebook may require business verification costs depending on scale

---

## 7. Risk Assessment

### 7.1 Facebook Messenger

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API deprecation | High | High | Plan migration path |
| Policy changes | Medium | High | Monitor updates |
| Rate limiting | Medium | Medium | Implement throttling |
| Access token expiry | Medium | Medium | Auto-refresh tokens |

### 7.2 Telegram Bot

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API changes | Low | Low | Use stable SDK |
| Bot blocked by user | Medium | Low | Multi-channel fallback |
| Group removal | Medium | Low | Admin notification system |

---

## 8. Recommendations

### 8.1 Primary Recommendation

**Implement Option A (Telegram-First)** as the primary solution because:

1. **Full API Support:** Complete control over group messaging
2. **Cost-Effective:** No fees, no approval process
3. **Fast Implementation:** Can be ready in days, not weeks
4. **Reliable:** Stable API with excellent documentation
5. **Modern:** Better developer experience, easier maintenance

### 8.2 Secondary Recommendation

**Add Option C (One-Click Facebook Copy)** as a fallback for:

1. Volunteers who prefer Facebook
2. Organizations already invested in Facebook ecosystem
3. Backup when Telegram is unavailable

### 8.3 Implementation Priority

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | Create Telegram Bot | 2 hours |
| 2 | Laravel backend integration | 6 hours |
| 3 | Angular frontend (Telegram) | 4 hours |
| 4 | Testing & QA | 4 hours |
| 5 | Facebook one-click copy (optional) | 4 hours |
| **Total** | | **20 hours** |

---

## 9. Conclusion

After comprehensive research and analysis:

- **Facebook Messenger** cannot fulfill the primary requirement of sending automated messages to group chats. While it supports individual DMs, the group messaging limitation makes it unsuitable for the organization's current workflow.

- **Telegram Bot API** provides a complete solution with full group messaging support, excellent developer tools, and zero costs. It is the recommended platform for this implementation.

- A **hybrid approach** combining Telegram automation with optional Facebook integration offers the best of both worlds while maintaining backward compatibility for existing workflows.

The proposed solution will significantly reduce manual effort, improve volunteer engagement, and provide a modern, maintainable infrastructure for the organization's communication needs.

---

## 10. Appendices

### Appendix A: Key Resources

**Telegram:**

- Bot API Documentation: https://core.telegram.org/bots/api
- Telegram Bot SDK (PHP): https://github.com/irazasyed/telegram-bot-sdk
- BotFather: @BotFather on Telegram

**Facebook:**

- Messenger Platform: https://developers.facebook.com/docs/messenger-platform
- Graph API: https://developers.facebook.com/docs/graph-api

### Appendix B: Glossary

| Term | Definition |
|------|------------|
| API | Application Programming Interface |
| Bot | Automated software account |
| Chat ID | Unique identifier for Telegram conversations |
| DM | Direct Message (private message) |
| Graph API | Facebook's API for social data |
| PSID | Page-Scoped ID (Facebook user identifier) |
| Send API | Facebook's API for sending messages |
| Webhook | Server endpoint for receiving real-time events |

---

### Appendix C: References and Information Sources

#### Official Platform Documentation

| Source | URL | Relevance |
|--------|-----|-----------|
| Facebook Messenger Platform - Send API | https://developers.facebook.com/docs/messenger-platform/reference/send-api/ | Primary API for sending messages |
| Facebook Messenger Platform - Messaging | https://developers.facebook.com/docs/messenger-platform/send-messages/ | 24-hour window restrictions |
| Facebook Graph API - Group Message | https://developers.facebook.com/docs/graph-api/reference/group-message/ | Group message endpoint (read-only) |
| Facebook Messenger Marketing Messages | https://developers.facebook.com/docs/messenger-platform/marketing-messages/ | Deprecation notice (Feb 2026) |
| Facebook Graph API - Video Polls | https://developers.facebook.com/docs/graph-api/reference/video/polls/ | Poll API limitations |
| Facebook Rate Limits Documentation | https://developers.facebook.com/docs/graph-api/overview/rate-limiting/ | API rate limiting |
| Telegram Bot API Documentation | https://core.telegram.org/bots/api | Official Bot API reference |
| Telegram Bot SDK for PHP | https://telegram-bot-sdk.com/docs/1.x | PHP/Laravel integration |
| Threads API - Polls | https://developers.facebook.com/docs/threads/create-posts/polls/ | Instagram Threads poll support |

#### Community & Forum Sources

| Source | URL | Relevance |
|--------|-----|-----------|
| Meta Developer Community Thread | https://developers.facebook.com/community/threads/292829805081119/ | Confirms group messaging not supported |
| Stack Overflow - Telegram Bot | https://stackoverflow.com/questions/48290075/send-a-message-to-a-telegram-bot-using-php | PHP Telegram implementation |

#### Developer Resources & Tutorials

| Resource | URL | Description |
|----------|-----|-------------|
| Telegram Bot SDK (GitHub) | https://github.com/irazasyed/telegram-bot-sdk | Popular PHP SDK for Laravel |
| Laravel Telegram Bot Package | https://github.com/suretarget/laravel-telegram-bot | Laravel-native package |
| Create Telegram Bot Guide | https://dev.to/akramghaleb/how-to-create-a-telegram-bot-and-send-messages-using-laravel-12-10f | Step-by-step Laravel 12 tutorial |
| Telegram ChatBot with Laravel | https://medium.com/@samonrotha/telegram-chatbot-with-laravel-12-and-livewire-b7bb7ede49ac | Laravel 12 + Livewire integration |
| WhatsApp vs Telegram Comparison | https://medium.com/@wassenger/automate-whatsapp-group-messages-using-php-b503c5c61a94 | WhatsApp group messaging info |

#### Additional Research Platforms Used

| Platform | Purpose |
|----------|---------|
| Web Search (Google) | General API research, community discussions |
| Meta Developers Documentation | Official API capabilities and limitations |
| Telegram Official Documentation | Bot API features and endpoints |
| GitHub | PHP/Laravel package discovery |

#### Research Queries Performed

| Date | Query | Results |
|------|-------|---------|
| March 2026 | Facebook Messenger API send message to group | Not supported via API |
| March 2026 | Facebook Graph API limitations polls | No poll creation API available |
| March 2026 | Telegram Bot API sendMessage group | Fully supported |
| March 2026 | Facebook Messenger 24-hour window | Confirmed restriction |
| March 2026 | Marketing Messages API deprecation | February 10, 2026 |
| March 2026 | Facebook Messenger bot group chat | Can read but cannot send |
| March 2026 | WhatsApp Business API group | Supported but paid |
| March 2026 | Telegram Bot Laravel integration | Multiple packages available |

---

**Document Prepared By:** ServeTrack Development Team  
**For:** New Life Community Care Foundation International, Inc.
