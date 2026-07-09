-- Drop existing foreign keys
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_product_id_fkey";
ALTER TABLE "inventory_units" DROP CONSTRAINT "inventory_units_product_id_fkey";
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_inventory_unit_id_fkey";
ALTER TABLE "returns" DROP CONSTRAINT "returns_sale_id_fkey";
ALTER TABLE "returns" DROP CONSTRAINT "returns_inventory_unit_id_fkey";

-- Add foreign keys with ON DELETE CASCADE
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "inventory_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "inventory_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
