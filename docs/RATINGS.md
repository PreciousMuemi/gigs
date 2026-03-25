# Rating System (1-5 Stars)

## Overview

Simple 1-5 star rating system where:

- **Client rates freelancer** after job completion
- **Freelancer rates client** after payment
- **Average ratings** calculated and displayed on profiles
- **Accessible via USSD** for feature-phone users

---

## Database Schema

```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  review_text VARCHAR(320),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_id, from_user_id, to_user_id)
);
```

**Key points:**

- One rating per contract per person (can't rate same person twice)
- Links to contract (ensures they worked together)
- Simple 1-5 score
- Optional comment/review

---

## Query: Average Rating

```sql
SELECT
  COUNT(*) as total_ratings,
  AVG(score)::numeric(3,2) as avg_rating
FROM ratings
WHERE to_user_id = $1;

-- Result: { total_ratings: 12, avg_rating: 4.58 }
```

---

## USSD Rating Flow

### Scenario: Client rates freelancer after job completion

**User dials** `*123#` → Already in KaziLink

**Level 1: Main Menu**

```
CON Welcome to KaziLink
1. Register Freelancer
2. Register Client
3. Post a Job
4. Find a Freelancer
5. Rate a Freelancer ← User selects this
0. Exit
```

**Level 2: Enter freelancer phone**

```
CON Enter freelancer phone number:
User enters: +254712345678
```

**Level 3: Rate (1-5)**

```
CON Rate freelancer (1-5):
User enters: 5
```

**Level 4: Optional comment**

```
CON Any comments? (optional)
User enters: Great work!
```

**Level 5: Confirmation**

```
END Rating submitted. Freelancer notified.
```

**Freelancer receives SMS:**

```
"You received a 5-star rating! Your avg: 4.8/5 (12 ratings)."
```

---

## Code Example: Rate via API

```javascript
const ratingService = require("./services/ratingService");
const repo = require("./repositories/platformRepository");

// Create a rating
const rating = await repo.createRating({
  contractId: "contract-uuid",
  fromUserId: "client-uuid",
  toUserId: "freelancer-uuid",
  score: 5,
  comment: "Excellent work!",
});

// Get freelancer's average
const avg = await ratingService.getAverageRating("freelancer-uuid");
console.log(`${avg.avgScore}/5 from ${avg.totalRatings} ratings`);

// Get rating distribution
const dist = await ratingService.getRatingDistribution("freelancer-uuid");
// { 5: 10, 4: 2, 3: 0, 2: 0, 1: 0 }
```

---

## Code Example: Display Profile

```javascript
function displayFreelancerProfile(rating, totalRatings) {
  const stars = "⭐".repeat(Math.round(rating));
  return `${stars} ${rating.toFixed(1)}/5 (${totalRatings} ratings)`;
}

// Output: ⭐⭐⭐⭐⭐ 4.8/5 (12 ratings)
```

---

## Key Files

| File                                     | Purpose                                     |
| ---------------------------------------- | ------------------------------------------- |
| `src/services/ratingService.js`          | Calculate avg, distribution, recent ratings |
| `src/scripts/ratingDemo.js`              | Demo USSD flow + rating workflow            |
| `src/services/ussdStateMachine.js`       | Lines 278-319: USSD rating states           |
| `src/repositories/platformRepository.js` | `createRating()` function                   |

---

## Run Demo

```bash
npm run test:ratings
```

Shows:

1. Client rates freelancer (5 stars)
2. System calculates average
3. Freelancer rates client (4 stars)
4. Both averages displayed

---

## Features

✅ Store 1-5 star ratings  
✅ Calculate averages per user  
✅ Rating distribution (how many 5-star, 4-star, etc.)  
✅ Optional comments  
✅ USSD accessible  
✅ SMS notifications on new rating  
✅ Unique constraint (one rating per contract per person)

---

## Next Steps (Production)

- Add minimum rating threshold (e.g., suspend if avg < 2.0)
- Implement rating appeal/dispute process
- Show rating breakdown by category (communication, quality, etc.)
- Add photo/badge: "Top Rated 5.0" if all 5-star
- Implement review moderation (report inappropriate comments)
- Time-decay ratings (older ratings weighted less)

That's it! Simple, fast, hackathon-friendly.
