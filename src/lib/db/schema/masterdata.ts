import { pgTable, text, numeric, boolean, integer, uuid, unique, type AnyPgColumn } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";

/** Master ukuran (S, M, L, S/M, 1-2y, ...) dengan urutan tampil. */
export const sizes = pgTable("sizes", {
  ...baseColumns,
  code: text("code"),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

/** Kategori produk (pohon 2 tingkat: Kategori -> Sub-kategori via parent_id). */
export const categories = pgTable("categories", {
  ...baseColumns,
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/** Produk (style). Varian-nya = SKU. */
export const products = pgTable("products", {
  ...baseColumns,
  styleCode: text("style_code").notNull(), // segmen kode: BRE-SH001
  name: text("name").notNull(),            // nama tercatat: "Alina Shirt Maroon"
  categoryId: uuid("category_id"),
  collectionId: uuid("collection_id"),
  colorId: uuid("color_id"),               // warna LV2 (1 warna per produk)
  color: text("color"),
  productNo: integer("product_no"),        // no urut per brand+kategori
  retailPrice: numeric("retail_price", { precision: 18, scale: 4 }),
  status: text("status").notNull().default("active"), // active | cancelled
  isActive: boolean("is_active").notNull().default(true),
});

/** Varian produk = SKU. Satu SKU dipakai SELURUH modul (one SKU). */
export const productVariants = pgTable(
  "product_variants",
  {
    ...baseColumns,
    productId: uuid("product_id").notNull().references(() => products.id),
    sku: text("sku").notNull(),
    colorId: uuid("color_id"),
    sizeId: uuid("size_id"),
    color: text("color"),
    size: text("size"),
    barcode: text("barcode"),
    retailPrice: numeric("retail_price", { precision: 18, scale: 4 }).notNull().default("0"),
    standardCost: numeric("standard_cost", { precision: 18, scale: 4 }).notNull().default("0"),
  },
  (t) => ({ skuUnique: unique("uq_variant_sku").on(t.companyId, t.sku) })
);

/** Master warna 2 tingkat: Parent Colour (LV1) -> Sub Colour (LV2) via parent_id. Hex opsional untuk swatch. */
export const colors = pgTable("colors", {
  ...baseColumns,
  parentId: uuid("parent_id").references((): AnyPgColumn => colors.id),
  code: text("code"),
  name: text("name").notNull(),
  hex: text("hex"),
  isActive: boolean("is_active").notNull().default(true),
});

/** Kategori supplier (Fabric Material, Vendor Production, Consumable, ...) — bisa dikelola user. */
export const supplierCategories = pgTable("supplier_categories", {
  ...baseColumns,
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/** Supplier (termasuk vendor makloon via is_subcontractor). One supplier. */
export const suppliers = pgTable("suppliers", {
  ...baseColumns,
  code: text("code").notNull(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references((): AnyPgColumn => supplierCategories.id),
  phone: text("phone"),
  email: text("email"),
  isSubcontractor: boolean("is_subcontractor").notNull().default(false),
  isTaxable: boolean("is_taxable").notNull().default(false), // true = PKP
  npwp: text("npwp"),
  bankName: text("bank_name"),
  bankAccountNo: text("bank_account_no"),
  bankAccountName: text("bank_account_name"),
  isActive: boolean("is_active").notNull().default(true),
});

/** Kategori material (Fabric, Accessories, Consumable, ...) — bisa dikelola user. */
export const materialCategories = pgTable("material_categories", {
  ...baseColumns,
  name: text("name").notNull(),
  code: text("code"),               // prefix kode material, mis. FB / AC / CS
  isActive: boolean("is_active").notNull().default(true),
});

/** Master bahan baku (kain, kancing, benang, label, dll.). */
export const materials = pgTable("materials", {
  ...baseColumns,
  code: text("code"),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references((): AnyPgColumn => materialCategories.id),
  unit: text("unit"),          // Meter, Yard, Pcs, Cone, Roll, Kg, ...
  isActive: boolean("is_active").notNull().default(true),
});

/** Customer. One customer. */
export const customers = pgTable("customers", {
  ...baseColumns,
  code: text("code").notNull(),
  name: text("name").notNull(),
  channel: text("channel"),
});

/** Gudang & toko sebagai lokasi induk (detail bin di inventory_locations). */
export const warehouses = pgTable("warehouses", {
  ...baseColumns,
  code: text("code").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("warehouse"), // warehouse | store
});
