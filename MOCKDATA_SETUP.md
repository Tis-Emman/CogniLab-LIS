# Mock Data Mode - Client Demo Setup

## Quick Start

To enable mock data throughout the entire app (authentication, patients, test results, audit logs), add this to your `.env.local`:

```env
NEXT_PUBLIC_USE_MOCK_DATA=true
```

## What Gets Mocked

When `NEXT_PUBLIC_USE_MOCK_DATA=true` is set:

✅ **Authentication** - Auto-login as Dr. Maria Santos  
✅ **Patients** - 5 sample patients with full demographics  
✅ **Test Results** - 7 sample lab test results  
✅ **Audit Logs** - 5 sample activity logs  
✅ **Users Table** - 3 system users  

## Mock User Details

**Login User:**
- Email: maria.santos@lis.com
- Name: Dr. Maria Santos
- Role: Faculty
- Department: Clinical Chemistry

## Mock Data Included

### Patients (5 total)
- PAT001: Juan dela Cruz (45M) - Complete demographics
- PAT002: Maria Santos (38F) - Complete demographics
- PAT003: Carlos Reyes (52M) - Complete demographics
- PAT004: Ana Aquino (28F) - Incomplete demographics
- PAT005: Roberto Gonzales (61M) - Complete demographics

### Test Results (7 total)
- Clinical Chemistry tests for glucose, cholesterol, creatinine, BUN
- Hematology tests for WBC and hemoglobin
- Microbiology culture tests
- Mix of "released" and "pending" statuses

### Activity Logs (5 total)
- Login activities
- Patient record views/edits
- Report downloads
- Test result access

## Testing Steps

1. Add `NEXT_PUBLIC_USE_MOCK_DATA=true` to `.env.local`
2. Run `npm run dev`
3. App will auto-load mock authentication
4. Navigate through:
   - Dashboard (uses mock data)
   - Patients (shows 5 mock patients)
   - Results (shows 7 test results)
   - Admin > Audit Logs (shows 5 activity records)
   - Admin > Users (shows 3 system users)

## Disable Mock Mode

Simply remove or set `NEXT_PUBLIC_USE_MOCK_DATA=false` and restart dev server to use real database.

## Notes

- Mock mode bypasses all database queries
- Useful for demos, presentations, and testing without database setup
- All mock data is defined in `lib/mockData.ts`
- Database functions still work but return mock data when flag is enabled
- Audit logging doesn't actually write to database in mock mode
- User additions/deletions don't persist in mock mode
