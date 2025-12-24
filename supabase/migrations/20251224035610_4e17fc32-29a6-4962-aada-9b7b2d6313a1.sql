-- Remove the free plan from subscription_plans
DELETE FROM subscription_plans WHERE type = 'free';

-- Add stripe_price_id and trial_days columns to subscription_plans
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 14;

-- Update Starter plan with Stripe IDs
UPDATE subscription_plans 
SET stripe_price_id = 'price_1ShjAAPIJtcImSMvRqRHP8eJ',
    stripe_product_id = 'prod_Tf3GbZjJw3c29F',
    trial_days = 14
WHERE type = 'starter';

-- Update Pro plan with Stripe IDs
UPDATE subscription_plans 
SET stripe_price_id = 'price_1ShjAIPIJtcImSMvuFrHLB7P',
    stripe_product_id = 'prod_Tf3GyfJj9Kfi61',
    trial_days = 14
WHERE type = 'pro';