# Stripe Subscription Sync - Summary Report

## ✅ Successfully Synced (13 accounts)

| Member Name | Stripe Customer ID | Subscription ID | Status | Monthly Dues |
|-------------|-------------------|-----------------|--------|--------------|
| Amina Barnes | cus_TnaSAQDcWNaMw5 | sub_1SpzHRFdjSPifIH5iPqt5UQB | active | $100.00 |
| Ariane Bell | cus_Ta5yD70SPd2V7O | sub_1ScvmzFdjSPifIH5asUWwxsP | active | $100.00 |
| Carlie Pratt | cus_TwFGHOwpXR7h1Y | sub_1SyMlkFdjSPifIH53FrskfjC | active | $10.00 |
| Cheryl Mayfield | cus_TyZ5eY9OGPr3HX | sub_1T0bxKFdjSPifIH5XwluonBk | active | $100.00 |
| Doug Mottet | cus_TpkMjfngIJfKyc | sub_1Ss4sCFdjSPifIH5qRjcAQc9 | active | $100.00 |
| Eric Korth | cus_TjsRch6C2rmYsY | sub_1SmOgwFdjSPifIH5SEUKFyAQ | active | $10.00 |
| Kenya Campbell | cus_TdBdMm7j24wrY3 | sub_1SfvGBFdjSPifIH5IyvIKeF8 | active | $100.00 |
| Maria Rodriguez | cus_TjmK3CVmNSD4Fo | sub_1SmImGFdjSPifIH5vTP7Ry6r | active | $100.00 |
| Michael Garrett | cus_To60oEveGYOTsX | sub_1SqTouFdjSPifIH5atMd6JXj | active | $10.00 |
| Molly Maloney | cus_TQhpYk6ZR1mjuQ | sub_1STqPtFdjSPifIH5rVbXibUJ | active | $100.00 |
| Ronny Soto | cus_TnbqvM7tTAiodA | sub_1Sq0d2FdjSPifIH5L6fY6AS7 | active | $100.00 |
| Ryan & Maria VanWinkle | cus_TwFfX7lhKglfcd | sub_1SyNA6FdjSPifIH5FkiCdCzH | active | $100.00 |
| Seongmin Lee | cus_TDgtRS2mD34tfY | sub_1SHFVwFdjSPifIH5G7kZWP6l | active | $100.00 |

## 🗑️ Deleted Duplicate Accounts (6 accounts)

| Member Name | Account ID | Reason |
|-------------|-----------|---------|
| Amina Barnes | d23ad0af-3ff0-40d9-816a-b23c1511b90f | Duplicate account without subscription |
| Michael Garrett | 48855458-4ecc-43c3-839f-23ca5d0af62b | Duplicate account without subscription |
| Kenya Campbell | 05bce3fa-fb4e-4722-9b00-74e2991532cb | Duplicate account with typo in email |
| Tim Wirick | d39aa99b-f51a-49e6-a958-de59132d21b2 | Duplicate account #1 |
| Tim Wirick | 88d14fe5-dfa1-4179-94d9-0f39d4d4fa41 | Duplicate account #2 |
| test testers | 1d89dbfd-e2fb-45c7-80a4-3f3ce51e564e | Test account |

**Kept:** Tim Wirick account 9d4bd047-7864-49a0-a92b-747892b3ed3b (has active subscription cus_SH6Kr9Xkf5cRTj)

## ❌ Canceled/Archived (3 accounts)

| Member Name | Account ID | Reason |
|-------------|-----------|---------|
| Isabelle Loos | dffefb30-fa38-4a27-be22-03bbc219894e | Not a member |
| Lakeisha Trimble | f08f1ca6-a48c-47e2-b51d-d2c5e91e4991 | Archive requested |
| Myk Barta | dedb3a13-9a54-458a-b7ad-6e95e8717597 | Archive requested |

## ⚠️ Requires Investigation (2 accounts)

### Ka'Von Johnson
- **Account ID:** 1867b499-cb8c-4544-ba24-fd4640f46d54
- **Stripe Customer ID:** cus_ThKQeKwFSrUiPM
- **Issue:** Account exists with customer ID but NO subscription found in Stripe
- **Status:** User mentioned "Ka'Von Johnson was NOT FOUND in database" but we found an account
- **Action Needed:**
  - Verify if this is the correct person
  - Check Stripe for canceled/expired subscriptions
  - Confirm if they should have an active subscription

### Kent Ingram
- **Account ID:** ca7accd7-e2ee-4227-ba7f-262c8e610b45
- **Email:** notifykingram@gmail.com
- **Issue:** User mentioned they paid but can't find record in Stripe
- **Current State:** No Stripe customer ID, no subscription
- **Action Needed:**
  - Search Stripe manually for payments by email "notifykingram@gmail.com" or name "Kent Ingram"
  - Check if payment was made under different email or name
  - If payment found, link to account and sync subscription

## ✓ Already Complete (2 accounts)

- **David Bailey** - Already synced (per user note)
- **Sierra Faler** - Already synced (per user note)

## ℹ️ Not a Customer Yet (1 account)

- **Tessa Bisges** - Not yet a paying customer (per user note)

---

## Summary Statistics

- **Total Members Processed:** 22
- **Successfully Synced:** 13
- **Duplicates Removed:** 6 accounts
- **Canceled/Archived:** 3 accounts
- **Requires Investigation:** 2 accounts
- **Already Complete:** 2 accounts
- **Not Yet Customer:** 1 account

## Next Steps

1. **Ka'Von Johnson**: Check Stripe dashboard for customer cus_ThKQeKwFSrUiPM and verify subscription status
2. **Kent Ingram**: Search Stripe for payments/subscriptions by email or name and link to account if found
