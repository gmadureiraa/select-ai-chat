

# Fix: Automation Platform Selection with Connection Status

## Problem
The automation dialog shows a plain checkbox list of platforms without indicating which ones are actually connected for the selected client. This makes it impossible to know if auto-publish will work. The planning card already does this well with styled chips showing connection status.

## Changes

### `src/components/planning/AutomationDialog.tsx`

1. **Import `useClientPlatformStatus`** and `ALL_PUBLISH_PLATFORMS` from existing shared modules
2. **Replace the plain checkbox list** (lines 712-738) with the same styled chip-button pattern used in `PlanningItemDialog`:
   - Use `ALL_PUBLISH_PLATFORMS` instead of the local `PLATFORMS` constant
   - Call `getPlatformStatus()` per platform to show green dot for connected ones
   - Apply brand colors when selected, dim opacity when not connected
   - Show connected count summary below the chips
3. **Remove the local `PLATFORMS` constant** (lines 60-70) since `ALL_PUBLISH_PLATFORMS` covers all platforms
4. **Import Lucide icons** needed for the platform chips (Twitter, Linkedin, Instagram, etc.) and the `platformLucideIcons` map
5. **Wire `useClientPlatformStatus(clientId)`** so it reacts to client selection changes
6. **Auto-publish switch logic**: only enable when at least one selected platform is connected (`publishablePlatforms.length > 0`)

### Visual Result
- Each platform appears as a styled chip with its brand icon
- Connected platforms show a small green dot
- Selected platforms highlight with brand color border/background
- Disconnected platforms appear dimmed (opacity-40) but still selectable
- Summary text: "X de Y conectada(s)"

## Technical Details

| Aspect | Detail |
|--------|--------|
| Shared imports | `ALL_PUBLISH_PLATFORMS` from `@/types/contentTypes`, `useClientPlatformStatus` from hook |
| Icon map | Reuse same `platformLucideIcons` pattern from `PlanningItemDialog` |
| Auto-publish guard | Filter `selectedPlatforms` through `canAutoPublish()` to determine publishable count |

