-- The card's eBay listing, if it is for sale: the listing's URL, set by an admin in the app.

ALTER TABLE ${schema}.cards ADD COLUMN IF NOT EXISTS ebay_url varchar(2048);
